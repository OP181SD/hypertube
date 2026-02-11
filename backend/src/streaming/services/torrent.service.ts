import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import type { DownloadProgress, TorrentEngine, TorrentFile } from "../interfaces";
import torrentStream from "torrent-stream";
import { join } from "path";

const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".webm", ".mov"];

interface ActiveTorrent {
  engine: TorrentEngine;
  file: TorrentFile | null;
  progress: number;
  ready: boolean;
}

@Injectable()
export class TorrentService implements OnModuleDestroy {
  private readonly logger = new Logger("TorrentEngine");
  private readonly activeTorrents = new Map<string, ActiveTorrent>();
  private readonly storagePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.storagePath = join(process.cwd(), this.configService.get<string>("STORAGE_PATH") ?? "./data/videos");
    this.logger.log(`[INIT] Storage path set to: ${this.storagePath}`);
  }

  async startDownload(magnetUrl: string, torrentId: string): Promise<void> {
    if (this.activeTorrents.has(torrentId)) return;

    this.logger.log(`[START] Initializing torrent: ${torrentId}`);
    
    const engine = torrentStream(magnetUrl, {
      path: this.storagePath,
      trackers: [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://9.rarbg.com:2810/announce',
        'udp://tracker.openbittorrent.com:80/announce',
      ],
    }) as unknown as TorrentEngine;

    const active: ActiveTorrent = { engine, file: null, progress: 0, ready: false };
    this.activeTorrents.set(torrentId, active);

    // LOG: Recherche de pairs
    const logPeers = setInterval(() => {
      const swarm = (engine as any).swarm;
      if (swarm) {
        this.logger.debug(`[STATUS] ${torrentId} - Peers: ${swarm.connections.length} - Wired: ${swarm.wired.length}`);
      }
    }, 5000);

    engine.on("torrent", () => {
      this.logger.log(`[METADATA] Metadata received for ${torrentId}.`);
    });

    engine.on("ready", () => {
      clearInterval(logPeers);
      const videoFile = this.selectVideoFile(engine.files);

      if (!videoFile) {
        this.logger.error(`[ERROR] No video file found for ${torrentId}`);
        return;
      }

      this.logger.log(`[READY] Video found: ${videoFile.name} (${(videoFile.length / 1024 / 1024).toFixed(2)} MB)`);
      active.file = videoFile;
      videoFile.select();
    });

    engine.on("download", (pieceIndex: any) => { // On met 'any' ici
      // On récupère le nombre total de pièces pour le calcul
      const totalPieces = (engine as any).torrent?.pieces?.length || 1;
      active.progress = Math.round(((pieceIndex + 1) / totalPieces) * 100);
      
      // On log toutes les 50 pièces pour ne pas saturer ton terminal
      if (pieceIndex % 50 === 0) {
        this.logger.debug(`[PROGRESS] ${torrentId}: ${active.progress}%`);
      }
    });

    engine.on("error", (err) => {
      this.logger.error(`[CRITICAL] Torrent engine error: ${err}`);
    });
  }

  getProgress(torrentId: string): DownloadProgress {
    const active = this.activeTorrents.get(torrentId);
    if (!active) return { status: "idle", progress: 0, filePath: null, fileSize: null };

    return {
      status: active.file ? "ready" : "downloading",
      progress: active.progress,
      filePath: active.file ? join(this.storagePath, active.file.path) : null,
      fileSize: active.file?.length ?? null,
    };
  }

  // ... (Garder le reste des méthodes identiques : destroyEngine, selectVideoFile, etc.)
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
