import {
  Controller,
  Get,
  Param,
  Headers,
  ParseUUIDPipe,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { User } from "@prisma/client";
import { Res } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { StreamingService } from "./streaming.service";

@Controller()
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

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

    // If not ready yet, return status as JSON
    if (progress.status !== "ready" && !progress.filePath) {
      reply.status(202).send(progress);
      return;
    }

    // Get video stream
    const result = await this.streamingService.getVideoStream(
      torrentId,
      range,
    );

    if (result.start != null && result.end != null && result.totalSize != null) {
      // Partial content (range request)
      reply
        .status(206)
        .header("Content-Range", `bytes ${result.start}-${result.end}/${result.totalSize}`)
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", result.fileSize ?? 0)
        .header("Content-Type", result.mimeType)
        .send(result.stream);
    } else {
      // Full content
      reply
        .status(200)
        .header("Accept-Ranges", "bytes")
        .header("Content-Type", result.mimeType);

      if (result.fileSize != null) {
        reply.header("Content-Length", result.fileSize);
      }

      reply.send(result.stream);
    }
  }

  @Get("stream/:torrentId/status")
  async getStatus(
    @Param("torrentId", ParseUUIDPipe) torrentId: string,
  ) {
    return this.streamingService.getStreamStatus(torrentId);
  }

  @Get("subtitles/:movieId")
  async getSubtitles(
    @Param("movieId", ParseUUIDPipe) movieId: string,
  ) {
    return this.streamingService.getSubtitlesByMovieId(movieId);
  }

  @Get("subtitles/:movieId/:lang")
  async getSubtitleFile(
    @Param("movieId", ParseUUIDPipe) movieId: string,
    @Param("lang") lang: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { content } = await this.streamingService.getSubtitleFileByMovieId(
      movieId,
      lang,
    );

    reply
      .header("Content-Type", "text/vtt; charset=utf-8")
      .send(content);
  }
}
