import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import type { DownloadProgress, TorrentFile } from "../interfaces";
import { createReadStream, promises as fs } from "node:fs";
import { basename, join } from "node:path";
import { TorrentDownload, type TorrentSource, type TorrentFileHandle, } from "../torrent/torrent-download";

interface ActiveDownload {
    download: TorrentDownload;
    progress: number;
    file: TorrentFile | null;
}

/** Reject "ready" disk files that are mostly sparse holes (common after partial DL). */
const MIN_DISK_ALLOCATION_RATIO = 0.95;

function toTorrentFile(handle: TorrentFileHandle): TorrentFile {
    return {
        name: handle.name,
        path: handle.path,
        length: handle.length,
        createReadStream: (opts) => handle.createReadStream(opts),
    };
}

function createDiskTorrentFile(absolutePath: string, size: number): TorrentFile {
    return {
        name: basename(absolutePath),
        path: absolutePath,
        length: size,
        createReadStream: (opts) => createReadStream(absolutePath, { start: opts?.start, end: opts?.end }),
    };
}

@Injectable()
export class TorrentService implements OnModuleDestroy {
    private readonly logger = new Logger("TorrentEngine");
    private readonly activeDownloads = new Map<string, ActiveDownload>();
    private readonly failedDownloads = new Map<string, "no_sources">();
    private readonly diskFiles = new Map<string, TorrentFile>();
    private readonly storagePath: string;

    constructor(private readonly prisma: PrismaService, private readonly configService: ConfigService) {
        this.storagePath = join(process.cwd(), this.configService.get<string>("STORAGE_PATH") ?? "./data/videos");
        this.logger.log(`[INIT] Storage path set to: ${this.storagePath}`);
    }

    async ensurePlayback(torrentId: string): Promise<void> {
        // One focused swarm: stop every other in-memory download so peers/CPU
        // are not shared across films (main cause of stalled 00:00 after switching).
        this.focusTorrent(torrentId);

        if (this.failedDownloads.has(torrentId))
            return;
        if (this.activeDownloads.has(torrentId) || this.diskFiles.has(torrentId)) {
            return;
        }
        this.logger.log(`[ENSURE] starting playback prep for ${torrentId}`);
        const torrent = await this.prisma.torrent.findUnique({ where: { id: torrentId } });
        if (!torrent) {
            this.logger.warn(`[ENSURE] torrent ${torrentId} not found in DB`);
            return;
        }
        if (torrent.downloadStatus === "ready" && torrent.filePath) {
            const diskOk = await this.tryLoadDiskFile(torrentId, torrent.filePath);
            if (diskOk) {
                this.logger.log(`[DISK] Serving ${torrentId} from ${torrent.filePath}`);
                return;
            }
            this.logger.warn(
                `[DISK] Ready torrent ${torrentId} missing or sparse on disk (${torrent.filePath}), re-downloading`,
            );
            void this.prisma.torrent
                .update({
                    where: { id: torrentId },
                    data: { downloadStatus: "idle", filePath: null },
                })
                .catch((err: Error) => {
                    this.logger.error(`[ERROR] Failed to reset sparse torrent: ${err.message}`);
                });
        }
        const source: TorrentSource = torrent.torrentFileUrl
            ? { kind: "file", url: torrent.torrentFileUrl }
            : { kind: "magnet", uri: torrent.magnetUrl };
        await this.startDownload(torrentId, source);
    }

    async startDownload(torrentId: string, source: TorrentSource): Promise<void> {
        this.focusTorrent(torrentId);
        if (this.failedDownloads.has(torrentId))
            return;
        if (this.activeDownloads.has(torrentId) || this.diskFiles.has(torrentId))
            return;
        this.logger.log(`[START] Initializing torrent: ${torrentId} (${source.kind})`);
        const download = new TorrentDownload(source, this.storagePath);
        const active: ActiveDownload = { download, progress: 0, file: null };
        this.activeDownloads.set(torrentId, active);
        download.on("ready", () => {
            const handle = download.getFile();
            if (!handle) {
                this.logger.error(`[ERROR] No video file found for ${torrentId}`);
                return;
            }
            active.file = toTorrentFile(handle);
            this.logger.log(`[READY] Video found: ${handle.name} (${(handle.length / 1024 / 1024).toFixed(2)} MB)`);
            void this.prisma.torrent
                .update({
                    where: { id: torrentId },
                    data: {
                        downloadStatus: "downloading",
                        filePath: handle.path,
                    },
                })
                .catch((err: Error) => {
                    this.logger.error(`[ERROR] Failed to update torrent status: ${err.message}`);
                });
        });
        download.on("progress", (progress: number) => {
            active.progress = progress;
        });
        download.on("complete", () => {
            active.progress = 100;
            const handle = download.getFile();
            if (handle) {
                active.file = toTorrentFile(handle);
                this.diskFiles.set(torrentId, active.file);
            }
            this.activeDownloads.delete(torrentId);
            download.destroy();
            this.logger.log(`[DONE] Download complete for ${torrentId}`);
            void this.prisma.torrent
                .update({
                    where: { id: torrentId },
                    data: { downloadStatus: "ready" },
                })
                .catch((err: Error) => {
                    this.logger.error(`[ERROR] Failed to mark torrent ready: ${err.message}`);
                });
        });
        download.on("error", (err: Error) => {
            this.logger.error(`[CRITICAL] Torrent engine error: ${err.message}`);
            this.markUnavailable(torrentId, err);
            this.activeDownloads.delete(torrentId);
            download.destroy();
        });
        // Do not await — status polls must return while metadata/announce runs.
        void download.start().catch((err: Error) => {
            this.logger.error(`[CRITICAL] start() failed for ${torrentId}: ${err.message}`);
            this.markUnavailable(torrentId, err);
            this.activeDownloads.delete(torrentId);
        });
    }

