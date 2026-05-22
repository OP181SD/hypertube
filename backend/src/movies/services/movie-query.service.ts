import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";
import type { SearchParams } from "../interfaces";

@Injectable()
export class MovieQueryService {
  constructor(private readonly prisma: PrismaService) {}

  buildWhereClause(params: SearchParams): Prisma.MovieWhereInput {
    const where: Prisma.MovieWhereInput = {
      NOT: [{ posterUrl: null }, { posterUrl: "" }],
      torrents: { some: {} },
    };

    if (params.query) {
      where.AND = [
        {
          OR: [
            { title: { contains: params.query, mode: "insensitive" } },
            { director: { contains: params.query, mode: "insensitive" } },
          ],
        },
      ];
    }

    if (params.genre) {
      where.genres = { has: params.genre };
    }

    if (params.minRating != null) {
      where.imdbRating = { gte: params.minRating };
    }

    if (params.minYear != null || params.maxYear != null) {
      where.year = {
        ...(params.minYear != null ? { gte: params.minYear } : {}),
        ...(params.maxYear != null ? { lte: params.maxYear } : {}),
      };
    }

    return where;
  }

  buildOrderBy(
    sortBy?: string,
    order?: string,
  ): Prisma.MovieOrderByWithRelationInput {
    const direction = order === "asc" ? "asc" : "desc";

    switch (sortBy) {
      case "year":
        return { year: direction };
      case "rating":
        return { imdbRating: direction };
      case "title":
        return { title: order === "desc" ? "desc" : "asc" };
      default:
        return { title: "asc" };
    }
  }

  mapSortField(sortBy?: string): string | undefined {
    switch (sortBy) {
      case "rating":
        return "rating";
      case "year":
        return "year";
      case "title":
        return "title";
      case "seeds":
        return "seeds";
      default:
        return undefined;
    }
  }

  async getWatchedMovieIds(
    userId: string,
    movieIds: string[],
  ): Promise<Set<string>> {
    if (movieIds.length === 0) return new Set();

    const watched = await this.prisma.watchHistory.findMany({
      where: { userId, movieId: { in: movieIds } },
      select: { movieId: true },
    });

    return new Set(watched.map((w) => w.movieId));
  }

  async getWatchlistMovieIds(
    userId: string,
    movieIds: string[],
  ): Promise<Set<string>> {
    if (movieIds.length === 0) return new Set();

    const watchlisted = await this.prisma.watchlist.findMany({
      where: { userId, movieId: { in: movieIds } },
      select: { movieId: true },
    });

    return new Set(watchlisted.map((w) => w.movieId));
  }
}
