import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  TmdbSearchResponse,
  TmdbSearchResult,
  TmdbMovieDetail,
  TmdbFindResponse,
  TmdbPopularResponse,
  HeroMovie,
} from "../interfaces";

const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
};

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("TMDB_API_KEY")!;
    this.baseUrl = this.configService.get<string>("TMDB_BASE_URL")!;
  }

  private buildUrl(path: string): URL {
    return new URL(`${this.baseUrl}${path}`);
  }

  private get authHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async searchMovie(
    query: string,
    year?: number,
  ): Promise<TmdbSearchResult[]> {
    const url = this.buildUrl("/search/movie");
    url.searchParams.set("query", query);
    url.searchParams.set("language", "en-US");
    if (year) url.searchParams.set("year", String(year));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        headers: this.authHeaders,
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
    const url = this.buildUrl(`/movie/${tmdbId}`);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", "credits");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        headers: this.authHeaders,
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
    const url = this.buildUrl(`/find/${imdbId}`);
    url.searchParams.set("external_source", "imdb_id");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        headers: this.authHeaders,
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

  async getPopularMovies(page: number = 1): Promise<Omit<HeroMovie, "id">[]> {
    const url = this.buildUrl("/movie/popular");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", String(page));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        headers: this.authHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`TMDb popular returned ${response.status}`);
        return [];
      }

      const data: TmdbPopularResponse = await response.json();

      return data.results
        .filter((m) => m.backdrop_path)
        .slice(0, 7)
        .map((m) => ({
          tmdbId: m.id,
          title: m.title,
          year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : null,
          rating: m.vote_average,
          genres: m.genre_ids.map((id) => TMDB_GENRE_MAP[id]).filter(Boolean),
          posterUrl: this.getPosterUrl(m.poster_path),
          backdropUrl: this.getBackdropUrl(m.backdrop_path)!,
          overview: m.overview,
        }));
    } catch (error) {
      this.logger.error("TMDb popular failed", (error as Error).message);
      return [];
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
