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
    private readonly diskFiles = new Map<string, TorrentFile>();
    private readonly storagePath: string;
    constructor(private readonly prisma: PrismaService, private readonly configService: ConfigService) {
        this.storagePath = join(process.cwd(), this.configService.get<string>("STORAGE_PATH") ?? "./data/videos");
        this.logger.log(`[INIT] Storage path set to: ${this.storagePath}`);
    }
    async ensurePlayback(torrentId: string): Promise<void> {
        if (this.activeDownloads.has(torrentId) || this.diskFiles.has(torrentId))
            return;
        const torrent = await this.prisma.torrent.findUnique({ where: { id: torrentId } });
        if (!torrent)
            return;
        if (torrent.downloadStatus === "ready" &&
            torrent.filePath &&
            (await this.tryLoadDiskFile(torrentId, torrent.filePath))) {
            this.logger.log(`[DISK] Serving ${torrentId} from ${torrent.filePath}`);
            return;
        }
        if (torrent.downloadStatus === "ready" && torrent.filePath) {
            this.logger.warn(`[DISK] Ready torrent ${torrentId} missing on disk (${torrent.filePath}), re-downloading`);
        }
        const source: TorrentSource = torrent.torrentFileUrl
            ? { kind: "file", url: torrent.torrentFileUrl }
            : { kind: "magnet", uri: torrent.magnetUrl };
        await this.startDownload(torrentId, source);
    }
    async startDownload(torrentId: string, source: TorrentSource): Promise<void> {
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
            if (progress % 10 === 0) {
                this.logger.debug(`[PROGRESS] ${torrentId}: ${progress}%`);
            }
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
            this.activeDownloads.delete(torrentId);
            download.destroy();
        });
        await download.start();
    }
    isActive(torrentId: string): boolean {
        return this.activeDownloads.has(torrentId);
    }
    getProgress(torrentId: string): DownloadProgress {
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
        if (!active)
            return { status: "idle", progress: 0, filePath: null, fileSize: null };
        return {
            status: active.file ? "ready" : "downloading",
            progress: active.progress,
            filePath: active.file?.path ?? null,
            fileSize: active.file?.length ?? null,
        };
    }
    getFile(torrentId: string): TorrentFile | null {
        const disk = this.diskFiles.get(torrentId);
        if (disk)
            return disk;
        const active = this.activeDownloads.get(torrentId);
        return active?.file ?? null;
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
    }
    private async tryLoadDiskFile(torrentId: string, filePath: string): Promise<boolean> {
        try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile())
                return false;
            this.diskFiles.set(torrentId, createDiskTorrentFile(filePath, stat.size));
            return true;
        }
        catch {
            return false;
        }
    }
}
