import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { Readable } from "node:stream";
import { PrismaService } from "../prisma/prisma.service";
import { TorrentService } from "./services/torrent.service";
import { TranscodingService } from "./services/transcoding.service";
import { HlsService, SECONDS_TO_START } from "./services/hls.service";
import { SubtitleService, type SubtitleEpisode } from "./services/subtitle.service";
import type { DownloadProgress, StreamResult, SubtitleEntry, TorrentFile } from "./interfaces";
import { ERROR_MESSAGES } from "../common/constants/error-messages";

const DEFAULT_MAX_RANGE_BYTES = 8 * 1024 * 1024;
const CONTIGUOUS_WAIT_MS = 45_000;
const HLS_MIME_TYPE = "application/vnd.apple.mpegurl";

@Injectable()
export class StreamingService {
    private readonly logger = new Logger(StreamingService.name);
    constructor(
        private readonly prisma: PrismaService,
        private readonly torrentService: TorrentService,
        private readonly transcodingService: TranscodingService,
        private readonly hlsService: HlsService,
        private readonly subtitleService: SubtitleService,
    ) { }
    async initiateStream(torrentId: string, userId: string): Promise<DownloadProgress> {
        const torrent = await this.prisma.torrent.findUnique({
            where: { id: torrentId },
        });
        if (!torrent)
            throw new NotFoundException(ERROR_MESSAGES.TORRENT_NOT_FOUND);
        await this.torrentService.ensurePlayback(torrentId);
        if (userId && userId !== "anonymous") {
            try {
                await this.prisma.watchHistory.upsert({
                    where: { userId_movieId: { userId, movieId: torrent.movieId } },
                    create: { userId, movieId: torrent.movieId },
                    update: { watchedAt: new Date() },
                });
            }
            catch (e) {
                this.logger.warn(`Could not update watch history: ${e instanceof Error ? e.message : e}`);
            }
        }
        await this.prisma.torrent.update({
            where: { id: torrentId },
            data: { lastAccessedAt: new Date() },
        });
        const progress = this.torrentService.getProgress(torrentId);
        return progress;
    }
    async getStreamStatus(torrentId: string): Promise<DownloadProgress> {
        const torrent = await this.prisma.torrent.findUnique({
            where: { id: torrentId },
        });
        if (!torrent)
            throw new NotFoundException(ERROR_MESSAGES.TORRENT_NOT_FOUND);
        await this.torrentService.ensurePlayback(torrentId);
        const progress = this.torrentService.getProgress(torrentId);
        const file = this.torrentService.getFile(torrentId);
        if (!file)
            return progress;
        if (await this.transcodingService.needsConversion(file.path, file.name))
            return this.getHlsStatus(torrentId, file, progress);
        return { ...progress, mimeType: this.getMimeType(file.name) };
    }

    private async getHlsStatus(
        torrentId: string,
        file: TorrentFile,
        progress: DownloadProgress,
    ): Promise<DownloadProgress> {
        if (progress.status !== "ready")
            return { ...progress, mimeType: HLS_MIME_TYPE };

        const hls = await this.hlsService.ensure(torrentId, file, progress.progress >= 100);
        if (hls.status === "failed") {
            this.logger.error(`[STATUS-API] HLS failed for ${torrentId}: ${hls.error}`);
            return { status: "error", progress: progress.progress, filePath: null, fileSize: null };
        }
        if (hls.status === "starting") {
            return {
                status: "converting",
                progress: Math.min(99, Math.round((hls.converted / SECONDS_TO_START) * 100)),
                filePath: null,
                fileSize: null,
                mimeType: HLS_MIME_TYPE,
                debug: progress.debug,
            };
        }
        return {
            status: "ready",
            progress: progress.progress,
            filePath: null,
            fileSize: null,
            mimeType: HLS_MIME_TYPE,
        };
    }

    async requiresHls(torrentId: string): Promise<boolean> {
        const file = this.torrentService.getFile(torrentId);
        return (
            file != null &&
            (await this.transcodingService.needsConversion(file.path, file.name))
        );
    }

