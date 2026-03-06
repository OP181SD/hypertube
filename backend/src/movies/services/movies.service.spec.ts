import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { MoviesService } from "./movies.service";
import { YtsService } from "./yts.service";
import { EztvService } from "./eztv.service";
import { TmdbService } from "./tmdb.service";
import { SubtitleService } from "../../streaming/services/subtitle.service";
import { MovieCacheService } from "./movie-cache.service";
import { MovieMapperService } from "./movie-mapper.service";
import { MovieQueryService } from "./movie-query.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ytsMovie,
  ytsMovie2,
  eztvTorrent,
  tmdbMovieDetail,
  mockDbMovie,
  mockDbMovie2,
  mockDbTorrent,
} from "../../../test/fixtures/movies.fixture";

const mockYtsService = {
  searchMovies: vi.fn(),
};

const mockEztvService = {
  searchTorrents: vi.fn(),
};

const mockTmdbService = {
  findByImdbId: vi.fn(),
  getMovieDetails: vi.fn(),
  getPopularMovies: vi.fn(),
  getPosterUrl: vi.fn((path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : null,
  ),
  getBackdropUrl: vi.fn((path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w1280${path}` : null,
  ),
};

const mockSubtitleService = {
  getAvailableSubtitles: vi.fn().mockResolvedValue([]),
};

const mockMovieCacheService = {
  cacheYtsMovies: vi.fn().mockResolvedValue(undefined),
  cacheEztvTorrents: vi.fn().mockResolvedValue(undefined),
};

const mockMovieMapperService = new MovieMapperService();

const mockMovieQueryService = {
  buildWhereClause: vi.fn().mockReturnValue({}),
  buildOrderBy: vi.fn().mockReturnValue({ imdbRating: "desc" }),
  mapSortField: vi.fn().mockReturnValue(undefined),
  getWatchedMovieIds: vi.fn().mockResolvedValue(new Set()),
  getWatchlistMovieIds: vi.fn().mockResolvedValue(new Set()),
};

const mockPrisma = {
  movie: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  torrent: {
    upsert: vi.fn(),
  },
  comment: {
    count: vi.fn(),
  },
  watchHistory: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  watchlist: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
};

describe("MoviesService", () => {
  let service: MoviesService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock implementations that use fn().mockResolvedValue
    mockMovieCacheService.cacheYtsMovies.mockResolvedValue(undefined);
    mockMovieCacheService.cacheEztvTorrents.mockResolvedValue(undefined);
    mockMovieQueryService.buildWhereClause.mockReturnValue({});
    mockMovieQueryService.buildOrderBy.mockReturnValue({ imdbRating: "desc" });
    mockMovieQueryService.mapSortField.mockReturnValue(undefined);
    mockMovieQueryService.getWatchedMovieIds.mockResolvedValue(new Set());
    mockMovieQueryService.getWatchlistMovieIds.mockResolvedValue(new Set());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        { provide: YtsService, useValue: mockYtsService },
        { provide: EztvService, useValue: mockEztvService },
        { provide: TmdbService, useValue: mockTmdbService },
        { provide: SubtitleService, useValue: mockSubtitleService },
        { provide: MovieCacheService, useValue: mockMovieCacheService },
        { provide: MovieMapperService, useValue: mockMovieMapperService },
        { provide: MovieQueryService, useValue: mockMovieQueryService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
  });

  describe("getPopular", () => {
    it("should return popular movies with database IDs (cache hit)", async () => {
      const tmdbMovies = [
        {
          tmdbId: 603,
          title: "The Matrix",
          year: 1999,
          rating: 8.2,
          genres: ["Action", "Sci-Fi"],
          posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
          backdropUrl: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
          overview: "A hacker discovers reality.",
        },
      ];
      const dbId = "00000000-0000-0000-0000-000000000001";
      mockTmdbService.getPopularMovies.mockResolvedValue(tmdbMovies);
      mockPrisma.movie.findFirst.mockResolvedValue({ id: dbId, tmdbId: 603 });

      const result = await service.getPopular();

      expect(result).toEqual([{ ...tmdbMovies[0], id: dbId }]);
      expect(mockTmdbService.getPopularMovies).toHaveBeenCalled();
      expect(mockTmdbService.getMovieDetails).not.toHaveBeenCalled();
      expect(mockPrisma.movie.upsert).not.toHaveBeenCalled();
    });

    it("should fetch real imdbId and upsert when movie not in DB", async () => {
      const tmdbMovies = [
        {
          tmdbId: 603,
          title: "The Matrix",
          year: 1999,
          rating: 8.2,
          genres: ["Action", "Sci-Fi"],
          posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
          backdropUrl: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
          overview: "A hacker discovers reality.",
        },
      ];
      const dbId = "00000000-0000-0000-0000-000000000001";
      mockTmdbService.getPopularMovies.mockResolvedValue(tmdbMovies);
      mockPrisma.movie.findFirst.mockResolvedValue(null);
      mockTmdbService.getMovieDetails.mockResolvedValue({ imdb_id: "tt0133093" });
      mockPrisma.movie.upsert.mockResolvedValue({ id: dbId, imdbId: "tt0133093" });

      const result = await service.getPopular();

      expect(result).toEqual([{ ...tmdbMovies[0], id: dbId }]);
      expect(mockTmdbService.getMovieDetails).toHaveBeenCalledWith(603);
      expect(mockPrisma.movie.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { imdbId: "tt0133093" } }),
      );
    });

    it("should return empty array when TMDb fails", async () => {
      mockTmdbService.getPopularMovies.mockResolvedValue([]);

      const result = await service.getPopular();

      expect(result).toEqual([]);
    });
  });

  describe("search", () => {
    it("should call YTS and EZTV in parallel and return paginated results", async () => {
      mockYtsService.searchMovies.mockResolvedValue({
        movies: [ytsMovie, ytsMovie2],
        movieCount: 2,
      });
      mockEztvService.searchTorrents.mockResolvedValue({
        torrents: [],
        torrentsCount: 0,
      });
      mockPrisma.movie.findMany.mockResolvedValue([mockDbMovie, mockDbMovie2]);
      mockPrisma.movie.count.mockResolvedValue(2);

      const result = await service.search(
        { query: "matrix", page: 1, limit: 20 },
        "user-id",
      );

      expect(mockYtsService.searchMovies).toHaveBeenCalled();
      expect(mockEztvService.searchTorrents).toHaveBeenCalled();
      expect(mockMovieCacheService.cacheYtsMovies).toHaveBeenCalledWith([ytsMovie, ytsMovie2]);
      expect(mockMovieCacheService.cacheEztvTorrents).toHaveBeenCalledWith([]);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("should mark watched movies", async () => {
      mockYtsService.searchMovies.mockResolvedValue({
        movies: [ytsMovie],
        movieCount: 1,
      });
      mockEztvService.searchTorrents.mockResolvedValue({
        torrents: [],
        torrentsCount: 0,
      });
      mockPrisma.movie.findMany.mockResolvedValue([mockDbMovie]);
      mockPrisma.movie.count.mockResolvedValue(1);
      mockMovieQueryService.getWatchedMovieIds.mockResolvedValue(
        new Set([mockDbMovie.id]),
      );

      const result = await service.search(
        { query: "matrix", page: 1, limit: 20 },
        "user-id",
      );

      expect(result.data[0].watched).toBe(true);
    });

    it("should skip watched status when no userId is provided", async () => {
      mockYtsService.searchMovies.mockResolvedValue({
        movies: [ytsMovie],
        movieCount: 1,
      });
      mockEztvService.searchTorrents.mockResolvedValue({
        torrents: [],
        torrentsCount: 0,
      });
      mockPrisma.movie.findMany.mockResolvedValue([mockDbMovie]);
      mockPrisma.movie.count.mockResolvedValue(1);

      const result = await service.search(
        { query: "matrix", page: 1, limit: 20 },
        undefined,
      );

      expect(result.data[0].watched).toBe(false);
      expect(mockMovieQueryService.getWatchedMovieIds).not.toHaveBeenCalled();
    });

    it("should handle YTS failure gracefully", async () => {
      mockYtsService.searchMovies.mockResolvedValue({
        movies: [],
        movieCount: 0,
      });
      mockEztvService.searchTorrents.mockResolvedValue({
        torrents: [eztvTorrent],
        torrentsCount: 1,
      });
      mockPrisma.movie.findMany.mockResolvedValue([]);
      mockPrisma.movie.count.mockResolvedValue(0);

      const result = await service.search(
        { query: "test", page: 1, limit: 20 },
        "user-id",
      );

      expect(result.data).toEqual([]);
    });

    it("should delegate caching to MovieCacheService", async () => {
      mockYtsService.searchMovies.mockResolvedValue({
        movies: [ytsMovie],
        movieCount: 1,
      });
      mockEztvService.searchTorrents.mockResolvedValue({
        torrents: [],
        torrentsCount: 0,
      });
      mockPrisma.movie.findMany.mockResolvedValue([mockDbMovie]);
      mockPrisma.movie.count.mockResolvedValue(1);

      await service.search({ query: "matrix", page: 1, limit: 20 }, "user-id");

      expect(mockMovieCacheService.cacheYtsMovies).toHaveBeenCalledWith([ytsMovie]);
      expect(mockMovieCacheService.cacheEztvTorrents).toHaveBeenCalledWith([]);
    });

    it("should apply sorting and filtering via MovieQueryService", async () => {
      mockYtsService.searchMovies.mockResolvedValue({
        movies: [],
        movieCount: 0,
      });
      mockEztvService.searchTorrents.mockResolvedValue({
        torrents: [],
        torrentsCount: 0,
      });
      mockPrisma.movie.findMany.mockResolvedValue([]);
      mockPrisma.movie.count.mockResolvedValue(0);

      await service.search(
        {
          query: "matrix",
          sortBy: "rating",
          order: "desc",
          genre: "Action",
          minRating: 7,
          page: 1,
          limit: 20,
        },
        "user-id",
      );

      expect(mockMovieQueryService.buildWhereClause).toHaveBeenCalledWith(
        expect.objectContaining({ genre: "Action", minRating: 7 }),
      );
      expect(mockMovieQueryService.buildOrderBy).toHaveBeenCalledWith("rating", "desc");
    });

    it("should calculate pagination correctly", async () => {
      mockYtsService.searchMovies.mockResolvedValue({
        movies: [],
        movieCount: 0,
      });
      mockEztvService.searchTorrents.mockResolvedValue({
        torrents: [],
        torrentsCount: 0,
      });
      mockPrisma.movie.findMany.mockResolvedValue([mockDbMovie, mockDbMovie2]);
      mockPrisma.movie.count.mockResolvedValue(50);

      const result = await service.search({ page: 2, limit: 20 }, "user-id");

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(3);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("findById", () => {
    it("should return movie detail with torrents and comment count", async () => {
      const movieWithTorrents = {
        ...mockDbMovie,
        torrents: [mockDbTorrent],
      };
      mockPrisma.movie.findUnique.mockResolvedValue(movieWithTorrents);
      mockPrisma.comment.count.mockResolvedValue(5);
      mockPrisma.watchHistory.findUnique.mockResolvedValue(null);
      mockPrisma.watchlist.findUnique.mockResolvedValue(null);

      const result = await service.findById(mockDbMovie.id, "user-id");

      expect(result.title).toBe("The Matrix");
      expect(result.commentsCount).toBe(5);
      expect(result.watched).toBe(false);
      expect(result.torrents).toHaveLength(1);
      expect(result.subtitles).toEqual([]);
    });

    it("should throw NotFoundException for nonexistent movie", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue(null);

      await expect(
        service.findById("nonexistent-id", "user-id"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should mark movie as watched when user has seen it", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue({
        ...mockDbMovie,
        torrents: [],
      });
      mockYtsService.searchMovies.mockResolvedValue({ movies: [], movieCount: 0 });
      mockPrisma.comment.count.mockResolvedValue(0);
      mockPrisma.watchHistory.findUnique.mockResolvedValue({
        id: "wh-1",
        userId: "user-id",
        movieId: mockDbMovie.id,
      });
      mockPrisma.watchlist.findUnique.mockResolvedValue(null);

      const result = await service.findById(mockDbMovie.id, "user-id");

      expect(result.watched).toBe(true);
    });

    it("should lazy-load torrents from YTS when none exist", async () => {
      const movieNoTorrents = { ...mockDbMovie, torrents: [] };
      const movieWithTorrents = { ...mockDbMovie, torrents: [mockDbTorrent] };
      mockPrisma.movie.findUnique
        .mockResolvedValueOnce(movieNoTorrents)
        .mockResolvedValueOnce(movieWithTorrents);
      mockYtsService.searchMovies.mockResolvedValue({
        movies: [
          {
            imdb_code: "tt0133093",
            title: "The Matrix",
            torrents: [
              {
                hash: mockDbTorrent.hash,
                quality: "1080p",
                seeds: 150,
                peers: 25,
                size_bytes: 2684354560,
              },
            ],
            year: 1999,
            rating: 8.7,
            genres: ["Action"],
            medium_cover_image: null,
            background_image: null,
            summary: "",
          },
        ],
        movieCount: 1,
      });
      mockPrisma.comment.count.mockResolvedValue(0);
      mockPrisma.watchHistory.findUnique.mockResolvedValue(null);
      mockPrisma.watchlist.findUnique.mockResolvedValue(null);

      const result = await service.findById(mockDbMovie.id, "user-id");

      expect(mockYtsService.searchMovies).toHaveBeenCalledWith(
        expect.objectContaining({ query: "tt0133093" }),
      );
      expect(mockMovieCacheService.cacheYtsMovies).toHaveBeenCalled();
      expect(result.torrents).toHaveLength(1);
    });

    it("should enrich movie with TMDb data when missing", async () => {
      const movieWithoutTmdb = {
        ...mockDbMovie2,
        tmdbId: null,
        director: null,
        cast: [],
        summary: null,
        runtime: null,
        torrents: [],
      };
      mockPrisma.movie.findUnique.mockResolvedValue(movieWithoutTmdb);
      mockYtsService.searchMovies.mockResolvedValue({ movies: [], movieCount: 0 });
      mockTmdbService.findByImdbId.mockResolvedValue(tmdbMovieDetail);
      mockPrisma.movie.update.mockResolvedValue({
        ...movieWithoutTmdb,
        tmdbId: 603,
        director: "Lana Wachowski",
        producer: "Joel Silver",
        cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
        summary: tmdbMovieDetail.overview,
        runtime: 136,
        posterUrl: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
        genres: ["Action", "Science Fiction"],
        torrents: [],
      });
      mockPrisma.comment.count.mockResolvedValue(0);
      mockPrisma.watchHistory.findUnique.mockResolvedValue(null);
      mockPrisma.watchlist.findUnique.mockResolvedValue(null);

      const result = await service.findById(mockDbMovie2.id, "user-id");

      expect(mockTmdbService.findByImdbId).toHaveBeenCalledWith("tt1375666");
      expect(mockPrisma.movie.update).toHaveBeenCalled();
      expect(result.director).toBe("Lana Wachowski");
    });

    it("should handle TMDb enrichment failure gracefully", async () => {
      const movieWithoutTmdb = {
        ...mockDbMovie2,
        tmdbId: null,
        director: null,
        cast: [],
        torrents: [],
      };
      mockPrisma.movie.findUnique.mockResolvedValue(movieWithoutTmdb);
      mockYtsService.searchMovies.mockResolvedValue({ movies: [], movieCount: 0 });
      mockTmdbService.findByImdbId.mockResolvedValue(null);
      mockPrisma.comment.count.mockResolvedValue(0);
      mockPrisma.watchHistory.findUnique.mockResolvedValue(null);
      mockPrisma.watchlist.findUnique.mockResolvedValue(null);

      const result = await service.findById(mockDbMovie2.id, "user-id");

      expect(result.title).toBe("Inception");
      expect(result.director).toBeNull();
    });
  });
});
