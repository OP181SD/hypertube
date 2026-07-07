import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { YtsMovie, EztvTorrent, SeriesShow } from "../interfaces";
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
    constructor(private readonly prisma: PrismaService) { }
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
                        posterUrl: yts.medium_cover_image?.trim() || null,
                        backdropUrl: yts.background_image?.trim() || null,
                        summary: yts.summary || null,
                        genres: yts.genres ?? [],
                        mediaType: "movie",
                    },
                    update: {
                        imdbRating: yts.rating,
                        posterUrl: yts.medium_cover_image?.trim() || undefined,
                        backdropUrl: yts.background_image?.trim() || undefined,
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
                            torrentFileUrl: torrent.url,
                        },
                        update: {
                            seeds: torrent.seeds,
                            peers: torrent.peers,
                            torrentFileUrl: torrent.url,
                        },
                    });
                }
            }
            catch (error) {
                this.logger.warn(`Failed to cache YTS movie ${yts.imdb_code}`, (error as Error).message);
            }
        }
    }
    async cacheSeries(show: SeriesShow & {
        imdbId: string;
    }, torrents: EztvTorrent[]): Promise<void> {
        if (torrents.length === 0)
            return;
        try {
            const movie = await this.prisma.movie.upsert({
                where: { imdbId: show.imdbId },
                create: {
                    imdbId: show.imdbId,
                    title: show.name,
                    year: show.year,
                    imdbRating: show.rating,
                    posterUrl: show.posterUrl,
                    backdropUrl: show.backdropUrl,
                    genres: show.genres,
                    tmdbId: show.tmdbId,
                    mediaType: "series",
                },
                update: {
                    posterUrl: show.posterUrl,
                    imdbRating: show.rating,
                },
            });
            await this.upsertEpisodes(movie.id, torrents);
        }
        catch (error) {
            this.logger.warn(`Failed to cache series ${show.imdbId}`, (error as Error).message);
        }
    }
    async addSeriesEpisodes(movieId: string, torrents: EztvTorrent[]): Promise<void> {
        try {
            await this.upsertEpisodes(movieId, torrents);
        }
        catch (error) {
            this.logger.warn(`Failed to add episodes for ${movieId}`, (error as Error).message);
        }
    }
    private async upsertEpisodes(movieId: string, torrents: EztvTorrent[]): Promise<void> {
        for (const eztv of torrents) {
            await this.prisma.torrent.upsert({
                where: { hash: eztv.hash },
                create: {
                    movieId,
                    hash: eztv.hash,
                    quality: this.extractQuality(eztv.filename),
                    episodeLabel: this.extractEpisode(eztv.title || eztv.filename),
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
        }
    }
    private extractEpisode(text: string): string | null {
        const match = text.match(/S(\d{1,2})E(\d{1,2})/i);
        if (!match)
            return null;
        return `S${match[1].padStart(2, "0")}E${match[2].padStart(2, "0")}`;
    }
    private buildMagnetUrl(hash: string, title: string): string {
        const encodedTitle = encodeURIComponent(title);
        const trackers = YTS_TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join("");
        return `magnet:?xt=urn:btih:${hash}&dn=${encodedTitle}${trackers}`;
    }
    private extractQuality(filename: string): string {
        const match = filename.match(/(\d{3,4}p)/i);
        return match ? match[1] : "unknown";
    }
}
