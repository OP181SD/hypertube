import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  TmdbSearchResponse,
  TmdbSearchResult,
  TmdbMovieDetail,
  TmdbFindResponse,
} from "../interfaces";

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("TMDB_API_KEY")!;
    this.baseUrl =
      this.configService.get<string>("TMDB_BASE_URL") ??
      "https://api.themoviedb.org/3";
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
  }

  async searchMovie(
    query: string,
    year?: number,
  ): Promise<TmdbSearchResult[]> {
    const url = new URL(`${this.baseUrl}/search/movie`);
    url.searchParams.set("query", query);
    url.searchParams.set("language", "en-US");
    if (year) url.searchParams.set("year", String(year));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        headers: this.headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`TMDb search returned ${response.status}`);
        return [];
      }

      const data: TmdbSearchResponse = await response.json();
      return data.results;
    } catch (error) {
      this.logger.error("TMDb search failed", (error as Error).message);
      return [];
    }
  }

  async getMovieDetails(tmdbId: number): Promise<TmdbMovieDetail | null> {
    const url = new URL(`${this.baseUrl}/movie/${tmdbId}`);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", "credits");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        headers: this.headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`TMDb movie details returned ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error("TMDb details failed", (error as Error).message);
      return null;
    }
  }

  async findByImdbId(imdbId: string): Promise<TmdbMovieDetail | null> {
    const url = new URL(`${this.baseUrl}/find/${imdbId}`);
    url.searchParams.set("external_source", "imdb_id");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        headers: this.headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`TMDb find returned ${response.status}`);
        return null;
      }

      const data: TmdbFindResponse = await response.json();

      if (data.movie_results.length === 0) return null;

      // Get full details including credits
      return this.getMovieDetails(data.movie_results[0].id);
    } catch (error) {
      this.logger.error("TMDb find failed", (error as Error).message);
      return null;
    }
  }

  getPosterUrl(
    posterPath: string | null,
    size: string = "w500",
  ): string | null {
    if (!posterPath) return null;
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  }

  getBackdropUrl(
    backdropPath: string | null,
    size: string = "w1280",
  ): string | null {
    if (!backdropPath) return null;
    return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
  }
}
