import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MovieCacheService } from "./movie-cache.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ytsMovie,
  eztvTorrent,
  seriesShow,
  mockDbMovie,
} from "../../../test/fixtures/movies.fixture";

const mockPrisma = {
  movie: {
    upsert: vi.fn(),
  },
  torrent: {
    upsert: vi.fn(),
  },
};

describe("MovieCacheService", () => {
  let service: MovieCacheService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieCacheService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MovieCacheService>(MovieCacheService);
  });

  describe("cacheYtsMovies", () => {
    it("should upsert movie and its torrents to DB", async () => {
      mockPrisma.movie.upsert.mockResolvedValue(mockDbMovie);
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.cacheYtsMovies([ytsMovie]);

      expect(mockPrisma.movie.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { imdbId: "tt0133093" },
          create: expect.objectContaining({
            imdbId: "tt0133093",
            title: "The Matrix",
            year: 1999,
          }),
        }),
      );

      expect(mockPrisma.torrent.upsert).toHaveBeenCalledTimes(2);
    });

    it("should build magnet URL with YTS trackers", async () => {
      mockPrisma.movie.upsert.mockResolvedValue(mockDbMovie);
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.cacheYtsMovies([ytsMovie]);

      const torrentCall = mockPrisma.torrent.upsert.mock.calls[0][0];
      expect(torrentCall.create.magnetUrl).toContain("magnet:?xt=urn:btih:");
      expect(torrentCall.create.magnetUrl).toContain("The%20Matrix");
      expect(torrentCall.create.magnetUrl).toContain("&tr=");
    });

    it("should skip torrents array when empty", async () => {
      const movieNoTorrents = { ...ytsMovie, torrents: [] };
      mockPrisma.movie.upsert.mockResolvedValue(mockDbMovie);

      await service.cacheYtsMovies([movieNoTorrents]);

      expect(mockPrisma.movie.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.torrent.upsert).not.toHaveBeenCalled();
    });

    it("should log warning and continue on upsert error", async () => {
      mockPrisma.movie.upsert.mockRejectedValue(new Error("DB error"));

      await expect(service.cacheYtsMovies([ytsMovie])).resolves.toBeUndefined();
    });
  });

  describe("cacheSeries", () => {
    const show = { ...seriesShow, imdbId: "tt0903747" };

    it("should upsert the series (TMDb metadata) and its episode torrents", async () => {
      mockPrisma.movie.upsert.mockResolvedValue({ ...mockDbMovie, id: "series-id" });
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.cacheSeries(show, [eztvTorrent]);

      const movieCall = mockPrisma.movie.upsert.mock.calls[0][0];
      expect(movieCall.where).toEqual({ imdbId: "tt0903747" });
      expect(movieCall.create.title).toBe(show.name);
      expect(movieCall.create.posterUrl).toBe(show.posterUrl);
      expect(movieCall.create.genres).toEqual(show.genres);
      expect(movieCall.create.mediaType).toBe("series");
      expect(mockPrisma.torrent.upsert).toHaveBeenCalledTimes(1);
    });

    it("should skip a show with no episodes (never list an empty series)", async () => {
      await service.cacheSeries(show, []);

      expect(mockPrisma.movie.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.torrent.upsert).not.toHaveBeenCalled();
    });

    it("should label torrents with the parsed episode (SxxExx)", async () => {
      mockPrisma.movie.upsert.mockResolvedValue({ ...mockDbMovie, id: "series-id" });
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.cacheSeries(show, [eztvTorrent]);

      const torrentCall = mockPrisma.torrent.upsert.mock.calls[0][0];
      expect(torrentCall.create.episodeLabel).toBe("S01E01");
      expect(torrentCall.create.quality).toBe("1080p");
      expect(torrentCall.create.source).toBe("EZTV");
    });

    it("should upsert every episode of the show", async () => {
      mockPrisma.movie.upsert.mockResolvedValue({ ...mockDbMovie, id: "series-id" });
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.cacheSeries(show, [
        eztvTorrent,
        { ...eztvTorrent, hash: "EP2_HASH_0000000000000000000000", title: "Breaking Bad S01E02 720p" },
      ]);

      expect(mockPrisma.movie.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.torrent.upsert).toHaveBeenCalledTimes(2);
    });

    it("should log warning and continue on upsert error", async () => {
      mockPrisma.movie.upsert.mockRejectedValue(new Error("DB error"));

      await expect(
        service.cacheSeries(show, [eztvTorrent]),
      ).resolves.toBeUndefined();
    });
  });

  describe("addSeriesEpisodes", () => {
    it("should upsert episode torrents for an existing series", async () => {
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.addSeriesEpisodes("series-id", [
        eztvTorrent,
        { ...eztvTorrent, hash: "EP2_0000000000000000000000", title: "Breaking Bad S01E02 720p" },
      ]);

      expect(mockPrisma.movie.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.torrent.upsert).toHaveBeenCalledTimes(2);
      const firstCreate = mockPrisma.torrent.upsert.mock.calls[0][0].create;
      expect(firstCreate.movieId).toBe("series-id");
      expect(firstCreate.episodeLabel).toBe("S01E01");
    });

    it("should swallow errors", async () => {
      mockPrisma.torrent.upsert.mockRejectedValue(new Error("DB error"));

      await expect(
        service.addSeriesEpisodes("series-id", [eztvTorrent]),
      ).resolves.toBeUndefined();
    });
  });
});
