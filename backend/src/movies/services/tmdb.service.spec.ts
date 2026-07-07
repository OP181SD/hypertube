import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TmdbService } from "./tmdb.service";
import {
  tmdbSearchResponse,
  tmdbMovieDetail,
  tmdbFindResponse,
  tmdbPopularResponse,
} from "../../../test/fixtures/movies.fixture";

describe("TmdbService", () => {
  let service: TmdbService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmdbService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              const config: Record<string, string> = {
                TMDB_API_KEY: "test-tmdb-key",
                TMDB_BASE_URL: "https://api.themoviedb.org/3",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TmdbService>(TmdbService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("searchMovie", () => {
    it("should search movies by query", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tmdbSearchResponse,
      });

      const results = await service.searchMovie("The Matrix");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("The Matrix");
      expect(results[0].id).toBe(603);

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("search/movie");
      expect(url).toContain("query=The+Matrix");
    });

    it("should include year when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tmdbSearchResponse,
      });

      await service.searchMovie("The Matrix", 1999);

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("year=1999");
    });

    it("should include the API key as a query parameter", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tmdbSearchResponse,
      });

      await service.searchMovie("test");

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("api_key=test-tmdb-key");
    });

    it("should return empty on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const results = await service.searchMovie("test");
      expect(results).toEqual([]);
    });
  });

  describe("getMovieDetails", () => {
    it("should fetch movie details with credits", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tmdbMovieDetail,
      });

      const result = await service.getMovieDetails(603);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("The Matrix");
      expect(result!.runtime).toBe(136);
      expect(result!.credits?.cast).toHaveLength(3);
      expect(result!.credits?.crew).toHaveLength(3);

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("movie/603");
      expect(url).toContain("append_to_response=credits");
    });

    it("should return null on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await service.getMovieDetails(999999);
      expect(result).toBeNull();
    });
  });

  describe("findByImdbId", () => {
    it("should find movie by IMDb ID and return details", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => tmdbFindResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => tmdbMovieDetail,
        });

      const result = await service.findByImdbId("tt0133093");

      expect(result).not.toBeNull();
      expect(result!.title).toBe("The Matrix");

      // First call: find by external ID
      const findUrl = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(findUrl).toContain("find/tt0133093");
      expect(findUrl).toContain("external_source=imdb_id");
    });

    it("should return null when no movie found for IMDb ID", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ movie_results: [], tv_results: [] }),
      });

      const result = await service.findByImdbId("tt9999999");
      expect(result).toBeNull();
    });
  });

  describe("getPopularSeries / searchSeries", () => {
    const tvListResponse = {
      page: 1,
      total_pages: 1,
      total_results: 2,
      results: [
        {
          id: 1396,
          name: "Breaking Bad",
          original_name: "Breaking Bad",
          overview: "A chemistry teacher turns to crime.",
          poster_path: "/poster.jpg",
          backdrop_path: "/backdrop.jpg",
          first_air_date: "2008-01-20",
          vote_average: 9.5,
          genre_ids: [80, 18],
        },
        {
          id: 999,
          name: "No Poster Show",
          original_name: "No Poster Show",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          first_air_date: "2020-01-01",
          vote_average: 5,
          genre_ids: [10764],
        },
      ],
    };

    it("getPopularSeries should map TV shows and drop those without a poster", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tvListResponse,
      });

      const shows = await service.getPopularSeries(1);

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("/tv/popular");
      expect(shows).toHaveLength(1); // the no-poster show is filtered out
      expect(shows[0].name).toBe("Breaking Bad");
      expect(shows[0].year).toBe(2008);
      expect(shows[0].genres).toEqual(["Crime", "Drama"]);
      expect(shows[0].posterUrl).toContain("/poster.jpg");
    });

    it("searchSeries should query /search/tv", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tvListResponse,
      });

      await service.searchSeries("breaking bad");

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("/search/tv");
      expect(url).toContain("query=breaking");
    });

    it("getPopularSeries should return empty on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      expect(await service.getPopularSeries()).toEqual([]);
    });
  });

  describe("getTvImdbId", () => {
    it("should return the imdb id from external_ids", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ imdb_id: "tt0903747" }),
      });

      const imdb = await service.getTvImdbId(1396);

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("/tv/1396/external_ids");
      expect(imdb).toBe("tt0903747");
    });

    it("should return null when imdb id is absent", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ imdb_id: null }),
      });

      expect(await service.getTvImdbId(1396)).toBeNull();
    });

    it("should return null on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      expect(await service.getTvImdbId(1396)).toBeNull();
    });
  });

  describe("getPopularMovies", () => {
    it("should return popular movies with backdrop images", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tmdbPopularResponse,
      });

      const results = await service.getPopularMovies();

      // Should filter out the movie without backdrop_path
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("The Matrix");
      expect(results[0].backdropUrl).toBe(
        "https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
      );
      expect(results[0].year).toBe(1999);
      expect(results[0].rating).toBe(8.2);
      expect(results[0].genres).toEqual(["Action", "Sci-Fi"]);

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("movie/popular");
    });

    it("should pass page parameter", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...tmdbPopularResponse, results: [] }),
      });

      await service.getPopularMovies(3);

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("page=3");
    });

    it("should return empty array on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const results = await service.getPopularMovies();
      expect(results).toEqual([]);
    });

    it("should limit results to 7 movies", async () => {
      const manyMovies = Array.from({ length: 20 }, (_, i) => ({
        ...tmdbPopularResponse.results[0],
        id: i + 1,
        title: `Movie ${i + 1}`,
      }));
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...tmdbPopularResponse, results: manyMovies }),
      });

      const results = await service.getPopularMovies();
      expect(results).toHaveLength(7);
    });
  });

  describe("getPosterUrl", () => {
    it("should construct poster URL with default size", () => {
      const url = service.getPosterUrl("/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg");
      expect(url).toBe(
        "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      );
    });

    it("should construct poster URL with custom size", () => {
      const url = service.getPosterUrl(
        "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        "original",
      );
      expect(url).toBe(
        "https://image.tmdb.org/t/p/original/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      );
    });

    it("should return null for null poster path", () => {
      const url = service.getPosterUrl(null);
      expect(url).toBeNull();
    });
  });
});
