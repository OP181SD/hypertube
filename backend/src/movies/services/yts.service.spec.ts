import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { YtsService } from "./yts.service";
import {
  ytsListResponse,
  ytsEmptyResponse,
} from "../../../test/fixtures/movies.fixture";

describe("YtsService", () => {
  let service: YtsService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YtsService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === "YTS_BASE_URL") return "https://yts.mx/api/v2";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<YtsService>(YtsService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("searchMovies", () => {
    it("should search movies with query", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ytsListResponse,
      });

      const result = await service.searchMovies({ query: "matrix" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("list_movies.json"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("query_term=matrix");
      expect(result.movies).toHaveLength(2);
      expect(result.movieCount).toBe(2);
      expect(result.movies[0].imdb_code).toBe("tt0133093");
    });

    it("should pass sort, genre, and rating params", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ytsListResponse,
      });

      await service.searchMovies({
        genre: "action",
        sortBy: "rating",
        order: "desc",
        minRating: 7,
        page: 2,
        limit: 10,
      });

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("genre=action");
      expect(url).toContain("sort_by=rating");
      expect(url).toContain("order_by=desc");
      expect(url).toContain("minimum_rating=7");
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });

    it("should return empty array when no movies found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ytsEmptyResponse,
      });

      const result = await service.searchMovies({ query: "zzzznonexistent" });

      expect(result.movies).toEqual([]);
      expect(result.movieCount).toBe(0);
    });

    it("should return empty on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await service.searchMovies({ query: "matrix" });

      expect(result.movies).toEqual([]);
      expect(result.movieCount).toBe(0);
    });

    it("should return empty on network failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await service.searchMovies({ query: "matrix" });

      expect(result.movies).toEqual([]);
      expect(result.movieCount).toBe(0);
    });
  });
});