    async getHlsPlaylist(torrentId: string, userId: string): Promise<string | null> {
        await this.initiateStream(torrentId, userId);
        const file = this.torrentService.getFile(torrentId);
        if (!file)
            throw new NotFoundException(ERROR_MESSAGES.VIDEO_NOT_READY);

        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline) {
            const live = this.torrentService.getProgress(torrentId);
            const hls = await this.hlsService.ensure(torrentId, file, live.progress >= 100);
            if (hls.status === "failed")
                return null;
            if (hls.segments > 0) {
                const playlist = await readFileOrNull(this.hlsService.playlistPath(file.path));
                if (playlist) {
                    const rewritten = playlist
                        .split("\n")
                        .map((line) => (line.startsWith("#") || line.trim() === "" ? line : basename(line)))
                        .join("\n");
                    return rewritten.includes("#EXT-X-START:")
                        ? rewritten
                        : rewritten.replace("#EXTM3U", "#EXTM3U\n#EXT-X-START:TIME-OFFSET=0");
                }
            }
            await sleep(250);
        }
        return null;
    }

    async getHlsSegment(torrentId: string, name: string): Promise<Readable> {
        const file = this.torrentService.getFile(torrentId);
        if (!file)
            throw new NotFoundException(ERROR_MESSAGES.VIDEO_NOT_READY);
        const path = this.hlsService.segmentPath(file.path, name);
        if (!path)
            throw new NotFoundException(ERROR_MESSAGES.VIDEO_NOT_READY);

        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
            const exists = await stat(path).then((s) => s.isFile()).catch(() => false);
            if (exists)
                return createReadStream(path);
            await sleep(250);
        }
        throw new NotFoundException(ERROR_MESSAGES.VIDEO_NOT_READY);
    }
    async getVideoStream(torrentId: string, rangeHeader?: string): Promise<StreamResult> {
        const file = this.torrentService.getFile(torrentId);
        if (!file)
            throw new NotFoundException(ERROR_MESSAGES.VIDEO_NOT_READY);
        if (await this.transcodingService.needsConversion(file.path, file.name))
            throw new NotFoundException(ERROR_MESSAGES.VIDEO_NOT_READY);
        const fileSize = file.length;
        const mimeType = this.getMimeType(file.name);
        const progress = this.torrentService.getProgress(torrentId);
        const playbackFloor = Math.max(
            progress.debug?.prefixBytes ?? 0,
            DEFAULT_MAX_RANGE_BYTES,
        );
        const range = this.parseRange(rangeHeader, fileSize, playbackFloor);
        const start = range.start;
        let end = range.end;

        const contiguousLen = await this.waitForContiguousBytes(torrentId, start, 1, CONTIGUOUS_WAIT_MS);
        if (contiguousLen === 0) {
            this.logger.warn(
                `[STREAM] still no bytes at offset ${start}, waiting for peers`,
            );
            const retry = await this.waitForContiguousBytes(torrentId, start, 1, CONTIGUOUS_WAIT_MS);
            if (retry === 0) {
                this.logger.warn(
                    `[STREAM] no contiguous bytes at offset ${start} after ${CONTIGUOUS_WAIT_MS * 2}ms — 503`,
                );
                throw new ServiceUnavailableException(ERROR_MESSAGES.VIDEO_NOT_READY);
            }
            return this.finishVideoStream(file, mimeType, fileSize, start, end, retry);
        }
        return this.finishVideoStream(file, mimeType, fileSize, start, end, contiguousLen);
    }

    private finishVideoStream(
        file: NonNullable<ReturnType<TorrentService["getFile"]>>,
        mimeType: string,
        fileSize: number,
        start: number,
        end: number,
        contiguousLen: number | null,
    ): StreamResult {
        if (contiguousLen != null && contiguousLen > 0) {
            const contiguousEnd = start + contiguousLen - 1;
            if (end > contiguousEnd) {
                end = contiguousEnd;
            }
        }

        const stream = file.createReadStream({ start, end });
        return { stream, mimeType, fileSize: end - start + 1, start, end, totalSize: fileSize };
    }

    /**
     * @returns contiguous bytes available, or `null` when unknown (treat as uncapped).
     */
    private async waitForContiguousBytes(
        torrentId: string,
        start: number,
        minBytes: number,
        timeoutMs: number,
    ): Promise<number | null> {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const len = this.torrentService.getContiguousLengthFrom(torrentId, start);
            if (len == null)
                return null;
            if (len >= minBytes)
                return len;
            if (Date.now() >= deadline)
                return len;
            await new Promise((resolve) => setTimeout(resolve, 150));
        }
    }
    async getSubtitlesByMovieId(
        movieId: string,
        episode?: SubtitleEpisode,
    ): Promise<SubtitleEntry[]> {
        const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
        if (!movie)
            throw new NotFoundException(ERROR_MESSAGES.MOVIE_NOT_FOUND);
        return this.subtitleService.getAvailableSubtitles(movie.imdbId, episode);
    }
    async getSubtitleFileByMovieId(
        movieId: string,
        lang: string,
        episode?: SubtitleEpisode,
    ): Promise<{
        content: string;
    }> {
        const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
        if (!movie)
            throw new NotFoundException(ERROR_MESSAGES.MOVIE_NOT_FOUND);
        const cached = await this.subtitleService.getCachedSubtitle(movieId, lang, episode);
        if (cached)
            return { content: cached };
        const subtitles = await this.subtitleService.getAvailableSubtitles(movie.imdbId, episode);
        const entry = subtitles.find((s) => s.lang === lang);
        if (!entry)
            throw new NotFoundException(ERROR_MESSAGES.SUBTITLE_NOT_FOUND(lang));
        const vttContent = await this.subtitleService.downloadSubtitle(
            entry.fileId,
            movieId,
            lang,
            episode,
        );
        return { content: vttContent ?? "WEBVTT\n\n" };
    }
    /**
     * @param playbackFloor Minimum size of the first chunk from byte 0 (complete moov+slack).
     */
    private parseRange(
        rangeHeader: string | undefined,
        fileSize: number,
        playbackFloor: number = DEFAULT_MAX_RANGE_BYTES,
    ): {
        start: number;
        end: number;
    } {
        if (fileSize <= 0)
            return { start: 0, end: 0 };
        const firstChunk = Math.min(fileSize, Math.max(playbackFloor, DEFAULT_MAX_RANGE_BYTES));
        if (!rangeHeader) {
            return { start: 0, end: firstChunk - 1 };
        }
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = Number.isFinite(parseInt(parts[0], 10)) ? parseInt(parts[0], 10) : 0;
        const safeStart = Math.max(0, Math.min(start, fileSize - 1));
        const hasExplicitEnd = parts[1] !== undefined && parts[1] !== "";
        let end = hasExplicitEnd
            ? parseInt(parts[1], 10)
            : safeStart + (safeStart === 0 ? firstChunk : DEFAULT_MAX_RANGE_BYTES) - 1;
        if (!Number.isFinite(end))
            end = safeStart + DEFAULT_MAX_RANGE_BYTES - 1;
        // Tiny probes (bytes=0-0 / 0-1) must stay tiny — browsers use them for Accept-Ranges.
        if (hasExplicitEnd && end - safeStart + 1 <= 16) {
            return { start: safeStart, end: Math.min(end, fileSize - 1) };
        }
        // Cap huge / open-ended ranges. From byte 0, chunkLimit includes full moov+slack.
        // Do not expand smaller explicit ranges (e.g. bytes=0-999) — only cap oversized ones.
        const chunkLimit = safeStart === 0 ? firstChunk : DEFAULT_MAX_RANGE_BYTES;
        if (!hasExplicitEnd || end - safeStart + 1 > chunkLimit)
            end = safeStart + chunkLimit - 1;
        end = Math.min(end, fileSize - 1);
        return { start: safeStart, end: Math.max(safeStart, end) };
    }
    private getMimeType(fileName: string): string {
        const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
        const map: Record<string, string> = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mkv": "video/x-matroska",
            ".avi": "video/x-msvideo",
        };
        return map[ext] ?? "application/octet-stream";
    }
}

async function readFileOrNull(path: string): Promise<string | null> {
    return readFile(path, "utf8").catch(() => null);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
