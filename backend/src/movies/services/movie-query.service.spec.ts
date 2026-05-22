import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MovieQueryService } from "./movie-query.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { SearchParams } from "../interfaces";

const mockPrisma = {
  watchHistory: { findMany: vi.fn() },
  watchlist: { findMany: vi.fn() },
};

describe("MovieQueryService", () => {
  let service: MovieQueryService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieQueryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MovieQueryService>(MovieQueryService);
  });

  describe("buildWhereClause", () => {
    it("always excludes movies without a poster", () => {
      const where = service.buildWhereClause({} as SearchParams);
      expect(where.NOT).toEqual([{ posterUrl: null }, { posterUrl: "" }]);
    });

    it("adds a case-insensitive title/director search when a query is given", () => {
      const where = service.buildWhereClause({ query: "matrix" } as SearchParams);
      expect(where.AND).toEqual([
        {
          OR: [
            { title: { contains: "matrix", mode: "insensitive" } },
            { director: { contains: "matrix", mode: "insensitive" } },
          ],
        },
      ]);
    });

    it("filters by genre", () => {
      const where = service.buildWhereClause({ genre: "Action" } as SearchParams);
      expect(where.genres).toEqual({ has: "Action" });
    });

    it("filters by minimum rating", () => {
      const where = service.buildWhereClause({ minRating: 7 } as SearchParams);
      expect(where.imdbRating).toEqual({ gte: 7 });
    });

    it("treats a minRating of 0 as a real filter, not as absent", () => {
      const where = service.buildWhereClause({ minRating: 0 } as SearchParams);
      expect(where.imdbRating).toEqual({ gte: 0 });
    });

    it("filters by a year range with both bounds", () => {
      const where = service.buildWhereClause({
        minYear: 2000,
        maxYear: 2010,
      } as SearchParams);
      expect(where.year).toEqual({ gte: 2000, lte: 2010 });
    });

    it("filters by year with only a lower bound", () => {
      const where = service.buildWhereClause({ minYear: 2015 } as SearchParams);
      expect(where.year).toEqual({ gte: 2015 });
    });

    it("filters by year with only an upper bound", () => {
      const where = service.buildWhereClause({ maxYear: 1999 } as SearchParams);
      expect(where.year).toEqual({ lte: 1999 });
    });

    it("leaves optional filters unset when no params are given", () => {
      const where = service.buildWhereClause({} as SearchParams);
      expect(where.AND).toBeUndefined();
      expect(where.genres).toBeUndefined();
      expect(where.imdbRating).toBeUndefined();
      expect(where.year).toBeUndefined();
    });
  });

  describe("buildOrderBy", () => {
    it("sorts by year in the requested direction", () => {
      expect(service.buildOrderBy("year", "asc")).toEqual({ year: "asc" });
      expect(service.buildOrderBy("year", "desc")).toEqual({ year: "desc" });
    });

    it("sorts by rating mapped to the imdbRating column", () => {
      expect(service.buildOrderBy("rating", "desc")).toEqual({
        imdbRating: "desc",
      });
    });

    it("sorts by title in the requested direction", () => {
      expect(service.buildOrderBy("title", "asc")).toEqual({ title: "asc" });
      expect(service.buildOrderBy("title", "desc")).toEqual({ title: "desc" });
    });

    it("defaults to title ascending for an unknown sort field", () => {
      expect(service.buildOrderBy(undefined, undefined)).toEqual({
        title: "asc",
      });
      expect(service.buildOrderBy("popularity", "desc")).toEqual({
        title: "asc",
      });
    });

    it("defaults the direction to desc when order is not 'asc'", () => {
      expect(service.buildOrderBy("year", undefined)).toEqual({ year: "desc" });
    });
  });

  describe("mapSortField", () => {
    it("maps known sort fields to themselves", () => {
      expect(service.mapSortField("rating")).toBe("rating");
      expect(service.mapSortField("year")).toBe("year");
      expect(service.mapSortField("title")).toBe("title");
      expect(service.mapSortField("seeds")).toBe("seeds");
    });

    it("returns undefined for an unknown or missing sort field", () => {
      expect(service.mapSortField(undefined)).toBeUndefined();
      expect(service.mapSortField("popularity")).toBeUndefined();
    });
  });

  describe("getWatchedMovieIds", () => {
    it("returns an empty set without querying when no movie ids are given", async () => {
      const result = await service.getWatchedMovieIds("user-1", []);
      expect(result).toEqual(new Set());
      expect(mockPrisma.watchHistory.findMany).not.toHaveBeenCalled();
    });

    it("returns the set of watched movie ids for the user", async () => {
      mockPrisma.watchHistory.findMany.mockResolvedValue([
        { movieId: "m1" },
        { movieId: "m3" },
      ]);

      const result = await service.getWatchedMovieIds("user-1", [
        "m1",
        "m2",
        "m3",
      ]);

      expect(result).toEqual(new Set(["m1", "m3"]));
      expect(mockPrisma.watchHistory.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", movieId: { in: ["m1", "m2", "m3"] } },
        select: { movieId: true },
      });
    });
  });

  describe("getWatchlistMovieIds", () => {
    it("returns an empty set without querying when no movie ids are given", async () => {
      const result = await service.getWatchlistMovieIds("user-1", []);
      expect(result).toEqual(new Set());
      expect(mockPrisma.watchlist.findMany).not.toHaveBeenCalled();
    });

    it("returns the set of watchlisted movie ids for the user", async () => {
      mockPrisma.watchlist.findMany.mockResolvedValue([{ movieId: "m2" }]);

      const result = await service.getWatchlistMovieIds("user-1", ["m1", "m2"]);

      expect(result).toEqual(new Set(["m2"]));
      expect(mockPrisma.watchlist.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", movieId: { in: ["m1", "m2"] } },
        select: { movieId: true },
      });
    });
  });
});
