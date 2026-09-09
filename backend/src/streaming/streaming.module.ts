import { Module } from "@nestjs/common";
import { StreamingController } from "./streaming.controller";
import { StreamingService } from "./streaming.service";
import { TorrentService } from "./services/torrent.service";
import { TranscodingService } from "./services/transcoding.service";
import { HlsService } from "./services/hls.service";
import { SubtitleService } from "./services/subtitle.service";
import { CleanupService } from "./services/cleanup.service";

@Module({
  controllers: [StreamingController],
  providers: [
    StreamingService,
    TorrentService,
    TranscodingService,
    HlsService,
    SubtitleService,
    CleanupService,
  ],
  exports: [StreamingService],
})
export class StreamingModule {}
