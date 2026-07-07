import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { YtsService } from "./yts.service";
import { EztvService } from "./eztv.service";
import { TmdbService } from "./tmdb.service";
import { SubtitleService } from "../../streaming/services/subtitle.service";
import { MovieCacheService } from "./movie-cache.service";
import { MovieMapperService } from "./movie-mapper.service";
import { MovieQueryService } from "./movie-query.service";
import { ERROR_MESSAGES } from "../../common/constants/error-messages";
import type {
  PaginatedMovies,
  MovieDetail,
  SubtitleInfo,
  HeroMovie,
  SearchParams,
} from "../interfaces";
import type { Movie, Torrent } from "@prisma/client";

type MovieWithTorrents = Movie & { torrents: Torrent[] };

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ytsService: YtsService,
    private readonly eztvService: EztvService,
    private readonly tmdbService: TmdbService,
    private readonly subtitleService: SubtitleService,
    private readonly movieCache: MovieCacheService,
    private readonly movieMapper: MovieMapperService,
    private readonly movieQuery: MovieQueryService,
  ) {}

  async getPopular(): Promise<HeroMovie[]> {
    const page = Math.floor(Math.random() * 5) + 1;
    const tmdbMovies = await this.tmdbService.getPopularMovies(page);

    const result: HeroMovie[] = [];
    for (const m of tmdbMovies) {
      let movie = await this.prisma.movie.findFirst({ where: { tmdbId: m.tmdbId } });

      if (!movie) {
        const details = await this.tmdbService.getMovieDetails(m.tmdbId);
        const realImdbId = details?.imdb_id ?? `tmdb-${m.tmdbId}`;

        movie = await this.prisma.movie.upsert({
          where: { imdbId: realImdbId },
          create: {
            imdbId: realImdbId,
            title: m.title,
            year: m.year,
            imdbRating: m.rating,
            posterUrl: m.posterUrl,
            backdropUrl: m.backdropUrl,
            summary: m.overview,
            genres: m.genres,
            tmdbId: m.tmdbId,
          },
          update: {
            backdropUrl: m.backdropUrl,
            posterUrl: m.posterUrl,
            imdbRating: m.rating,
          },
        });
      }

      result.push({ ...m, id: movie.id });
    }
    return result;
  }

  async search(params: SearchParams, userId?: string): Promise<PaginatedMovies> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    if (params.genre === "Science Fiction") {
      params.genre = "Sci-Fi";
    }

    // Each library page maps to a single external source: movies → YTS,
    // series → EZTV. Default (no mediaType) keeps the movie source.
    if (params.mediaType === "series") {
      // Seed from TMDb (popular or searched TV shows) for a recognizable
      // catalogue with posters, then match each show to its EZTV episodes.
      const shows = params.query
        ? await this.tmdbService.searchSeries(params.query)
        : await this.tmdbService.getPopularSeries(page);

      await Promise.all(
        shows.map(async (show) => {
          const imdbId = await this.tmdbService.getTvImdbId(show.tmdbId);
          if (!imdbId) return;
          const eztv = await this.eztvService.searchTorrents({
            imdbId: imdbId.replace(/^tt/, ""),
          });
          await this.movieCache.cacheSeries({ ...show, imdbId }, eztv.torrents);
        }),
      );
    } else {
      const ytsResult = await this.ytsService.searchMovies({
        query: params.query,
        genre: params.genre?.toLowerCase().replace(" ", "-"),
        sortBy: this.movieQuery.mapSortField(params.sortBy),
        order: params.order,
        minRating: params.minRating,
        page,
        limit,
      });
      await this.movieCache.cacheYtsMovies(ytsResult.movies);
    }

    const where = this.movieQuery.buildWhereClause(params);
    // Subject requires results sorted by name when a search query is present
    const effectiveSortBy = params.query && !params.sortBy ? "title" : params.sortBy;
    const orderBy = this.movieQuery.buildOrderBy(effectiveSortBy, params.order);

    const [movies, total] = await Promise.all([
      this.prisma.movie.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.movie.count({ where }),
    ]);

    const movieIds = movies.map((m) => m.id);
    const [watchedMovieIds, watchlistMovieIds] = userId
      ? await Promise.all([
          this.movieQuery.getWatchedMovieIds(userId, movieIds),
          this.movieQuery.getWatchlistMovieIds(userId, movieIds),
        ])
      : [new Set<string>(), new Set<string>()];

    const totalPages = Math.ceil(total / limit);

    return {
      data: movies.map((movie) =>
        this.movieMapper.toListItem(movie, watchedMovieIds, watchlistMovieIds),
      ),
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async findById(id: string, userId: string): Promise<MovieDetail> {
    const found = await this.prisma.movie.findUnique({
      where: { id },
      include: { torrents: true },
    });

    if (!found) {
      throw new NotFoundException(ERROR_MESSAGES.MOVIE_NOT_FOUND);
    }

    let movie = found;

    // First time a series detail is opened, pull in its full episode list from
    // EZTV (the grid only seeds a partial page per show). Done once per series.
    if (
      found.mediaType === "series" &&
      !found.episodesFetched &&
      found.imdbId.startsWith("tt")
    ) {
      const torrents = await this.eztvService.getAllTorrentsByImdb(
        found.imdbId.replace(/^tt/, ""),
      );
      await this.movieCache.addSeriesEpisodes(found.id, torrents);
      await this.prisma.movie.update({
        where: { id },
        data: { episodesFetched: true },
      });
      movie =
        (await this.prisma.movie.findUnique({ where: { id }, include: { torrents: true } })) ??
        found;
    } else if (
      found.torrents.length === 0 &&
      found.imdbId &&
      !found.imdbId.startsWith("tmdb-")
    ) {
      const ytsResult = await this.ytsService.searchMovies({ query: found.imdbId, limit: 1 });
      if (ytsResult.movies.length > 0) {
        await this.movieCache.cacheYtsMovies(ytsResult.movies);
        movie =
          (await this.prisma.movie.findUnique({ where: { id }, include: { torrents: true } })) ??
          found;
      }
    }

    let enrichedMovie = movie;
    if (!movie.tmdbId) {
      enrichedMovie = await this.enrichWithTmdb(movie);
    }

    const [commentsCount, watchEntry, watchlistEntry, subtitleEntries] = await Promise.all([
      this.prisma.comment.count({ where: { movieId: id } }),
      this.prisma.watchHistory.findUnique({
        where: { userId_movieId: { userId, movieId: id } },
      }),
      this.prisma.watchlist.findUnique({
        where: { userId_movieId: { userId, movieId: id } },
      }),
      this.subtitleService.getAvailableSubtitles(enrichedMovie.imdbId),
    ]);

    const subtitles: SubtitleInfo[] = subtitleEntries.map((s) => ({
      lang: s.lang,
      label: s.label,
    }));

    return this.movieMapper.toDetail(
      enrichedMovie,
      commentsCount,
      !!watchEntry,
      !!watchlistEntry,
      subtitles,
    );
  }

  private async enrichWithTmdb(movie: MovieWithTorrents): Promise<MovieWithTorrents> {
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

      return await this.prisma.movie.update({
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
    } catch (error) {
      this.logger.error("TMDb enrichment failed", (error as Error).message);
      return movie;
    }
  }
}
