import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type {
  SubtitleEntry,
  OpenSubtitlesSearchResponse,
  OpenSubtitlesDownloadResponse,
} from "../interfaces";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  tr: "Turkish",
};

const OPENSUBTITLES_BASE_URL = "https://api.opensubtitles.com/api/v1";

@Injectable()
export class SubtitleService {
  private readonly logger = new Logger(SubtitleService.name);
  private readonly apiKey: string;
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>("OPENSUBTITLES_API_KEY") ?? "";
    this.storagePath =
      this.configService.get<string>("STORAGE_PATH") ?? "./data/videos";
  }

  async getAvailableSubtitles(imdbId: string): Promise<SubtitleEntry[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(
        `${OPENSUBTITLES_BASE_URL}/subtitles?imdb_id=${imdbId}`,
        {
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(
          `OpenSubtitles API returned ${response.status}`,
        );
        return [];
      }

      const data: OpenSubtitlesSearchResponse = await response.json();

      // Deduplicate by language, keep first entry per language
      const seen = new Set<string>();
      const entries: SubtitleEntry[] = [];

      for (const sub of data.data) {
        const lang = sub.attributes.language;
        if (seen.has(lang)) continue;
        seen.add(lang);

        const file = sub.attributes.files[0];
        if (!file) continue;

        entries.push({
          lang,
          label: LANGUAGE_LABELS[lang] ?? lang,
          fileId: String(file.file_id),
        });
      }

      return entries;
    } catch (error) {
      this.logger.error(
        "OpenSubtitles API call failed",
        (error as Error).message,
      );
      return [];
    }
  }

  async downloadSubtitle(
    fileId: string,
    movieId: string,
    lang: string,
  ): Promise<string | null> {
    try {
      // Check disk cache first
      const cached = await this.getCachedSubtitle(movieId, lang);
      if (cached) return cached;

      // Request download link from OpenSubtitles
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const downloadRes = await fetch(
        `${OPENSUBTITLES_BASE_URL}/download`,
        {
          method: "POST",
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file_id: Number(fileId) }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!downloadRes.ok) {
        this.logger.warn(`OpenSubtitles download returned ${downloadRes.status}`);
        return null;
      }

      const downloadData: OpenSubtitlesDownloadResponse =
        await downloadRes.json();

      // Fetch the actual SRT file
      const srtResponse = await fetch(downloadData.link);
      if (!srtResponse.ok) return null;

      const srtContent = await srtResponse.text();
      const vttContent = this.srtToVtt(srtContent);

      // Cache to disk
      await this.cacheSubtitle(movieId, lang, vttContent);

      return vttContent;
    } catch (error) {
      this.logger.error(
        "Subtitle download failed",
        (error as Error).message,
      );
      return null;
    }
  }

  srtToVtt(srt: string): string {
    // Normalize line endings
    const normalized = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Replace comma with dot in timestamps
    const converted = normalized.replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      "$1.$2",
    );

    return `WEBVTT\n\n${converted}`;
  }

  private async getCachedSubtitle(
    movieId: string,
    lang: string,
  ): Promise<string | null> {
    try {
      const filePath = this.getSubtitlePath(movieId, lang);
      await access(filePath);
      return await readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  private async cacheSubtitle(
    movieId: string,
    lang: string,
    content: string,
  ): Promise<void> {
    const dir = join(this.storagePath, "subtitles", movieId);
    await mkdir(dir, { recursive: true });
    await writeFile(this.getSubtitlePath(movieId, lang), content, "utf-8");
  }

  private getSubtitlePath(movieId: string, lang: string): string {
    return join(this.storagePath, "subtitles", movieId, `${lang}.vtt`);
  }
}
