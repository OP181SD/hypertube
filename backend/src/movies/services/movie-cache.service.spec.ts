import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MovieCacheService } from "./movie-cache.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ytsMovie,
  eztvTorrent,
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
      // ytsMovie has 2 torrents
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

  describe("cacheEztvTorrents", () => {
    it("should upsert show and torrent to DB", async () => {
      mockPrisma.movie.upsert.mockResolvedValue({ ...mockDbMovie, id: "eztv-id" });
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.cacheEztvTorrents([eztvTorrent]);

      expect(mockPrisma.movie.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { imdbId: "tt0903747" },
        }),
      );
      expect(mockPrisma.torrent.upsert).toHaveBeenCalledTimes(1);
    });

    it("should prepend tt prefix when imdb_id lacks it", async () => {
      mockPrisma.movie.upsert.mockResolvedValue({ ...mockDbMovie, id: "eztv-id" });
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.cacheEztvTorrents([eztvTorrent]); // imdb_id is "0903747"

      const movieCall = mockPrisma.movie.upsert.mock.calls[0][0];
      expect(movieCall.where.imdbId).toBe("tt0903747");
    });

    it("should skip torrent when imdb_id is missing", async () => {
      const noImdb = { ...eztvTorrent, imdb_id: "" };

      await service.cacheEztvTorrents([noImdb]);

      expect(mockPrisma.movie.upsert).not.toHaveBeenCalled();
    });

    it("should extract quality from filename", async () => {
      mockPrisma.movie.upsert.mockResolvedValue({ ...mockDbMovie, id: "eztv-id" });
      mockPrisma.torrent.upsert.mockResolvedValue({});

      await service.cacheEztvTorrents([eztvTorrent]); // filename has 1080p

      const torrentCall = mockPrisma.torrent.upsert.mock.calls[0][0];
      expect(torrentCall.create.quality).toBe("1080p");
    });

    it("should log warning and continue on upsert error", async () => {
      mockPrisma.movie.upsert.mockRejectedValue(new Error("DB error"));

      await expect(
        service.cacheEztvTorrents([eztvTorrent]),
      ).resolves.toBeUndefined();
    });
  });
});
