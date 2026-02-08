import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EztvListResponse, EztvTorrent } from "../interfaces";

export interface EztvSearchParams {
  query?: string;
  page?: number;
  limit?: number;
  imdbId?: string;
}

export interface EztvSearchResult {
  torrents: EztvTorrent[];
  torrentsCount: number;
}

@Injectable()
export class EztvService {
  private readonly logger = new Logger(EztvService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>("EZTV_BASE_URL") ??
      "https://eztv.re/api";
  }

  async searchTorrents(params: EztvSearchParams): Promise<EztvSearchResult> {
    const url = new URL(`${this.baseUrl}/get-torrents`);

    url.searchParams.set("limit", String(params.limit ?? 30));
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.imdbId) url.searchParams.set("imdb_id", params.imdbId);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`EZTV API returned ${response.status}`);
        return { torrents: [], torrentsCount: 0 };
      }

      const data: EztvListResponse = await response.json();

      let torrents = data.torrents ?? [];

      // EZTV doesn't have a query param — filter client-side by title
      if (params.query) {
        const q = params.query.toLowerCase();
        torrents = torrents.filter((t) => t.title.toLowerCase().includes(q));
      }

      return {
        torrents,
        torrentsCount: data.torrents_count,
      };
    } catch (error) {
      this.logger.error("EZTV API call failed", (error as Error).message);
      return { torrents: [], torrentsCount: 0 };
    }
  }
}
