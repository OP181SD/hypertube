import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Readable } from "node:stream";
import ffmpeg, { type FfprobeData } from "fluent-ffmpeg";
import type { VideoInfo } from "../interfaces";

const BROWSER_COMPATIBLE_EXTENSIONS = [".mp4", ".webm"];

@Injectable()
export class TranscodingService {
  private readonly logger = new Logger(TranscodingService.name);

  constructor(private readonly configService: ConfigService) {
    const ffmpegPath = this.configService.get<string>("FFMPEG_PATH");
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
  }

  needsTranscoding(filePath: string): boolean {
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
    return !BROWSER_COMPATIBLE_EXTENSIONS.includes(ext);
  }

  transcodeToMp4(inputPath: string): Readable {
    this.logger.log(`Transcoding ${inputPath} to MP4`);

    return ffmpeg(inputPath)
      .videoCodec("copy")
      .audioCodec("aac")
      .outputOptions([
        "-movflags frag_keyframe+empty_moov+faststart",
        "-preset ultrafast",
      ])
      .format("mp4")
      .on("error", (err: Error) => {
        this.logger.error(`Transcoding error: ${err.message}`);
      })
      .pipe() as unknown as Readable;
  }

  getVideoInfo(filePath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(
        filePath,
        (err: Error | null, data: FfprobeData) => {
          if (err) {
            reject(err);
            return;
          }

          const videoStream = data.streams?.find(
            (s) => s.codec_type === "video",
          );
          const audioStream = data.streams?.find(
            (s) => s.codec_type === "audio",
          );

          resolve({
            format: data.format?.format_name ?? "unknown",
            duration: data.format?.duration ?? 0,
            videoCodec: videoStream?.codec_name ?? "unknown",
            audioCodec: audioStream?.codec_name ?? "unknown",
          });
        },
      );
    });
  }
}
