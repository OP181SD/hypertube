import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { YtsListResponse, YtsMovie } from "../interfaces";

export interface YtsSearchParams {
  query?: string;
  genre?: string;
  sortBy?: string;
  order?: string;
  minRating?: number;
  page?: number;
  limit?: number;
}

export interface YtsSearchResult {
  movies: YtsMovie[];
  movieCount: number;
}

@Injectable()
export class YtsService {
  private readonly logger = new Logger(YtsService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>("YTS_BASE_URL") ??
      "https://yts.mx/api/v2";
  }

  async searchMovies(params: YtsSearchParams): Promise<YtsSearchResult> {
    const url = new URL(`${this.baseUrl}/list_movies.json`);

    if (params.query) url.searchParams.set("query_term", params.query);
    if (params.genre) url.searchParams.set("genre", params.genre);
    if (params.sortBy) url.searchParams.set("sort_by", params.sortBy);
    if (params.order) url.searchParams.set("order_by", params.order);
    if (params.minRating != null)
      url.searchParams.set("minimum_rating", String(params.minRating));
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.limit) url.searchParams.set("limit", String(params.limit));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`YTS API returned ${response.status}`);
        return { movies: [], movieCount: 0 };
      }

      const data: YtsListResponse = await response.json();

      return {
        movies: data.data.movies ?? [],
        movieCount: data.data.movie_count,
      };
    } catch (error) {
      this.logger.error("YTS API call failed", (error as Error).message);
      return { movies: [], movieCount: 0 };
    }
  }
}
