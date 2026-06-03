import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { MovieListItem } from "../movies/interfaces";
import { ERROR_MESSAGES } from "../common/constants/error-messages";

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, movieId: string): Promise<{ message: string }> {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie) throw new NotFoundException(ERROR_MESSAGES.MOVIE_NOT_FOUND);

    await this.prisma.watchlist.upsert({
      where: { userId_movieId: { userId, movieId } },
      create: { userId, movieId },
      update: {},
    });

    return { message: "Added to watchlist" };
  }

  async remove(userId: string, movieId: string): Promise<void> {
    const entry = await this.prisma.watchlist.findUnique({
      where: { userId_movieId: { userId, movieId } },
    });

    if (!entry) throw new NotFoundException(ERROR_MESSAGES.NOT_IN_WATCHLIST);

    await this.prisma.watchlist.delete({
      where: { userId_movieId: { userId, movieId } },
    });
  }

  async getUserWatchlist(userId: string): Promise<MovieListItem[]> {
    const entries = await this.prisma.watchlist.findMany({
      where: { userId },
      include: {
        movie: {
          include: {
            watchHistory: {
              where: { userId },
              select: { movieId: true },
            },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    return entries.map(({ movie }) => ({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      imdbRating: movie.imdbRating,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      genres: movie.genres,
      watched: movie.watchHistory.length > 0,
      inWatchlist: true,
    }));
  }
}
