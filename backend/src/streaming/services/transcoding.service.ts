import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import ffmpeg from "fluent-ffmpeg";
import type { FfprobeData } from "fluent-ffmpeg";
import type { VideoInfo } from "../interfaces";
import { configureFfmpeg } from "./ffmpeg-binaries";

const BROWSER_NATIVE_EXTENSIONS = [".mp4", ".webm"];
const NATIVE_VIDEO_CODECS = ["h264", "vp8", "vp9", "av1"];
const NATIVE_AUDIO_CODECS = ["aac", "mp3", "opus", "vorbis", "flac"];

@Injectable()
export class TranscodingService {
  private readonly logger = new Logger(TranscodingService.name);
  private readonly probes = new Map<string, VideoInfo>();
  private encoder: Promise<string> | null = null;

  constructor(private readonly configService: ConfigService) {
    configureFfmpeg(this.configService.get<string>("FFMPEG_PATH") || undefined);
  }

  needsTranscoding(fileName: string): boolean {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    return !BROWSER_NATIVE_EXTENSIONS.includes(ext);
  }

  async needsConversion(filePath: string, fileName: string): Promise<boolean> {
    if (this.needsTranscoding(fileName)) return true;
    const info = await this.describe(filePath);
    if (!info) return false;
    if (isKnownCodec(info.videoCodec) && !NATIVE_VIDEO_CODECS.includes(info.videoCodec))
      return true;
    if (isKnownCodec(info.audioCodec) && !NATIVE_AUDIO_CODECS.includes(info.audioCodec))
      return true;
    return false;
  }

  async describe(filePath: string): Promise<VideoInfo | null> {
    const known = this.probes.get(filePath);
    if (known) return known;
    const info = await this.getVideoInfo(filePath).catch(() => null);
    if (info && probeIsComplete(info)) this.probes.set(filePath, info);
    return info;
  }

  async h264Encoder(): Promise<string> {
    this.encoder ??= new Promise<string>((resolve) => {
      ffmpeg.getAvailableEncoders((err, encoders) => {
        const hardware = !err && encoders?.h264_videotoolbox != null;
        this.logger.log(`[FFMPEG] H.264 encoder: ${hardware ? "videotoolbox" : "libx264"}`);
        resolve(hardware ? "h264_videotoolbox" : "libx264");
      });
    });
    return this.encoder;
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
          videoHeight: video?.height ?? 0,
          audioCodec: audio?.codec_name ?? "unknown",
          audioChannels: audio?.channels ?? 0,
        });
      });
    });
  }
}

function isKnownCodec(name: string): boolean {
  return name !== "unknown" && name.length > 0;
}

function probeIsComplete(info: VideoInfo): boolean {
  return isKnownCodec(info.videoCodec) && isKnownCodec(info.audioCodec);
}
