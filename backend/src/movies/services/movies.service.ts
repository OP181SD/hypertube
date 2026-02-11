import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { YtsService } from "./yts.service";
import { EztvService } from "./eztv.service";
import { TmdbService } from "./tmdb.service";
import { SubtitleService } from "../../streaming/services/subtitle.service";
import type {
  YtsMovie,
  EztvTorrent,
  PaginatedMovies,
  MovieDetail,
  MovieListItem,
  TorrentItem,
  SubtitleInfo,
  HeroMovie,
} from "../interfaces";
import type { Movie, Torrent, Prisma } from "@prisma/client";

type MovieWithTorrents = Movie & { torrents: Torrent[] };

export interface SearchParams {
  query?: string;
  genre?: string;
  sortBy?: string;
  order?: string;
  minRating?: number;
  minYear?: number;
  maxYear?: number;
  page?: number;
  limit?: number;
}

const YTS_TRACKERS = [
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.openbittorrent.com:80",
  "udp://tracker.coppersurfer.tk:6969",
  "udp://glotorrents.pw:6969/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://torrent.gresille.org:80/announce",
  "udp://p4p.arenabg.com:1337",
  "udp://tracker.leechers-paradise.org:6969",
];

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ytsService: YtsService,
    private readonly eztvService: EztvService,
    private readonly tmdbService: TmdbService,
    private readonly subtitleService: SubtitleService,
  ) {}

  async getPopular(): Promise<HeroMovie[]> {
    const page = Math.floor(Math.random() * 5) + 1;
    return this.tmdbService.getPopularMovies(page);
  }

  async search(params: SearchParams, userId?: string): Promise<PaginatedMovies> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    // Fetch from external APIs in parallel
    const [ytsResult, eztvResult] = await Promise.all([
      this.ytsService.searchMovies({
        query: params.query,
        genre: params.genre?.toLowerCase().replace(" ", "-"),
        sortBy: this.mapSortField(params.sortBy),
        order: params.order,
        minRating: params.minRating,
        page,
        limit,
      }),
      this.eztvService.searchTorrents({
        query: params.query,
        page,
        limit: Math.min(limit, 100),
      }),
    ]);

    // Cache results to database
    await this.cacheYtsMovies(ytsResult.movies);
    await this.cacheEztvTorrents(eztvResult.torrents);

    // Build DB query
    const where = this.buildWhereClause(params);
    const orderBy = this.buildOrderBy(params.sortBy, params.order);

    const [movies, total] = await Promise.all([
      this.prisma.movie.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.movie.count({ where }),
    ]);

    // Get watched movie IDs for this user (if authenticated)
    const watchedMovieIds = userId
      ? await this.getWatchedMovieIds(userId, movies.map((m) => m.id))
      : new Set<string>();

    const totalPages = Math.ceil(total / limit);

    return {
      data: movies.map((movie) => this.toListItem(movie, watchedMovieIds)),
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async findById(id: string, userId: string): Promise<MovieDetail> {
    const movie = await this.prisma.movie.findUnique({
      where: { id },
      include: { torrents: true },
    });

    if (!movie) {
      throw new NotFoundException("Movie not found");
    }

    // Lazy-enrich with TMDb data if missing
    let enrichedMovie = movie;
    if (!movie.tmdbId) {
      enrichedMovie = await this.enrichWithTmdb(movie);
    }

    const [commentsCount, watchEntry, subtitleEntries] = await Promise.all([
      this.prisma.comment.count({ where: { movieId: id } }),
      this.prisma.watchHistory.findUnique({
        where: { userId_movieId: { userId, movieId: id } },
      }),
      this.subtitleService.getAvailableSubtitles(enrichedMovie.imdbId),
    ]);

    const subtitles: SubtitleInfo[] = subtitleEntries.map((s) => ({
      lang: s.lang,
      label: s.label,
    }));

    return this.toDetail(enrichedMovie, commentsCount, !!watchEntry, subtitles);
  }

  private async enrichWithTmdb(
    movie: MovieWithTorrents,
  ): Promise<MovieWithTorrents> {
    try {
      const tmdbData = await this.tmdbService.findByImdbId(movie.imdbId);
      if (!tmdbData) return movie;

      const director =
        tmdbData.credits?.crew.find((c) => c.job === "Director")?.name ?? null;
      const producer =
        tmdbData.credits?.crew.find((c) => c.job === "Producer")?.name ?? null;
      const cast =
        tmdbData.credits?.cast
          .sort((a, b) => a.order - b.order)
          .slice(0, 5)
          .map((c) => c.name) ?? [];
      const genres = tmdbData.genres.map((g) => g.name);
      const posterUrl = this.tmdbService.getPosterUrl(tmdbData.poster_path);
      const backdropUrl = this.tmdbService.getBackdropUrl(tmdbData.backdrop_path);

      const updated = await this.prisma.movie.update({
        where: { id: movie.id },
        data: {
          tmdbId: tmdbData.id,
          summary: tmdbData.overview || movie.summary,
          runtime: tmdbData.runtime || movie.runtime,
          director,
          producer,
          cast,
          genres: genres.length > 0 ? genres : movie.genres,
          posterUrl: posterUrl || movie.posterUrl,
          backdropUrl: backdropUrl || movie.backdropUrl,
        },
        include: { torrents: true },
      });

      return updated;
    } catch (error) {
      this.logger.error("TMDb enrichment failed", (error as Error).message);
      return movie;
    }
  }

  private async cacheYtsMovies(movies: YtsMovie[]): Promise<void> {
    for (const yts of movies) {
      try {
        const movie = await this.prisma.movie.upsert({
          where: { imdbId: yts.imdb_code },
          create: {
            imdbId: yts.imdb_code,
            title: yts.title,
            year: yts.year,
            imdbRating: yts.rating,
            runtime: yts.runtime,
            posterUrl: yts.medium_cover_image,
            backdropUrl: yts.background_image || null,
            summary: yts.summary || null,
            genres: yts.genres ?? [],
          },
          update: {
            imdbRating: yts.rating,
            posterUrl: yts.medium_cover_image,
            backdropUrl: yts.background_image || undefined,
          },
        });

        // Cache torrents
        for (const torrent of yts.torrents ?? []) {
          const magnetUrl = this.buildMagnetUrl(
            torrent.hash,
            yts.title,
          );
          await this.prisma.torrent.upsert({
            where: { hash: torrent.hash },
            create: {
              movieId: movie.id,
              hash: torrent.hash,
              quality: torrent.quality,
              source: "YTS",
              seeds: torrent.seeds,
              peers: torrent.peers,
              sizeBytes: BigInt(torrent.size_bytes),
              magnetUrl,
            },
            update: {
              seeds: torrent.seeds,
              peers: torrent.peers,
            },
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to cache YTS movie ${yts.imdb_code}`,
          (error as Error).message,
        );
      }
    }
  }

  private async cacheEztvTorrents(torrents: EztvTorrent[]): Promise<void> {
    for (const eztv of torrents) {
      if (!eztv.imdb_id) continue;

      const imdbId = eztv.imdb_id.startsWith("tt")
        ? eztv.imdb_id
        : `tt${eztv.imdb_id}`;

      try {
        const movie = await this.prisma.movie.upsert({
          where: { imdbId },
          create: {
            imdbId,
            title: eztv.title.replace(/\s*S\d+E\d+.*$/i, "").trim(),
            posterUrl: eztv.large_screenshot || null,
          },
          update: {},
        });

        await this.prisma.torrent.upsert({
          where: { hash: eztv.hash },
          create: {
            movieId: movie.id,
            hash: eztv.hash,
            quality: this.extractQuality(eztv.filename),
            source: "EZTV",
            seeds: eztv.seeds,
            peers: eztv.peers,
            sizeBytes: BigInt(eztv.size_bytes),
            magnetUrl: eztv.magnet_url,
          },
          update: {
            seeds: eztv.seeds,
            peers: eztv.peers,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to cache EZTV torrent ${eztv.hash}`,
          (error as Error).message,
        );
      }
    }
  }

  private buildWhereClause(params: SearchParams): Prisma.MovieWhereInput {
    const where: Prisma.MovieWhereInput = {};

    if (params.query) {
      where.OR = [
        { title: { contains: params.query, mode: "insensitive" } },
        { summary: { contains: params.query, mode: "insensitive" } },
        { cast: { has: params.query } },
        { director: { contains: params.query, mode: "insensitive" } },
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

  private buildOrderBy(
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
        return { title: direction === "desc" ? "desc" : "asc" };
      default:
        return { imdbRating: "desc" };
    }
  }

  private mapSortField(sortBy?: string): string | undefined {
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

  private async getWatchedMovieIds(
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

  private toListItem(movie: Movie, watchedIds: Set<string>): MovieListItem {
    return {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      imdbRating: movie.imdbRating,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      genres: movie.genres,
      watched: watchedIds.has(movie.id),
    };
  }

  private toDetail(
    movie: MovieWithTorrents,
    commentsCount: number,
    watched: boolean,
    subtitles: SubtitleInfo[] = [],
  ): MovieDetail {
    const torrents = movie.torrents.map(
      (t): TorrentItem => ({
        id: t.id,
        quality: t.quality,
        seeds: t.seeds,
        peers: t.peers,
        sizeBytes: t.sizeBytes.toString(),
        magnetUrl: t.magnetUrl,
      }),
    );

    return {
      id: movie.id,
      title: movie.title,
      imdbId: movie.imdbId,
      year: movie.year,
      imdbRating: movie.imdbRating,
      runtime: movie.runtime,
      summary: movie.summary,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      genres: movie.genres,
      director: movie.director,
      producer: movie.producer,
      cast: movie.cast,
      torrents,
      subtitles,
      commentsCount,
      watched,
    };
  }

  private buildMagnetUrl(hash: string, title: string): string {
    const encodedTitle = encodeURIComponent(title);
    const trackers = YTS_TRACKERS.map(
      (t) => `&tr=${encodeURIComponent(t)}`,
    ).join("");
    return `magnet:?xt=urn:btih:${hash}&dn=${encodedTitle}${trackers}`;
  }

  private extractQuality(filename: string): string {
    const match = filename.match(/(\d{3,4}p)/i);
    return match ? match[1] : "unknown";
  }
}
