import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TorrentService } from "./services/torrent.service";
import { TranscodingService } from "./services/transcoding.service";
import { SubtitleService } from "./services/subtitle.service";
import type { DownloadProgress, StreamResult, SubtitleEntry } from "./interfaces";

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly torrentService: TorrentService,
    private readonly transcodingService: TranscodingService,
    private readonly subtitleService: SubtitleService,
  ) {}

  async initiateStream(torrentId: string, userId: string): Promise<DownloadProgress> {
    const torrent = await this.prisma.torrent.findUnique({
      where: { id: torrentId },
    });

    if (!torrent) throw new NotFoundException("Torrent not found");

    // Always attempt startDownload — it's idempotent (no-op if already active in memory)
    await this.torrentService.startDownload(torrent.magnetUrl, torrentId);

    if (userId && userId !== "anonymous") {
      try {
        await this.prisma.watchHistory.upsert({
          where: { userId_movieId: { userId, movieId: torrent.movieId } },
          create: { userId, movieId: torrent.movieId },
          update: { watchedAt: new Date() },
        });
      } catch (e: any) {
        this.logger.warn(`Could not update watch history: ${e.message}`);
      }
    }

    await this.prisma.torrent.update({
      where: { id: torrentId },
      data: { lastAccessedAt: new Date() },
    });

    return this.torrentService.getProgress(torrentId);
  }

  async getStreamStatus(torrentId: string): Promise<DownloadProgress> {
    const torrent = await this.prisma.torrent.findUnique({
      where: { id: torrentId },
    });

    if (!torrent) throw new NotFoundException("Torrent not found");

    return this.torrentService.getProgress(torrentId);
  }

  async getVideoStream(torrentId: string, rangeHeader?: string): Promise<StreamResult> {
    const file = this.torrentService.getFile(torrentId);
    if (!file) throw new NotFoundException("Video file not available yet");

    if (this.transcodingService.needsTranscoding(file.name)) {
      // Pipe the torrent stream directly into ffmpeg — avoids seeking in incomplete files
      const inputStream = file.createReadStream();
      const stream = this.transcodingService.transcodeToMp4(inputStream, file.name);
      return { stream, mimeType: "video/mp4", fileSize: null };
    }

    // Direct stream with range support
    const fileSize = file.length;
    const mimeType = this.getMimeType(file.name);

    if (rangeHeader) {
      const { start, end } = this.parseRange(rangeHeader, fileSize);
      const stream = file.createReadStream({ start, end });
      return { stream, mimeType, fileSize: end - start + 1, start, end, totalSize: fileSize };
    }

    return { stream: file.createReadStream(), mimeType, fileSize };
  }

  async getSubtitlesByMovieId(movieId: string): Promise<SubtitleEntry[]> {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie) throw new NotFoundException("Movie not found");
    return this.subtitleService.getAvailableSubtitles(movie.imdbId);
  }

  async getSubtitleFileByMovieId(movieId: string, lang: string): Promise<{ content: string }> {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie) throw new NotFoundException("Movie not found");

    const subtitles = await this.subtitleService.getAvailableSubtitles(movie.imdbId);
    const entry = subtitles.find((s) => s.lang === lang);
    if (!entry) throw new NotFoundException(`Subtitle '${lang}' not found`);

    const vttContent = await this.subtitleService.downloadSubtitle(entry.fileId, movieId, lang);
    if (!vttContent) throw new NotFoundException("Failed to download subtitle");

    return { content: vttContent };
  }

  private parseRange(rangeHeader: string, fileSize: number): { start: number; end: number } {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    return {
      start: isNaN(start) ? 0 : start,
      end: isNaN(end) ? fileSize - 1 : Math.min(end, fileSize - 1),
    };
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
