import {
  Controller,
  Get,
  Param,
  Headers,
  ParseUUIDPipe,
  Res,
  Logger,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { User } from "@prisma/client";
import { StreamingService } from "./streaming.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { SubtitleEntry } from "./interfaces";

@Controller()
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

  constructor(private readonly streamingService: StreamingService) {}

  @Get("stream/:torrentId/status")
  async getStatus(@Param("torrentId", ParseUUIDPipe) torrentId: string) {
    return this.streamingService.getStreamStatus(torrentId);
  }

  @Get("stream/:torrentId")
  async stream(
    @Param("torrentId", ParseUUIDPipe) torrentId: string,
    @CurrentUser() user: User,
    @Headers("range") range: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const progress = await this.streamingService.initiateStream(
      torrentId,
      user.id,
    );

    if (!progress.filePath) {
      return reply.status(202).send(progress);
    }

    try {
      const result = await this.streamingService.getVideoStream(torrentId, range);

      if (result.start != null && result.end != null && result.totalSize != null) {
        return reply
          .status(206)
          .header("Content-Range", `bytes ${result.start}-${result.end}/${result.totalSize}`)
          .header("Accept-Ranges", "bytes")
          .header("Content-Length", result.fileSize ?? 0)
          .header("Content-Type", result.mimeType)
          .send(result.stream);
      }

      return reply
        .status(200)
        .header("Accept-Ranges", "none")
        .header("Content-Type", result.mimeType)
        .send(result.stream);
    } catch (error) {
      this.logger.error(`[Stream] ${error instanceof Error ? error.message : error}`);
      return reply.status(503).send({ message: "Stream temporarily unavailable" });
    }
  }

  @Get("subtitles/:movieId")
  async getSubtitles(
    @Param("movieId", ParseUUIDPipe) movieId: string,
  ): Promise<SubtitleEntry[]> {
    return this.streamingService.getSubtitlesByMovieId(movieId);
  }

  @Get("subtitles/:movieId/:lang")
  async getSubtitleFile(
    @Param("movieId", ParseUUIDPipe) movieId: string,
    @Param("lang") lang: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { content } = await this.streamingService.getSubtitleFileByMovieId(movieId, lang);
    return reply
      .header("Content-Type", "text/vtt; charset=utf-8")
      .send(content);
  }
}
