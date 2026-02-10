import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { MoviesController } from "./movies.controller";
import { MoviesService } from "./services/movies.service";
import { mockDbMovie, mockDbTorrent } from "../../test/fixtures/movies.fixture";
import { mockDbUser } from "../../test/fixtures/users.fixture";
import type { PaginatedMovies, MovieDetail, HeroMovie } from "./interfaces";

const mockMoviesService = {
  search: vi.fn(),
  findById: vi.fn(),
  getPopular: vi.fn(),
};

describe("MoviesController", () => {
  let controller: MoviesController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoviesController],
      providers: [{ provide: MoviesService, useValue: mockMoviesService }],
    }).compile();

    controller = module.get<MoviesController>(MoviesController);
  });

  describe("GET /movies", () => {
    it("should return paginated movies", async () => {
      const paginatedResult: PaginatedMovies = {
        data: [
          {
            id: mockDbMovie.id,
            title: "The Matrix",
            year: 1999,
            imdbRating: 8.7,
            posterUrl: mockDbMovie.posterUrl,
            backdropUrl: mockDbMovie.backdropUrl,
            genres: ["Action", "Sci-Fi"],
            watched: false,
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasMore: false,
      };
      mockMoviesService.search.mockResolvedValue(paginatedResult);

      const result = await controller.searchMovies(
        { query: "matrix", page: 1, limit: 20 },
        mockDbUser as any,
      );

      expect(result).toEqual(paginatedResult);
      expect(mockMoviesService.search).toHaveBeenCalledWith(
        { query: "matrix", page: 1, limit: 20 },
        mockDbUser.id,
      );
    });

    it("should work without authenticated user (public)", async () => {
      const paginatedResult: PaginatedMovies = {
        data: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasMore: false,
      };
      mockMoviesService.search.mockResolvedValue(paginatedResult);

      const result = await controller.searchMovies(
        { query: "matrix", page: 1, limit: 20 },
        undefined,
      );

      expect(result).toEqual(paginatedResult);
      expect(mockMoviesService.search).toHaveBeenCalledWith(
        { query: "matrix", page: 1, limit: 20 },
        undefined,
      );
    });

    it("should pass all search params to service", async () => {
      mockMoviesService.search.mockResolvedValue({
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasMore: false,
      });

      const dto = {
        query: "action",
        genre: "Action",
        sortBy: "rating" as const,
        order: "desc" as const,
        minRating: 7,
        page: 2,
        limit: 10,
      };

      await controller.searchMovies(dto, mockDbUser as any);

      expect(mockMoviesService.search).toHaveBeenCalledWith(dto, mockDbUser.id);
    });
  });

  describe("GET /movies/popular", () => {
    it("should return popular movies for hero section", async () => {
      const popularMovies: HeroMovie[] = [
        {
          tmdbId: 603,
          title: "The Matrix",
          year: 1999,
          rating: 8.2,
          genres: ["Action", "Sci-Fi"],
          posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
          backdropUrl: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
          overview: "A computer hacker learns about reality.",
        },
      ];
      mockMoviesService.getPopular.mockResolvedValue(popularMovies);

      const result = await controller.getPopularMovies();

      expect(result).toEqual(popularMovies);
      expect(mockMoviesService.getPopular).toHaveBeenCalled();
    });

    it("should return empty array when no popular movies", async () => {
      mockMoviesService.getPopular.mockResolvedValue([]);

      const result = await controller.getPopularMovies();

      expect(result).toEqual([]);
    });
  });

  describe("GET /movies/:id", () => {
    it("should return movie detail", async () => {
      const detail: MovieDetail = {
        id: mockDbMovie.id,
        title: "The Matrix",
        imdbId: "tt0133093",
        year: 1999,
        imdbRating: 8.7,
        runtime: 136,
        summary: "A computer hacker learns about the true nature of reality.",
        posterUrl: mockDbMovie.posterUrl,
        backdropUrl: mockDbMovie.backdropUrl,
        genres: ["Action", "Sci-Fi"],
        director: "Lana Wachowski",
        producer: "Joel Silver",
        cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
        torrents: [
          {
            id: mockDbTorrent.id,
            quality: "1080p",
            seeds: 150,
            peers: 25,
            sizeBytes: "2684354560",
            magnetUrl: mockDbTorrent.magnetUrl,
          },
        ],
        subtitles: [{ lang: "en", label: "English" }],
        commentsCount: 5,
        watched: false,
      };
      mockMoviesService.findById.mockResolvedValue(detail);

      const result = await controller.getMovie(
        mockDbMovie.id,
        mockDbUser as any,
      );

      expect(result).toEqual(detail);
      expect(mockMoviesService.findById).toHaveBeenCalledWith(
        mockDbMovie.id,
        mockDbUser.id,
      );
    });

    it("should propagate NotFoundException", async () => {
      mockMoviesService.findById.mockRejectedValue(
        new NotFoundException("Movie not found"),
      );

      await expect(
        controller.getMovie("nonexistent", mockDbUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
