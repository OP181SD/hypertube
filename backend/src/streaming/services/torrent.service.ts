import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  DownloadProgress,
  TorrentEngine,
  TorrentFile,
} from "../interfaces";
import torrentStream from "torrent-stream";

const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".webm", ".mov"];

interface ActiveTorrent {
  engine: TorrentEngine;
  file: TorrentFile | null;
  progress: number;
  ready: boolean;
}

@Injectable()
export class TorrentService implements OnModuleDestroy {
  private readonly logger = new Logger(TorrentService.name);
  private readonly activeTorrents = new Map<string, ActiveTorrent>();
  private readonly storagePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.storagePath =
      this.configService.get<string>("STORAGE_PATH") ?? "./data/videos";
  }

  async startDownload(magnetUrl: string, torrentId: string): Promise<void> {
    if (this.activeTorrents.has(torrentId)) {
      return;
    }

    await this.prisma.torrent.update({
      where: { id: torrentId },
      data: { downloadStatus: "downloading" },
    });

    const engine = torrentStream(magnetUrl, {
      path: this.storagePath,
    }) as unknown as TorrentEngine;

    const active: ActiveTorrent = {
      engine,
      file: null,
      progress: 0,
      ready: false,
    };

    this.activeTorrents.set(torrentId, active);

    engine.on("ready", () => {
      const videoFile = this.selectVideoFile(engine.files);

      if (!videoFile) {
        this.logger.warn(`No video file found in torrent ${torrentId}`);
        this.prisma.torrent
          .update({
            where: { id: torrentId },
            data: { downloadStatus: "error" },
          })
          .catch((e: Error) =>
            this.logger.error("Failed to update torrent status", e.message),
          );
        return;
      }

      active.file = videoFile;

      // Deselect non-video files
      for (const f of engine.files) {
        if (f !== videoFile) {
          f.deselect();
        }
      }

      videoFile.select();

      this.prisma.torrent
        .update({
          where: { id: torrentId },
          data: {
            filePath: `${this.storagePath}/${videoFile.path}`,
          },
        })
        .catch((e: Error) =>
          this.logger.error("Failed to update file path", e.message),
        );
    });

    engine.on("idle", () => {
      active.ready = true;
      active.progress = 100;
      this.prisma.torrent
        .update({
          where: { id: torrentId },
          data: { downloadStatus: "ready" },
        })
        .catch((e: Error) =>
          this.logger.error("Failed to update download status", e.message),
        );
    });
  }

  getProgress(torrentId: string): DownloadProgress {
    const active = this.activeTorrents.get(torrentId);

    if (!active) {
      return {
        status: "idle",
        progress: 0,
        filePath: null,
        fileSize: null,
      };
    }

    return {
      status: active.ready ? "ready" : "downloading",
      progress: active.progress,
      filePath: active.file
        ? `${this.storagePath}/${active.file.path}`
        : null,
      fileSize: active.file?.length ?? null,
    };
  }

  isReady(torrentId: string): boolean {
    const active = this.activeTorrents.get(torrentId);
    if (!active?.file) return false;
    // Consider ready if download started and we have a file
    // (torrent-stream can stream from the beginning)
    return active.file.length > 0;
  }

  getFile(torrentId: string): TorrentFile | null {
    return this.activeTorrents.get(torrentId)?.file ?? null;
  }

  destroyEngine(torrentId: string): void {
    const active = this.activeTorrents.get(torrentId);
    if (!active) return;

    active.engine.destroy();
    this.activeTorrents.delete(torrentId);
  }

  onModuleDestroy(): void {
    for (const [id, active] of this.activeTorrents) {
      active.engine.destroy();
      this.activeTorrents.delete(id);
    }
  }

  private selectVideoFile(files: TorrentFile[]): TorrentFile | null {
    const videoFiles = files.filter((f) => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      return VIDEO_EXTENSIONS.includes(ext);
    });

    if (videoFiles.length === 0) return null;

    // Return the largest video file
    return videoFiles.reduce((largest, current) =>
      current.length > largest.length ? current : largest,
    );
  }
}
