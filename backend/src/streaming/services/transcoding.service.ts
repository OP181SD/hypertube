import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Readable } from "node:stream";
import ffmpeg from "fluent-ffmpeg";
import type { FfprobeData } from "fluent-ffmpeg";
import type { VideoInfo } from "../interfaces";

const BROWSER_NATIVE_EXTENSIONS = [".mp4", ".webm"];

const INPUT_FORMAT_MAP: Record<string, string> = {
  ".mkv": "matroska",
  ".avi": "avi",
  ".mov": "mov",
  ".flv": "flv",
};

@Injectable()
export class TranscodingService {
  private readonly logger = new Logger(TranscodingService.name);

  constructor(private readonly configService: ConfigService) {
    const ffmpegPath = this.configService.get<string>("FFMPEG_PATH");
    if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
  }

  needsTranscoding(fileName: string): boolean {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    return !BROWSER_NATIVE_EXTENSIONS.includes(ext);
  }

  transcodeToMp4(inputStream: Readable, fileName: string): Readable {
    this.logger.log(`[Transcode] Starting: ${fileName}`);

    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    const inputFormat = INPUT_FORMAT_MAP[ext] ?? "matroska";

    return ffmpeg(inputStream)
      .inputFormat(inputFormat)
      .videoCodec("copy")
      .audioCodec("aac")
      .outputOptions(["-movflags frag_keyframe+empty_moov"])
      .format("mp4")
      .on("error", (err: Error) => {
        if (
          err.message.includes("Output stream closed") ||
          err.message.includes("SIGKILL")
        ) {
          this.logger.debug(`[Transcode] Stopped: client disconnected`);
        } else {
          this.logger.error(`[Transcode] Error: ${err.message}`);
        }
      })
      .pipe() as unknown as Readable;
  }

  getVideoInfo(filePath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err: Error | null, data: FfprobeData) => {
        if (err) { reject(err); return; }
        const video = data.streams?.find((s) => s.codec_type === "video");
        const audio = data.streams?.find((s) => s.codec_type === "audio");
        resolve({
          format: data.format?.format_name ?? "unknown",
          duration: data.format?.duration ?? 0,
          videoCodec: video?.codec_name ?? "unknown",
          audioCodec: audio?.codec_name ?? "unknown",
        });
      });
    });
  }
}
