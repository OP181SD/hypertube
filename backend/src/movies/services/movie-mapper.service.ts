import { Injectable } from "@nestjs/common";
import type { Movie, Torrent } from "@prisma/client";
import type {
  MovieListItem,
  MovieDetail,
  TorrentItem,
  SubtitleInfo,
} from "../interfaces";

type MovieWithTorrents = Movie & { torrents: Torrent[] };

@Injectable()
export class MovieMapperService {
  toListItem(
    movie: Movie,
    watchedIds: Set<string>,
    watchlistIds: Set<string>,
  ): MovieListItem {
    return {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      imdbRating: movie.imdbRating,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      genres: movie.genres,
      watched: watchedIds.has(movie.id),
      inWatchlist: watchlistIds.has(movie.id),
    };
  }

  toDetail(
    movie: MovieWithTorrents,
    commentsCount: number,
    watched: boolean,
    inWatchlist: boolean,
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
      inWatchlist,
    };
  }
}
