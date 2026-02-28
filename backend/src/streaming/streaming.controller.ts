import {
  Controller,
  Get,
  Post,
  Param,
  Headers,
  ParseUUIDPipe,
  Res,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { StreamingService } from "./streaming.service";
import { Public } from "../common/decorators/public.decorator";

@Controller()
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

  constructor(private readonly streamingService: StreamingService) {}

  /**
   * Initiates the torrent download without serving video.
   * The frontend calls this on mount, then polls /status.
   */
  @Public()
  @Post("stream/:torrentId/start")
  async startStream(@Param("torrentId", ParseUUIDPipe) torrentId: string) {
    try {
      await this.streamingService.initiateStream(torrentId, "anonymous");
    } catch (e: any) {
      this.logger.warn(`[Start] ${e.message}`);
    }
    return { ok: true };
  }

  @Public()
  @Get("stream/:torrentId/status")
  async getStatus(@Param("torrentId", ParseUUIDPipe) torrentId: string) {
    return this.streamingService.getStreamStatus(torrentId);
  }

  @Public()
  @Get("stream/:torrentId")
  async stream(
    @Param("torrentId", ParseUUIDPipe) torrentId: string,
    @Headers("range") range: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const progress = await this.streamingService.getStreamStatus(torrentId).catch(() => {
      throw new NotFoundException("Torrent not found");
    });

    // File not yet identified — tell the client to retry
    if (!progress.filePath) {
      return reply.status(202).send({ message: "Stream not ready yet, please retry." });
    }

    try {
      const result = await this.streamingService.getVideoStream(torrentId, range);

      if (result.start != null && result.end != null && result.totalSize != null) {
        // Partial content — direct stream supports range requests
        return reply
          .status(206)
          .header("Content-Range", `bytes ${result.start}-${result.end}/${result.totalSize}`)
          .header("Accept-Ranges", "bytes")
          .header("Content-Length", result.fileSize ?? 0)
          .header("Content-Type", result.mimeType)
          .send(result.stream);
      }

      // Full or transcoded stream — no range support
      return reply
        .status(200)
        .header("Accept-Ranges", "none")
        .header("Content-Type", result.mimeType)
        .send(result.stream);

    } catch (error: any) {
      this.logger.error(`[Stream] ${error?.message}`);
      return reply.status(503).send({ message: "Stream temporarily unavailable" });
    }
  }

  @Public()
  @Get("subtitles/:movieId")
  async getSubtitles(
    @Param("movieId", ParseUUIDPipe) movieId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    try {
      const subtitles = await this.streamingService.getSubtitlesByMovieId(movieId);
      return reply.status(200).send(subtitles);
    } catch {
      return reply.status(200).send([]);
    }
  }

  @Public()
  @Get("subtitles/:movieId/:lang")
  async getSubtitleFile(
    @Param("movieId", ParseUUIDPipe) movieId: string,
    @Param("lang") lang: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    try {
      const { content } = await this.streamingService.getSubtitleFileByMovieId(movieId, lang);
      return reply
        .header("Content-Type", "text/vtt; charset=utf-8")
        .send(content);
    } catch {
      // Return a valid empty VTT — a 404 would make the browser throw NotFoundError
      return reply
        .status(200)
        .header("Content-Type", "text/vtt; charset=utf-8")
        .send("WEBVTT\n\n");
    }
  }
}
