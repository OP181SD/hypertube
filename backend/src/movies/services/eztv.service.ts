import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchWithTimeout } from "../../common/http/fetch-with-timeout";
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
    this.baseUrl = this.configService.get<string>("EZTV_BASE_URL")!;
  }

  async searchTorrents(params: EztvSearchParams): Promise<EztvSearchResult> {
    const url = new URL(`${this.baseUrl}/get-torrents`);

    url.searchParams.set("limit", String(params.limit ?? 30));
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.imdbId) url.searchParams.set("imdb_id", params.imdbId);

    try {
      const response = await fetchWithTimeout(url.toString());

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

  // Fetch every torrent of a show by paging through EZTV (100/page is the API
  // max) until a short page, capped to avoid pathological shows. Used lazily
  // when a series detail is opened so the whole catalogue is available.
  async getAllTorrentsByImdb(imdbId: string): Promise<EztvTorrent[]> {
    const PAGE_SIZE = 100;
    const MAX_PAGES = 10;
    const all: EztvTorrent[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { torrents } = await this.searchTorrents({
        imdbId,
        page,
        limit: PAGE_SIZE,
      });
      all.push(...torrents);
      if (torrents.length < PAGE_SIZE) break; // last page reached
    }

    return all;
  }
}
