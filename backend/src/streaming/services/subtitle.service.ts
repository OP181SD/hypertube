import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type {
  SubtitleEntry,
  OpenSubtitlesSearchResponse,
  OpenSubtitlesDownloadResponse,
} from "../interfaces";

// Languages shown in the player, in priority order (first = default selection)
const PRINCIPAL_LANGUAGES = ["en", "fr", "es", "de", "it", "pt", "ar", "ru", "nl", "pl", "sv", "tr", "ja", "ko", "zh"];

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ru: "Русский",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  ar: "العربية",
  nl: "Nederlands",
  pl: "Polski",
  sv: "Svenska",
  tr: "Türkçe",
};

const OPENSUBTITLES_BASE_URL = "https://api.opensubtitles.com/api/v1";

@Injectable()
export class SubtitleService {
  private readonly logger = new Logger(SubtitleService.name);
  private readonly apiKey: string;
  private readonly storagePath: string;
  private readonly username: string;
  private readonly password: string;
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>("OPENSUBTITLES_API_KEY") ?? "";
    this.storagePath =
      this.configService.get<string>("STORAGE_PATH") ?? "./data/videos";
    this.username =
      this.configService.get<string>("OPENSUBTITLES_USERNAME") ?? "";
    this.password =
      this.configService.get<string>("OPENSUBTITLES_PASSWORD") ?? "";
  }

  /**
   * Returns a Bearer token for authenticated requests (200 dl/day instead of 5).
   * Token is cached for 23 h (OpenSubtitles tokens last 24 h).
   * Returns null when credentials are absent or login fails — caller falls back to guest mode.
   */
  private async getUserToken(): Promise<string | null> {
    if (!this.username || !this.password) return null;

    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    try {
      const res = await fetch(`${OPENSUBTITLES_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: this.username, password: this.password }),
      });

      if (!res.ok) {
        this.logger.warn(`OpenSubtitles login failed: ${res.status}`);
        return null;
      }

      const data = await res.json() as { token: string };
      this.cachedToken = data.token;
      this.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 h
      this.logger.log("OpenSubtitles: authenticated successfully");
      return this.cachedToken;
    } catch (error) {
      this.logger.error("OpenSubtitles login error", (error as Error).message);
      return null;
    }
  }

  async getAvailableSubtitles(imdbId: string): Promise<SubtitleEntry[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      // Filter to principal languages, sorted by download count (best quality first)
      const params = new URLSearchParams({
        imdb_id: imdbId,
        languages: PRINCIPAL_LANGUAGES.join(","),
        order_by: "download_count",
        order_direction: "desc",
        per_page: "100",
      });

      const response = await fetch(
        `${OPENSUBTITLES_BASE_URL}/subtitles?${params}`,
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

      // Deduplicate by language — since results are ordered by download_count desc,
      // the first entry per language is the most popular (= highest quality)
      const seen = new Set<string>();
      const byLang = new Map<string, SubtitleEntry>();

      for (const sub of data.data) {
        const lang = sub.attributes.language;
        if (seen.has(lang)) continue;
        seen.add(lang);

        const file = sub.attributes.files[0];
        if (!file) continue;

        byLang.set(lang, {
          lang,
          label: LANGUAGE_LABELS[lang] ?? lang,
          fileId: String(file.file_id),
        });
      }

      // Return in PRINCIPAL_LANGUAGES order so the player shows them consistently
      const entries: SubtitleEntry[] = [];
      for (const lang of PRINCIPAL_LANGUAGES) {
        const entry = byLang.get(lang);
        if (entry) entries.push(entry);
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
      const token = await this.getUserToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const downloadRes = await fetch(
        `${OPENSUBTITLES_BASE_URL}/download`,
        {
          method: "POST",
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

      // Only cache if the VTT has actual cues — prevents caching empty/broken downloads
      if (this.hasVttCues(vttContent)) {
        await this.cacheSubtitle(movieId, lang, vttContent);
      } else {
        this.logger.warn(`VTT for ${movieId}/${lang} has no cues, skipping cache`);
      }

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
    // Strip UTF-8 BOM (common in OpenSubtitles files — makes VTT unparseable)
    const withoutBom = srt.replace(/^\uFEFF/, "");
    // Normalize line endings
    const normalized = withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // Replace SRT comma separator with VTT dot in timestamps
    const converted = normalized.replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      "$1.$2",
    );
    return `WEBVTT\n\n${converted}`;
  }

  private hasVttCues(vtt: string): boolean {
    return /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/.test(vtt);
  }

  async getCachedSubtitle(
    movieId: string,
    lang: string,
  ): Promise<string | null> {
    try {
      const filePath = this.getSubtitlePath(movieId, lang);
      await access(filePath);
      const content = await readFile(filePath, "utf-8");
      // Reject empty/broken cached VTT to force a fresh download
      return this.hasVttCues(content) ? content : null;
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
