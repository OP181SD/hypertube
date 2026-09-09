import {
  Controller,
  Get,
  Param,
  Query,
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
import type { SubtitleEpisode } from "./services/subtitle.service";

@Controller()
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

  constructor(private readonly streamingService: StreamingService) {}

  @Get("stream/:torrentId/status")
  async getStatus(@Param("torrentId", ParseUUIDPipe) torrentId: string) {
    return this.streamingService.getStreamStatus(torrentId);
  }

  @Get("stream/:torrentId/hls/index.m3u8")
  async hlsPlaylist(
    @Param("torrentId", ParseUUIDPipe) torrentId: string,
    @CurrentUser() user: User,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const playlist = await this.streamingService.getHlsPlaylist(torrentId, user.id);
    if (!playlist) {
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ message: "Conversion in progress" });
    }
    return reply
      .status(200)
      .header("Cache-Control", "no-store")
      .header("Content-Type", "application/vnd.apple.mpegurl")
      .send(playlist);
  }

  @Get("stream/:torrentId/hls/:segment")
  async hlsSegment(
    @Param("torrentId", ParseUUIDPipe) torrentId: string,
    @Param("segment") segment: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const stream = await this.streamingService.getHlsSegment(torrentId, segment);
    return reply
      .status(200)
      .header("Cache-Control", "no-store")
      .header("Content-Type", "video/mp4")
      .send(stream);
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

    if (await this.streamingService.requiresHls(torrentId)) {
      return reply
        .status(302)
        .header("Cache-Control", "no-store")
        .header("Location", `/stream/${torrentId}/hls/index.m3u8`)
        .send();
    }

    if (progress.status !== "ready") {
      return reply
        .status(202)
        .header("Cache-Control", "no-store")
        .send(progress);
    }

    try {
      const result = await this.streamingService.getVideoStream(torrentId, range);

      if (result.start != null && result.end != null && result.totalSize != null) {
        return reply
          .status(206)
          .header("Cache-Control", "no-store")
          .header("Content-Range", `bytes ${result.start}-${result.end}/${result.totalSize}`)
          .header("Accept-Ranges", "bytes")
          .header("Content-Length", result.fileSize ?? 0)
          .header("Content-Type", result.mimeType)
          .send(result.stream);
      }

      // Transcoded / unknown-length streams — still advertise byte ranges when possible.
      let r = reply
        .status(200)
        .header("Cache-Control", "no-store")
        .header("Accept-Ranges", "bytes")
        .header("Content-Type", result.mimeType);
      if (result.fileSize != null)
        r = r.header("Content-Length", result.fileSize);
      return r.send(result.stream);
    } catch (error) {
      this.logger.error(`[Stream] ${error instanceof Error ? error.message : error}`);
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ message: "Stream temporarily unavailable" });
    }
  }

  @Get("subtitles/:movieId")
  async getSubtitles(
    @Param("movieId", ParseUUIDPipe) movieId: string,
    @Query("season") season = "",
    @Query("episode") episode = "",
  ): Promise<SubtitleEntry[]> {
    return this.streamingService.getSubtitlesByMovieId(
      movieId,
      parseSubtitleEpisode(season, episode),
    );
  }

  @Get("subtitles/:movieId/:lang")
  async getSubtitleFile(
    @Param("movieId", ParseUUIDPipe) movieId: string,
    @Param("lang") lang: string,
    @Res() reply: FastifyReply,
    @Query("season") season = "",
    @Query("episode") episode = "",
  ): Promise<void> {
    const { content } = await this.streamingService.getSubtitleFileByMovieId(
      movieId,
      lang,
      parseSubtitleEpisode(season, episode),
    );
    return reply
      .header("Content-Type", "text/vtt; charset=utf-8")
      .send(content);
  }
}

function parseSubtitleEpisode(
  season?: string,
  episode?: string,
): SubtitleEpisode | undefined {
  if (season == null || episode == null || season === "" || episode === "") {
    return undefined;
  }
  const s = Number(season);
  const e = Number(episode);
  if (!Number.isInteger(s) || !Number.isInteger(e)) return undefined;
  if (s < 0 || s > 100 || e < 0 || e > 10_000) return undefined;
  return { season: s, episode: e };
}
