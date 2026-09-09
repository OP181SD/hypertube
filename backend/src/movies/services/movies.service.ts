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
import type { Movie, Torrent, Prisma } from "@prisma/client";

type MovieWithTorrents = Movie & { torrents: Torrent[] };

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private moviesDiscoveryPopularPage = 1;
  private moviesDiscoveryTopRatedPage = 1;
  private moviesDiscoveryPhase: "popular" | "top_rated" = "popular";
  private seriesDiscoveryPopularPage = 1;
  private seriesDiscoveryTopRatedPage = 1;
  private seriesDiscoveryPhase: "popular" | "top_rated" = "popular";

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
    const target = 7;
    const result: HeroMovie[] = [];
    const seenTmdbIds = new Set<number>();
    const startPage = Math.floor(Math.random() * 5) + 1;

    for (let offset = 0; offset < 5 && result.length < target; offset++) {
      const page = ((startPage - 1 + offset) % 5) + 1;
      const tmdbMovies = await this.tmdbService.getPopularMovies(page);

      for (const m of tmdbMovies) {
        if (result.length >= target || seenTmdbIds.has(m.tmdbId)) continue;
        seenTmdbIds.add(m.tmdbId);

        let movie = await this.prisma.movie.findFirst({ where: { tmdbId: m.tmdbId } });

        if (movie && (await this.movieHasTorrents(movie.id))) {
          // Already streamable: refresh TMDb popularity/metadata, skip YTS.
          await this.refreshTmdbFields(movie.id, m);
          result.push({ ...m, id: movie.id });
          continue;
        }

        const details = await this.tmdbService.getMovieDetails(m.tmdbId);
        const realImdbId = details?.imdb_id;
        if (!realImdbId) continue;

        const ytsResult = await this.ytsService.searchMovies({
          query: realImdbId,
          limit: 1,
        });
        if (ytsResult.movies.length === 0) continue;

        await this.movieCache.cacheYtsMovies(ytsResult.movies);
        movie = await this.prisma.movie.findFirst({ where: { tmdbId: m.tmdbId } });
        if (!movie) {
          movie = await this.prisma.movie.findUnique({ where: { imdbId: realImdbId } });
        }
        if (!movie || !(await this.movieHasTorrents(movie.id))) continue;

        // Keep hero metadata (backdrop) from TMDb while ensuring a playable row.
        await this.prisma.movie.update({
          where: { id: movie.id },
          data: {
            tmdbId: m.tmdbId,
            title: m.title,
            posterUrl: m.posterUrl ?? undefined,
            backdropUrl: m.backdropUrl,
            summary: m.overview || undefined,
            imdbRating: m.rating,
            popularity: m.popularity ?? 0,
          },
        });

        result.push({ ...m, id: movie.id });
      }
    }

    return result;
  }

  async getFrontpageTop(limit = 5): Promise<HeroMovie[]> {
    const catalog = await this.tmdbService.getPopularMoviesCatalog(1);
    const result: HeroMovie[] = [];

    for (const m of catalog) {
      if (result.length >= limit) break;

      let movie = await this.prisma.movie.findFirst({ where: { tmdbId: m.tmdbId } });
      if (!movie) {
        const details = await this.tmdbService.getMovieDetails(m.tmdbId);
        const imdbId = details?.imdb_id;
        if (!imdbId) continue;

        // Concurrent GET /movies (React Strict Mode, two tabs) both miss
        // findUnique then both create — unique on imdb_id. Upsert is atomic.
        movie = await this.prisma.movie.upsert({
          where: { imdbId },
          create: {
            imdbId,
            title: m.title,
            year: m.year,
            imdbRating: m.rating,
            posterUrl: m.posterUrl,
            backdropUrl: m.backdropUrl || null,
            summary: m.overview || null,
            tmdbId: m.tmdbId,
            genres: m.genres,
            popularity: m.popularity ?? 0,
            mediaType: "movie",
          },
          update: {
            tmdbId: m.tmdbId,
            posterUrl: m.posterUrl ?? undefined,
            backdropUrl: m.backdropUrl || undefined,
            popularity: m.popularity ?? 0,
          },
        });
      }

      result.push({
        id: movie.id,
        tmdbId: m.tmdbId,
        title: m.title,
        year: m.year,
        rating: m.rating,
        genres: m.genres,
        posterUrl: m.posterUrl ?? movie.posterUrl,
        backdropUrl: m.backdropUrl || movie.backdropUrl || "",
        overview: m.overview,
        popularity: m.popularity ?? 0,
      });
    }

    return result;
  }

  async getPopularSeries(): Promise<HeroMovie[]> {
    const target = 7;
    const result: HeroMovie[] = [];
    const seenTmdbIds = new Set<number>();
    const startPage = Math.floor(Math.random() * 5) + 1;

    for (let offset = 0; offset < 5 && result.length < target; offset++) {
      const page = ((startPage - 1 + offset) % 5) + 1;
      const tmdbShows = await this.tmdbService.getPopularSeriesHero(page);

      for (const s of tmdbShows) {
        if (result.length >= target || seenTmdbIds.has(s.tmdbId)) continue;
        seenTmdbIds.add(s.tmdbId);

        let movie = await this.prisma.movie.findFirst({ where: { tmdbId: s.tmdbId } });

        if (movie && (await this.movieHasTorrents(movie.id))) {
          // Already streamable: refresh TMDb popularity/metadata, skip EZTV.
          await this.refreshTmdbFields(movie.id, s);
          result.push({ ...s, id: movie.id });
          continue;
        }

        const realImdbId = await this.tmdbService.getTvImdbId(s.tmdbId);
        if (!realImdbId) continue;

        const eztv = await this.eztvService.searchTorrents({
          imdbId: realImdbId.replace(/^tt/, ""),
        });
        if (eztv.torrents.length === 0) continue;

        await this.movieCache.cacheSeries(
          {
            tmdbId: s.tmdbId,
            name: s.title,
            year: s.year,
            posterUrl: s.posterUrl,
            backdropUrl: s.backdropUrl,
            rating: s.rating,
            genres: s.genres,
            popularity: s.popularity ?? 0,
            imdbId: realImdbId,
          },
          eztv.torrents,
        );

        movie = await this.prisma.movie.findUnique({ where: { imdbId: realImdbId } });
        if (!movie || !(await this.movieHasTorrents(movie.id))) continue;

        await this.prisma.movie.update({
          where: { id: movie.id },
          data: {
            tmdbId: s.tmdbId,
            title: s.title,
            posterUrl: s.posterUrl ?? undefined,
            backdropUrl: s.backdropUrl,
            summary: s.overview || undefined,
            imdbRating: s.rating,
            popularity: s.popularity ?? 0,
            mediaType: "series",
          },
        });

        result.push({ ...s, id: movie.id });
      }
    }

    return result;
  }

  /** Update stored TMDb fields without re-fetching torrents. */
  private async refreshTmdbFields(
    movieId: string,
    meta: {
      tmdbId: number;
      title?: string | null;
      posterUrl?: string | null;
      backdropUrl?: string | null;
      overview?: string | null;
      rating?: number | null;
      popularity?: number | null;
    },
  ): Promise<void> {
    await this.prisma.movie.update({
      where: { id: movieId },
      data: {
        tmdbId: meta.tmdbId,
        title: meta.title || undefined,
        posterUrl: meta.posterUrl ?? undefined,
        backdropUrl: meta.backdropUrl || undefined,
        summary: meta.overview || undefined,
        imdbRating: meta.rating ?? undefined,
        popularity: meta.popularity ?? 0,
      },
    });
  }

  private async movieHasTorrents(movieId: string): Promise<boolean> {
    const torrent = await this.prisma.torrent.findFirst({
      where: { movieId },
      select: { id: true },
    });
    return torrent != null;
  }

  async search(params: SearchParams, userId?: string): Promise<PaginatedMovies> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    if (params.genre === "Science Fiction") {
      params.genre = "Sci-Fi";
    }

    const isPopularBrowse = !params.query && !params.sortBy;
    if (isPopularBrowse) {
      return this.searchByTmdbPopularOrder(params, userId);
    }

    const where = this.movieQuery.buildWhereClause(params);
    // Search without an explicit sort: alphabetical.
    const effectiveSortBy =
      params.query && !params.sortBy ? "title" : params.sortBy;
    const orderBy = this.movieQuery.buildOrderBy(
      effectiveSortBy,
      params.order ?? (effectiveSortBy === "title" ? "asc" : undefined),
    );

    let discoveryHasMore: boolean;

    if (params.mediaType === "series") {
      const cachedCount = await this.prisma.movie.count({ where });
      const needed = page * limit;

      if (cachedCount < needed) {
        const ensured = await this.ensureSeriesCatalog(params, page, limit, where);
        discoveryHasMore = ensured.discoveryHasMore;
      } else {
        discoveryHasMore = true;
        void this.ensureSeriesCatalog(params, page + 1, limit, where).catch((err: Error) => {
          this.logger.warn(`Background series prefetch failed: ${err.message}`);
        });
      }
    } else {
      const cachedCount = await this.prisma.movie.count({ where });
      const needed = page * limit;

      if (cachedCount < needed) {
        const ensured = await this.ensureMoviesCatalog(params, page, limit, where);
        discoveryHasMore = ensured.discoveryHasMore;
      } else {
        discoveryHasMore = true;
        void this.ensureMoviesCatalog(params, page + 1, limit, where).catch((err: Error) => {
          this.logger.warn(`Background movies prefetch failed: ${err.message}`);
        });
      }
    }

    const [movies, total] = await Promise.all([
      this.prisma.movie.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.movie.count({ where }),
    ]);

    return this.toPaginatedMovies(movies, page, limit, total, discoveryHasMore, userId);
  }

  private async searchByTmdbPopularOrder(
    params: SearchParams,
    userId?: string,
  ): Promise<PaginatedMovies> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const where = this.movieQuery.buildWhereClause(params);
    const needed = page * limit;
    const collected: Movie[] = [];
    const seenTmdbIds = new Set<number>();

    let phase: "popular" | "top_rated" = "popular";
    let tmdbPage = 1;
    let pagesScanned = 0;
    const maxPages = 40;
    let sourceExhausted = false;

    while (collected.length < needed && pagesScanned < maxPages) {
      const isSeries = params.mediaType === "series";
      let tmdbIds: number[];

      if (isSeries) {
        const shows =
          phase === "popular"
            ? await this.tmdbService.getPopularSeries(tmdbPage)
            : await this.tmdbService.getTopRatedSeries(tmdbPage);
        if (shows.length === 0) {
          if (phase === "popular") {
            phase = "top_rated";
            tmdbPage = 1;
            continue;
          }
          sourceExhausted = true;
          break;
        }
        await this.cacheSeriesShows(shows);
        tmdbIds = shows.map((s) => s.tmdbId);
      } else {
        const movies =
          phase === "popular"
            ? await this.tmdbService.getPopularMoviesCatalog(tmdbPage)
            : await this.tmdbService.getTopRatedMoviesCatalog(tmdbPage);
        if (movies.length === 0) {
          if (phase === "popular") {
            phase = "top_rated";
            tmdbPage = 1;
            continue;
          }
          sourceExhausted = true;
          break;
        }
        await this.cacheMoviesFromTmdb(movies);
        tmdbIds = movies.map((m) => m.tmdbId);
      }

      pagesScanned += 1;
      const orderedIds = tmdbIds.filter((id) => !seenTmdbIds.has(id));
      for (const id of orderedIds) seenTmdbIds.add(id);

      if (orderedIds.length > 0) {
        const rows = await this.prisma.movie.findMany({
          where: { ...where, tmdbId: { in: orderedIds } },
        });
        const byTmdbId = new Map(
          rows.filter((r) => r.tmdbId != null).map((r) => [r.tmdbId!, r]),
        );
        for (const tmdbId of orderedIds) {
          const row = byTmdbId.get(tmdbId);
          if (row) collected.push(row);
          if (collected.length >= needed) break;
        }
      }

      tmdbPage += 1;
    }

    const start = (page - 1) * limit;
    const movies = collected.slice(start, start + limit);
    // Full page + TMDb not exhausted ⇒ more to load on scroll.
    const discoveryHasMore = movies.length === limit && !sourceExhausted;

    return this.toPaginatedMovies(
      movies,
      page,
      limit,
      start + movies.length + (discoveryHasMore ? 1 : 0),
      discoveryHasMore,
      userId,
    );
  }

  private async toPaginatedMovies(
    movies: Movie[],
    page: number,
    limit: number,
    total: number,
    discoveryHasMore: boolean,
    userId?: string,
  ): Promise<PaginatedMovies> {
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
      hasMore: page < totalPages || discoveryHasMore,
    };
  }

  private async ensureMoviesCatalog(
    params: SearchParams,
    page: number,
    limit: number,
    where: Prisma.MovieWhereInput,
  ): Promise<{ discoveryHasMore: boolean }> {
    if (params.query) {
      const [ytsResult, tmdbHits] = await Promise.all([
        this.ytsService.searchMovies({
          query: params.query,
          genre: params.genre?.toLowerCase().replace(" ", "-"),
          sortBy: this.movieQuery.mapSortField(params.sortBy),
          order: params.order ?? "desc",
          minRating: params.minRating,
          page,
          limit,
        }),
        this.tmdbService.searchMovies(params.query),
      ]);
      await this.movieCache.cacheYtsMovies(ytsResult.movies);
      await this.cacheMoviesFromTmdb(tmdbHits);
      return { discoveryHasMore: false };
    }

    const needed = page * limit;
    const maxPagesThisCall = 15;
    let discoveryHasMore = false;
    let pagesScanned = 0;

    while (pagesScanned < maxPagesThisCall) {
      const count = await this.prisma.movie.count({ where });
      if (count >= needed) {
        discoveryHasMore = true;
        break;
      }

      let tmdbMovies: Awaited<ReturnType<TmdbService["getPopularMoviesCatalog"]>>;

      if (this.moviesDiscoveryPhase === "popular") {
        const tmdbPage = this.moviesDiscoveryPopularPage;
        tmdbMovies = await this.tmdbService.getPopularMoviesCatalog(tmdbPage);
        this.moviesDiscoveryPopularPage = tmdbPage + 1;
        if (tmdbMovies.length === 0) {
          this.moviesDiscoveryPhase = "top_rated";
          continue;
        }
      } else {
        const tmdbPage = this.moviesDiscoveryTopRatedPage;
        tmdbMovies = await this.tmdbService.getTopRatedMoviesCatalog(tmdbPage);
        this.moviesDiscoveryTopRatedPage = tmdbPage + 1;
        if (tmdbMovies.length === 0) {
          discoveryHasMore = false;
          break;
        }
      }

      pagesScanned += 1;
      await this.cacheMoviesFromTmdb(tmdbMovies);
      discoveryHasMore = true;
    }

    const finalCount = await this.prisma.movie.count({ where });
    if (finalCount > needed) {
      return { discoveryHasMore: true };
    }
    return { discoveryHasMore };
  }

  private async cacheMoviesFromTmdb(
    movies: Awaited<ReturnType<TmdbService["getPopularMoviesCatalog"]>>,
  ): Promise<void> {
    await Promise.all(
      movies.map(async (m) => {
        const existing = await this.prisma.movie.findFirst({
          where: { tmdbId: m.tmdbId },
          select: { id: true, mediaType: true },
        });
        if (
          existing?.mediaType === "movie" &&
          (await this.movieHasTorrents(existing.id))
        ) {
          await this.refreshTmdbFields(existing.id, m);
          return;
        }

        const details = await this.tmdbService.getMovieDetails(m.tmdbId);
        const imdbId = details?.imdb_id;
        if (!imdbId) return;

        const byImdb = await this.prisma.movie.findUnique({
          where: { imdbId },
          select: { id: true, mediaType: true },
        });
        if (
          byImdb?.mediaType === "movie" &&
          (await this.movieHasTorrents(byImdb.id))
        ) {
          await this.refreshTmdbFields(byImdb.id, m);
          return;
        }

        const ytsResult = await this.ytsService.searchMovies({
          query: imdbId,
          limit: 1,
        });
        if (ytsResult.movies.length === 0) return;

        await this.movieCache.cacheYtsMovies(ytsResult.movies);

        const movie =
          (await this.prisma.movie.findUnique({ where: { imdbId } })) ??
          (await this.prisma.movie.findFirst({ where: { tmdbId: m.tmdbId } }));
        if (!movie) return;

        await this.prisma.movie.update({
          where: { id: movie.id },
          data: {
            tmdbId: m.tmdbId,
            title: m.title,
            posterUrl: m.posterUrl ?? undefined,
            backdropUrl: m.backdropUrl || undefined,
            summary: m.overview || undefined,
            imdbRating: m.rating,
            popularity: m.popularity ?? 0,
            mediaType: "movie",
          },
        });
      }),
    );
  }

  private async cacheSeriesShows(
    shows: Awaited<ReturnType<TmdbService["searchSeries"]>>,
  ): Promise<void> {
    await Promise.all(
      shows.map(async (show) => {
        const imdbId = await this.tmdbService.getTvImdbId(show.tmdbId);
        if (!imdbId) return;

        const existing = await this.prisma.movie.findUnique({
          where: { imdbId },
          select: { id: true, mediaType: true },
        });
        // Already streamable: refresh TMDb popularity/metadata, skip EZTV.
        if (
          existing?.mediaType === "series" &&
          (await this.movieHasTorrents(existing.id))
        ) {
          await this.refreshTmdbFields(existing.id, {
            tmdbId: show.tmdbId,
            title: show.name,
            posterUrl: show.posterUrl,
            backdropUrl: show.backdropUrl,
            overview: null,
            rating: show.rating,
            popularity: show.popularity,
          });
          return;
        }

        const eztv = await this.eztvService.searchTorrents({
          imdbId: imdbId.replace(/^tt/, ""),
        });
        await this.movieCache.cacheSeries({ ...show, imdbId }, eztv.torrents);
      }),
    );
  }

  private async ensureSeriesCatalog(
    params: SearchParams,
    page: number,
    limit: number,
    where: Prisma.MovieWhereInput,
  ): Promise<{ discoveryHasMore: boolean }> {
    if (params.query) {
      const shows = await this.tmdbService.searchSeries(params.query);
      await this.cacheSeriesShows(shows);
      return { discoveryHasMore: false };
    }

    const needed = page * limit;
    const maxPagesThisCall = 15;
    let discoveryHasMore = false;
    let pagesScanned = 0;

    while (pagesScanned < maxPagesThisCall) {
      const count = await this.prisma.movie.count({ where });
      if (count >= needed) {
        discoveryHasMore = true;
        break;
      }

      let shows: Awaited<ReturnType<TmdbService["getPopularSeries"]>>;

      if (this.seriesDiscoveryPhase === "popular") {
        const tmdbPage = this.seriesDiscoveryPopularPage;
        shows = await this.tmdbService.getPopularSeries(tmdbPage);
        this.seriesDiscoveryPopularPage = tmdbPage + 1;
        if (shows.length === 0) {
          this.seriesDiscoveryPhase = "top_rated";
          continue;
        }
      } else {
        const tmdbPage = this.seriesDiscoveryTopRatedPage;
        shows = await this.tmdbService.getTopRatedSeries(tmdbPage);
        this.seriesDiscoveryTopRatedPage = tmdbPage + 1;
        if (shows.length === 0) {
          discoveryHasMore = false;
          break;
        }
      }

      pagesScanned += 1;
      await this.cacheSeriesShows(shows);
      discoveryHasMore = true;
    }

    const finalCount = await this.prisma.movie.count({ where });
    if (finalCount > needed) {
      return { discoveryHasMore: true };
    }
    return { discoveryHasMore };
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
      // Series: OpenSubtitles needs parent_imdb_id + S/E of the chosen episode.
      found.mediaType === "series"
        ? Promise.resolve([])
        : this.subtitleService.getAvailableSubtitles(enrichedMovie.imdbId),
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
          title: tmdbData.title || movie.title,
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
