import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { YtsMovie, EztvTorrent } from "../interfaces";

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
export class MovieCacheService {
  private readonly logger = new Logger(MovieCacheService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cacheYtsMovies(movies: YtsMovie[]): Promise<void> {
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

        for (const torrent of yts.torrents ?? []) {
          const magnetUrl = this.buildMagnetUrl(torrent.hash, yts.title);
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

  async cacheEztvTorrents(torrents: EztvTorrent[]): Promise<void> {
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
