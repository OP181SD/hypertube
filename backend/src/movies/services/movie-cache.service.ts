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
                // Never list a movie with nothing to stream (same rule as series).
                if (!yts.torrents?.length) continue;

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
                    const existing = await this.prisma.torrent.findUnique({
                        where: { hash: torrent.hash },
                        select: { seeds: true, peers: true },
                    });
                    // YTS seed counts fluctuate and often spike to 0 on mirrors.
                    // Never downgrade a known-good count with a transient zero.
                    const seeds =
                        torrent.seeds > 0
                            ? torrent.seeds
                            : Math.max(existing?.seeds ?? 0, torrent.seeds);
                    const peers =
                        torrent.peers > 0
                            ? torrent.peers
                            : Math.max(existing?.peers ?? 0, torrent.peers);
                    await this.prisma.torrent.upsert({
                        where: { hash: torrent.hash },
                        create: {
                            movieId: movie.id,
                            hash: torrent.hash,
                            quality: torrent.quality,
                            source: "YTS",
                            seeds,
                            peers,
                            sizeBytes: BigInt(torrent.size_bytes),
                            magnetUrl,
                            torrentFileUrl: torrent.url,
                        },
                        update: {
                            seeds,
                            peers,
                            torrentFileUrl: torrent.url,
                        },
                    });
                }
                await this.refreshMaxSeeds(movie.id);
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
                    popularity: show.popularity ?? 0,
                },
                update: {
                    posterUrl: show.posterUrl,
                    imdbRating: show.rating,
                    popularity: show.popularity ?? 0,
                },
            });
            await this.upsertEpisodes(movie.id, torrents);
            await this.refreshMaxSeeds(movie.id);
        }
        catch (error) {
            this.logger.warn(`Failed to cache series ${show.imdbId}`, (error as Error).message);
        }
    }
    async addSeriesEpisodes(movieId: string, torrents: EztvTorrent[]): Promise<void> {
        try {
            await this.upsertEpisodes(movieId, torrents);
            await this.refreshMaxSeeds(movieId);
        }
        catch (error) {
            this.logger.warn(`Failed to add episodes for ${movieId}`, (error as Error).message);
        }
    }
    private async upsertEpisodes(movieId: string, torrents: EztvTorrent[]): Promise<void> {
        for (const eztv of torrents) {
            // The release name is spread over both fields: either can carry the
            // resolution the other omits.
            const quality = this.extractQuality(`${eztv.title} ${eztv.filename}`);
            await this.prisma.torrent.upsert({
                where: { hash: eztv.hash },
                create: {
                    movieId,
                    hash: eztv.hash,
                    quality,
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
                    quality,
                },
            });
        }
    }

    private async refreshMaxSeeds(movieId: string): Promise<void> {
        const agg = await this.prisma.torrent.aggregate({
            where: { movieId },
            _max: { seeds: true },
        });
        await this.prisma.movie.update({
            where: { id: movieId },
            data: { maxSeeds: agg._max.seeds ?? 0 },
        });
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
    /**
     * Release names state the resolution inconsistently: "1080p", a bare "720",
     * or nothing at all beside the codec. XviD is standard definition by
     * definition, so it is reported as such rather than as an unknown.
     */
    private extractQuality(name: string): string {
        const marker = /(\d{3,4})p\b/i.exec(name) ?? /\b(720|1080|2160)\b/.exec(name);
        if (marker)
            return `${marker[1]}p`;
        if (/xvid|divx/i.test(name))
            return "SD";
        return "unknown";
    }
}
