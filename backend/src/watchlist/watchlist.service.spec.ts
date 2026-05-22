import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { WatchlistService } from "./watchlist.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  movie: { findUnique: vi.fn() },
  watchlist: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
};

describe("WatchlistService", () => {
  let service: WatchlistService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchlistService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WatchlistService>(WatchlistService);
  });

  describe("add", () => {
    it("upserts the movie into the user's watchlist", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue({ id: "m1" });
      mockPrisma.watchlist.upsert.mockResolvedValue({});

      const result = await service.add("user-1", "m1");

      expect(result).toEqual({ message: "Added to watchlist" });
      expect(mockPrisma.watchlist.upsert).toHaveBeenCalledWith({
        where: { userId_movieId: { userId: "user-1", movieId: "m1" } },
        create: { userId: "user-1", movieId: "m1" },
        update: {},
      });
    });

    it("throws NotFoundException when the movie does not exist", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue(null);

      await expect(service.add("user-1", "ghost")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.watchlist.upsert).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("deletes an existing watchlist entry", async () => {
      mockPrisma.watchlist.findUnique.mockResolvedValue({ id: "w1" });
      mockPrisma.watchlist.delete.mockResolvedValue({});

      await service.remove("user-1", "m1");

      expect(mockPrisma.watchlist.delete).toHaveBeenCalledWith({
        where: { userId_movieId: { userId: "user-1", movieId: "m1" } },
      });
    });

    it("throws NotFoundException when the entry is not in the watchlist", async () => {
      mockPrisma.watchlist.findUnique.mockResolvedValue(null);

      await expect(service.remove("user-1", "m1")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.watchlist.delete).not.toHaveBeenCalled();
    });
  });

  describe("getUserWatchlist", () => {
    it("maps watchlist entries to movie list items", async () => {
      mockPrisma.watchlist.findMany.mockResolvedValue([
        {
          movie: {
            id: "m1",
            title: "Movie One",
            year: 2020,
            imdbRating: 7.5,
            posterUrl: "p1.jpg",
            backdropUrl: "b1.jpg",
            genres: ["Drama"],
            watchHistory: [{ movieId: "m1" }],
          },
        },
        {
          movie: {
            id: "m2",
            title: "Movie Two",
            year: 2021,
            imdbRating: 6.0,
            posterUrl: "p2.jpg",
            backdropUrl: null,
            genres: [],
            watchHistory: [],
          },
        },
      ]);

      const result = await service.getUserWatchlist("user-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "m1",
        title: "Movie One",
        year: 2020,
        imdbRating: 7.5,
        posterUrl: "p1.jpg",
        backdropUrl: "b1.jpg",
        genres: ["Drama"],
        watched: true,
        inWatchlist: true,
      });
    });

    it("marks a movie as not watched when it has no watch history", async () => {
      mockPrisma.watchlist.findMany.mockResolvedValue([
        {
          movie: {
            id: "m2",
            title: "Movie Two",
            year: 2021,
            imdbRating: 6.0,
            posterUrl: "p2.jpg",
            backdropUrl: null,
            genres: [],
            watchHistory: [],
          },
        },
      ]);

      const result = await service.getUserWatchlist("user-1");

      expect(result[0].watched).toBe(false);
      expect(result[0].inWatchlist).toBe(true);
    });

    it("returns an empty list when the watchlist is empty", async () => {
      mockPrisma.watchlist.findMany.mockResolvedValue([]);
      expect(await service.getUserWatchlist("user-1")).toEqual([]);
    });
  });
});
