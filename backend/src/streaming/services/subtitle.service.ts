import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchWithTimeout } from "../../common/http/fetch-with-timeout";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  SubtitleEntry,
  OpenSubtitlesSearchResponse,
  OpenSubtitlesDownloadResponse,
} from "../interfaces";

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

export type SubtitleEpisode = {
  season: number;
  episode: number;
};

@Injectable()
export class SubtitleService {
  private readonly logger = new Logger(SubtitleService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly storagePath: string;
  private readonly username: string;
  private readonly password: string;
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>("OPENSUBTITLES_API_KEY") ?? "";
    this.baseUrl =
      this.configService.get<string>("OPENSUBTITLES_BASE_URL") ??
      "https://api.opensubtitles.com/api/v1";
    this.storagePath =
      this.configService.get<string>("STORAGE_PATH") ?? "./data/videos";
    this.username =
      this.configService.get<string>("OPENSUBTITLES_USERNAME") ?? "";
    this.password =
      this.configService.get<string>("OPENSUBTITLES_PASSWORD") ?? "";
  }

  private async getUserToken(): Promise<string | null> {
    if (!this.username || !this.password) return null;

    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    try {
      const res = await fetch(`${this.baseUrl}/login`, {
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
      this.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      this.logger.log("OpenSubtitles: authenticated successfully");
      return this.cachedToken;
    } catch (error) {
      this.logger.error("OpenSubtitles login error", (error as Error).message);
      return null;
    }
  }

  async getAvailableSubtitles(
    imdbId: string,
    episode?: SubtitleEpisode,
  ): Promise<SubtitleEntry[]> {
    if (!this.apiKey) {
      return [];
    }

    if (imdbId.startsWith("tmdb-")) {
      return [];
    }

    try {
      const osImdbId = imdbId.replace(/^tt/i, "");
      const params = new URLSearchParams({
        languages: PRINCIPAL_LANGUAGES.join(","),
        order_by: "download_count",
        order_direction: "desc",
        per_page: "100",
      });

      // TV: show IMDb is a parent id. Searching it as imdb_id returns 0 episode subs.
      if (episode) {
        params.set("parent_imdb_id", osImdbId);
        params.set("season_number", String(episode.season));
        params.set("episode_number", String(episode.episode));
        params.set("type", "episode");
      } else {
        params.set("imdb_id", imdbId);
      }

      const response = await fetchWithTimeout(
        `${this.baseUrl}/subtitles?${params}`,
        {
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `OpenSubtitles API returned ${response.status}`,
        );
        return [];
      }

      const data: OpenSubtitlesSearchResponse = await response.json();

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

      const entries: SubtitleEntry[] = [];
      for (const lang of PRINCIPAL_LANGUAGES) {
        const entry = byLang.get(lang);
        if (entry) entries.push(entry);
      }

      if (episode) {
        this.logger.log(
          `OpenSubtitles S${episode.season}E${episode.episode} parent=${osImdbId} total=${data.total_count} langs=${entries.length}`,
        );
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
    episode?: SubtitleEpisode,
  ): Promise<string | null> {
    if (!PRINCIPAL_LANGUAGES.includes(lang)) return null;
    try {

      const cached = await this.getCachedSubtitle(movieId, lang, episode);
      if (cached) return cached;

      const token = await this.getUserToken();

      const downloadRes = await fetchWithTimeout(
        `${this.baseUrl}/download`,
        {
          method: "POST",
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ file_id: Number(fileId) }),
        },
      );

      if (!downloadRes.ok) {
        this.logger.warn(`OpenSubtitles download returned ${downloadRes.status}`);
        return null;
      }

      const downloadData: OpenSubtitlesDownloadResponse =
        await downloadRes.json();

      const srtResponse = await fetch(downloadData.link);
      if (!srtResponse.ok) return null;

      const srtContent = await srtResponse.text();
      const vttContent = this.srtToVtt(srtContent);

      if (this.hasVttCues(vttContent)) {
        await this.cacheSubtitle(movieId, lang, vttContent, episode);
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

    const withoutBom = srt.replace(/^\uFEFF/, "");

    const normalized = withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

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
    episode?: SubtitleEpisode,
  ): Promise<string | null> {
    if (!PRINCIPAL_LANGUAGES.includes(lang)) return null;
    try {
      const filePath = this.getSubtitlePath(movieId, lang, episode);
      await access(filePath);
      const content = await readFile(filePath, "utf-8");

      return this.hasVttCues(content) ? content : null;
    } catch {
      return null;
    }
  }

  private async cacheSubtitle(
    movieId: string,
    lang: string,
    content: string,
    episode?: SubtitleEpisode,
  ): Promise<void> {
    const filePath = this.getSubtitlePath(movieId, lang, episode);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
  }

  private getSubtitlePath(
    movieId: string,
    lang: string,
    episode?: SubtitleEpisode,
  ): string {
    if (episode) {
      return join(
        this.storagePath,
        "subtitles",
        movieId,
        `s${episode.season}e${episode.episode}`,
        `${lang}.vtt`,
      );
    }
    return join(this.storagePath, "subtitles", movieId, `${lang}.vtt`);
  }
}