    isActive(torrentId: string): boolean {
        return this.activeDownloads.has(torrentId);
    }

    getProgress(torrentId: string): DownloadProgress {
        const failed = this.failedDownloads.get(torrentId);
        if (failed) {
            return { status: "error", progress: 0, filePath: null, fileSize: null, error: failed };
        }
        const disk = this.diskFiles.get(torrentId);
        if (disk) {
            return {
                status: "ready",
                progress: 100,
                filePath: disk.path,
                fileSize: disk.length,
            };
        }
        const active = this.activeDownloads.get(torrentId);
        if (!active) {
            return { status: "idle", progress: 0, filePath: null, fileSize: null };
        }
        if (active.download.awaitingMetadata) {
            return {
                status: "searching",
                progress: 0,
                filePath: null,
                fileSize: null,
                debug: { ...active.download.getPlaybackDebug(), canPlay: false },
            };
        }
        const debug = active.download.getPlaybackDebug();
        const contiguous = active.download.contiguousLengthFrom(0);
        // Moov alone is not enough: the browser's first open-ended Range is capped at
        // ~8MB. Opening earlier made it request the next range into a hole → hung 00:00.
        const FIRST_CHUNK_BYTES = 8 * 1024 * 1024;
        const need = Math.max(debug.prefixBytes ?? 0, FIRST_CHUNK_BYTES);
        const pumpable = contiguous >= need;
        const canPlay = Boolean(active.file) && debug.canPlay && pumpable;
        return {
            status: canPlay ? "ready" : "downloading",
            progress: active.progress,
            filePath: active.file?.path ?? null,
            fileSize: active.file?.length ?? null,
            debug: { ...debug, canPlay },
        };
    }

    getFile(torrentId: string): TorrentFile | null {
        const disk = this.diskFiles.get(torrentId);
        if (disk)
            return disk;
        const active = this.activeDownloads.get(torrentId);
        return active?.file ?? null;
    }

    /**
     * How many contiguous verified bytes are available from `fileOffset` in the video file.
     * Full file length when serving from disk / download finished.
     */
    getContiguousLengthFrom(torrentId: string, fileOffset: number): number | null {
        const disk = this.diskFiles.get(torrentId);
        if (disk)
            return Math.max(0, disk.length - fileOffset);
        const active = this.activeDownloads.get(torrentId);
        if (!active?.file)
            return null;
        return active.download.contiguousLengthFrom(fileOffset);
    }

    destroyEngine(torrentId: string): void {
        const active = this.activeDownloads.get(torrentId);
        if (!active)
            return;
        active.download.destroy();
        this.activeDownloads.delete(torrentId);
    }

    onModuleDestroy(): void {
        for (const [id, active] of this.activeDownloads) {
            active.download.destroy();
            this.activeDownloads.delete(id);
        }
        this.diskFiles.clear();
    }

    /** Stop every in-memory swarm except `torrentId` (disk-complete files are kept). */
    private focusTorrent(torrentId: string): void {
        for (const [id, active] of this.activeDownloads) {
            if (id === torrentId)
                continue;
            this.logger.log(`[FOCUS] stop swarm ${id} (focus=${torrentId})`);
            active.download.destroy();
            this.activeDownloads.delete(id);
        }
    }

    /** Magnet metadata never arrived — do not auto-retry on the next status poll. */
    private markUnavailable(torrentId: string, err: Error): void {
        if (!err.message.includes("No sources for magnet metadata"))
            return;
        this.failedDownloads.set(torrentId, "no_sources");
        this.logger.warn(`[UNAVAILABLE] ${torrentId} — no magnet metadata after search`);
    }

    private async tryLoadDiskFile(torrentId: string, filePath: string): Promise<boolean> {
        try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile() || stat.size <= 0)
                return false;
            // st.blocks is in 512-byte units on macOS/Linux. Sparse partial downloads
            // report full logical size but few allocated blocks — do not treat as ready.
            const allocated = (typeof stat.blocks === "number" ? stat.blocks : 0) * 512;
            if (allocated < stat.size * MIN_DISK_ALLOCATION_RATIO) {
                this.logger.warn(
                    `[DISK] reject sparse file ${filePath} ` +
                        `size=${stat.size} allocated≈${allocated} ` +
                        `(${((allocated / Math.max(stat.size, 1)) * 100).toFixed(1)}%)`,
                );
                return false;
            }
            this.diskFiles.set(torrentId, createDiskTorrentFile(filePath, stat.size));
            return true;
        }
        catch {
            return false;
        }
    }
}
