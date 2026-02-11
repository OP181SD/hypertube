import {
  Controller,
  Get,
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

  @Public()
  @Get("stream/:torrentId")
  async stream(
    @Param("torrentId", ParseUUIDPipe) torrentId: string,
    @Headers("range") range: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    
    let progress;
    try {
      progress = await this.streamingService.getStreamStatus(torrentId);
    } catch (e) {
      throw new NotFoundException("Torrent not found in database");
    }

    if (progress.status === "idle") {
      try {
        this.logger.log(`[CONTROLLER] Waking up idle torrent ${torrentId}`);
        await this.streamingService.initiateStream(torrentId, "anonymous");
        
        // On attend un peu pour les métadonnées
        await new Promise(resolve => setTimeout(resolve, 2000));
        progress = await this.streamingService.getStreamStatus(torrentId);
      } catch (error: any) {
        this.logger.error(`[CONTROLLER] Failed to initiate stream: ${error.message}`);
        return reply.status(500).send({ message: "Failed to start torrent engine" });
      }
    }

    // 3. LA SÉCURITÉ : Si on n'a toujours pas de fichier identifié
    if (!progress.filePath) {
      this.logger.log(`[HTTP] Metadata still pending for ${torrentId}. Returning 202.`);
      return reply
        .status(202)
        .send({ 
          ...progress, 
          message: "Fetching torrent metadata, please wait..." 
        });
    }

    // 4. On tente de servir le flux vidéo
    try {
      const result = await this.streamingService.getVideoStream(torrentId, range);

      if (result.start != null && result.end != null && result.totalSize != null) {
        // Flux partiel (Range Request)
        return reply
          .status(206)
          .header("Content-Range", `bytes ${result.start}-${result.end}/${result.totalSize}`)
          .header("Accept-Ranges", "bytes")
          .header("Content-Length", result.fileSize ?? 0)
          .header("Content-Type", result.mimeType)
          .send(result.stream);
      } else {
        // Flux complet ou Transcodage
        return reply
          .status(200)
          .header("Accept-Ranges", "bytes")
          .header("Content-Type", result.mimeType)
          .send(result.stream);
      }
    } catch (error: any) { // On ajoute ": any" ici
      this.logger.error(`[HTTP] Stream error: ${error?.message || error}`);
      return reply.status(503).send({ message: "Stream temporarily unavailable" });
    }
  }

  @Public()
  @Get("stream/:torrentId/status")
  async getStatus(@Param("torrentId", ParseUUIDPipe) torrentId: string) {
    return this.streamingService.getStreamStatus(torrentId);
  }

  @Public()
  @Get("subtitles/:movieId")
  async getSubtitles(@Param("movieId", ParseUUIDPipe) movieId: string) {
    return this.streamingService.getSubtitlesByMovieId(movieId);
  }

  @Public()
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

    return reply
      .header("Content-Type", "text/vtt; charset=utf-8")
      .send(content);
  }
}