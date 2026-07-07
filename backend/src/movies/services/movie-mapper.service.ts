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
      posterUrl: this.normalizeUrl(movie.posterUrl),
      backdropUrl: this.normalizeUrl(movie.backdropUrl),
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
    const torrents = movie.torrents
      .map((t): TorrentItem => {
        const { season, episode } = this.parseEpisode(t.episodeLabel);
        return {
          id: t.id,
          quality: t.quality,
          episodeLabel: t.episodeLabel,
          season,
          episode,
          seeds: t.seeds,
          peers: t.peers,
          sizeBytes: t.sizeBytes.toString(),
          magnetUrl: t.magnetUrl,
        };
      })

      .sort((a, b) => (b.episodeLabel ?? "").localeCompare(a.episodeLabel ?? ""));

    return {
      id: movie.id,
      title: movie.title,
      imdbId: movie.imdbId,
      year: movie.year,
      imdbRating: movie.imdbRating,
      runtime: movie.runtime,
      summary: movie.summary,
      posterUrl: this.normalizeUrl(movie.posterUrl),
      backdropUrl: this.normalizeUrl(movie.backdropUrl),
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

  private parseEpisode(label: string | null): {
    season: number | null;
    episode: number | null;
  } {
    const match = label?.match(/^S(\d+)E(\d+)$/i);
    if (!match) return { season: null, episode: null };
    return { season: Number(match[1]), episode: Number(match[2]) };
  }

  private normalizeUrl(url: string | null | undefined): string | null {
    const trimmed = url?.trim();
    return trimmed ? trimmed : null;
  }
}
