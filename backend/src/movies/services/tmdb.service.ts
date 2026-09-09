import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchWithTimeout } from "../../common/http/fetch-with-timeout";
import type {
  TmdbMovieDetail,
  TmdbFindResponse,
  TmdbPopularResponse,
  TmdbTvListResponse,
  TmdbTvResult,
  TmdbTvExternalIds,
  SeriesShow,
  HeroMovie,
} from "../interfaces";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",

  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
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
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("api_key", this.apiKey);
    return url;
  }

  async getMovieDetails(tmdbId: number): Promise<TmdbMovieDetail | null> {
    const url = this.buildUrl(`/movie/${tmdbId}`);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", "credits");

    try {
      const response = await fetchWithTimeout(url.toString());

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
      const response = await fetchWithTimeout(url.toString());

      if (!response.ok) {
        this.logger.warn(`TMDb find returned ${response.status}`);
        return null;
      }

      const data: TmdbFindResponse = await response.json();

      if (data.movie_results.length === 0) return null;

      return this.getMovieDetails(data.movie_results[0].id);
    } catch (error) {
      this.logger.error("TMDb find failed", (error as Error).message);
      return null;
    }
  }

  private toSeriesShow(tv: TmdbTvResult): SeriesShow {
    return {
      tmdbId: tv.id,
      name: tv.name,
      year: tv.first_air_date
        ? Number(tv.first_air_date.slice(0, 4)) || null
        : null,
      posterUrl: this.getPosterUrl(tv.poster_path),
      backdropUrl: this.getBackdropUrl(tv.backdrop_path),
      rating: tv.vote_average ?? null,
      genres: (tv.genre_ids ?? [])
        .map((id) => TMDB_GENRE_MAP[id])
        .filter((g): g is string => Boolean(g)),
      popularity: tv.popularity ?? 0,
    };
  }

  async getPopularSeries(page: number = 1): Promise<SeriesShow[]> {
    return this.fetchTvList("/tv/popular", page, "popular tv");
  }

  async getTopRatedSeries(page: number = 1): Promise<SeriesShow[]> {
    return this.fetchTvList("/tv/top_rated", page, "top rated tv");
  }

  private async fetchTvList(
    path: "/tv/popular" | "/tv/top_rated",
    page: number,
    label: string,
  ): Promise<SeriesShow[]> {
    const url = this.buildUrl(path);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", String(page));

    try {
      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) {
        this.logger.warn(`TMDb ${label} returned ${response.status}`);
        return [];
      }
      const data: TmdbTvListResponse = await response.json();
      return data.results
        .filter((tv) => tv.poster_path)
        .map((tv) => this.toSeriesShow(tv));
    } catch (error) {
      this.logger.error(`TMDb ${label} failed`, (error as Error).message);
      return [];
    }
  }

  /** Hero carousel payload: popular TV with backdrop (same shape as movie hero). */
  async getPopularSeriesHero(page: number = 1): Promise<Omit<HeroMovie, "id">[]> {
    const url = this.buildUrl("/tv/popular");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", String(page));

    try {
      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) {
        this.logger.warn(`TMDb popular tv hero returned ${response.status}`);
        return [];
      }
      const data: TmdbTvListResponse = await response.json();
      return data.results
        .filter((tv) => tv.backdrop_path)
        .slice(0, 7)
        .map((tv) => ({
          tmdbId: tv.id,
          title: tv.name,
          year: tv.first_air_date
            ? Number(tv.first_air_date.slice(0, 4)) || null
            : null,
          rating: tv.vote_average ?? 0,
          genres: (tv.genre_ids ?? [])
            .map((id) => TMDB_GENRE_MAP[id])
            .filter((g): g is string => Boolean(g)),
          posterUrl: this.getPosterUrl(tv.poster_path),
          backdropUrl: this.getBackdropUrl(tv.backdrop_path)!,
          overview: tv.overview ?? "",
          popularity: tv.popularity ?? 0,
        }));
    } catch (error) {
      this.logger.error("TMDb popular tv hero failed", (error as Error).message);
      return [];
    }
  }

  async searchSeries(query: string): Promise<SeriesShow[]> {
    const url = this.buildUrl("/search/tv");
    url.searchParams.set("query", query);
    url.searchParams.set("language", "en-US");

    try {
      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) {
        this.logger.warn(`TMDb search tv returned ${response.status}`);
        return [];
      }
      const data: TmdbTvListResponse = await response.json();
      return data.results
        .filter((tv) => tv.poster_path)
        .map((tv) => this.toSeriesShow(tv));
    } catch (error) {
      this.logger.error("TMDb search tv failed", (error as Error).message);
      return [];
    }
  }

  /** Name search for the movie library — same shape as the popular catalog. */
  async searchMovies(query: string): Promise<Omit<HeroMovie, "id">[]> {
    const url = this.buildUrl("/search/movie");
    url.searchParams.set("query", query);
    url.searchParams.set("language", "en-US");

    try {
      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) {
        this.logger.warn(`TMDb search movie returned ${response.status}`);
        return [];
      }
      const data: TmdbPopularResponse = await response.json();
      return data.results
        .filter((m) => m.poster_path)
        .map((m) => ({
          tmdbId: m.id,
          title: m.title,
          year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : null,
          rating: m.vote_average,
          genres: m.genre_ids.map((id) => TMDB_GENRE_MAP[id]).filter(Boolean),
          posterUrl: this.getPosterUrl(m.poster_path),
          backdropUrl: this.getBackdropUrl(m.backdrop_path) ?? "",
          overview: m.overview,
          popularity: m.popularity ?? 0,
        }));
    } catch (error) {
      this.logger.error("TMDb search movie failed", (error as Error).message);
      return [];
    }
  }

  async getTvImdbId(tmdbId: number): Promise<string | null> {
    const url = this.buildUrl(`/tv/${tmdbId}/external_ids`);

    try {
      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) return null;
      const data: TmdbTvExternalIds = await response.json();
      return data.imdb_id || null;
    } catch (error) {
      this.logger.error("TMDb tv external_ids failed", (error as Error).message);
      return null;
    }
  }

  async getPopularMovies(page: number = 1): Promise<Omit<HeroMovie, "id">[]> {
    const movies = await this.fetchMovieList("/movie/popular", page, "popular", {
      requireBackdrop: true,
      limit: 7,
    });
    return movies;
  }

  /** Full TMDb popular page for library browse (poster required, no hero slice). */
  async getPopularMoviesCatalog(page: number = 1): Promise<Omit<HeroMovie, "id">[]> {
    return this.fetchMovieList("/movie/popular", page, "popular catalog", {
      requireBackdrop: false,
      requirePoster: true,
    });
  }

  async getTopRatedMoviesCatalog(page: number = 1): Promise<Omit<HeroMovie, "id">[]> {
    return this.fetchMovieList("/movie/top_rated", page, "top rated catalog", {
      requireBackdrop: false,
      requirePoster: true,
    });
  }

  private async fetchMovieList(
    path: "/movie/popular" | "/movie/top_rated",
    page: number,
    label: string,
    opts: { requireBackdrop?: boolean; requirePoster?: boolean; limit?: number },
  ): Promise<Omit<HeroMovie, "id">[]> {
    const url = this.buildUrl(path);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", String(page));

    try {
      const response = await fetchWithTimeout(url.toString());

      if (!response.ok) {
        this.logger.warn(`TMDb ${label} returned ${response.status}`);
        return [];
      }

      const data: TmdbPopularResponse = await response.json();

      let results = data.results;
      if (opts.requireBackdrop) {
        results = results.filter((m) => m.backdrop_path);
      }
      if (opts.requirePoster) {
        results = results.filter((m) => m.poster_path);
      }
      if (opts.limit != null) {
        results = results.slice(0, opts.limit);
      }

      return results.map((m) => ({
        tmdbId: m.id,
        title: m.title,
        year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : null,
        rating: m.vote_average,
        genres: m.genre_ids.map((id) => TMDB_GENRE_MAP[id]).filter(Boolean),
        posterUrl: this.getPosterUrl(m.poster_path),
        backdropUrl: this.getBackdropUrl(m.backdrop_path) ?? "",
        overview: m.overview,
        popularity: m.popularity ?? 0,
      }));
    } catch (error) {
      this.logger.error(`TMDb ${label} failed`, (error as Error).message);
      return [];
    }
  }

  getPosterUrl(
    posterPath: string | null,
    size: string = "w500",
  ): string | null {
    if (!posterPath) return null;
    return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
  }

  getBackdropUrl(
    backdropPath: string | null,
    size: string = "w1280",
  ): string | null {
    if (!backdropPath) return null;
    return `${TMDB_IMAGE_BASE}/${size}${backdropPath}`;
  }
}
