import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobePath } from "ffprobe-static";

let configured = false;

/** Prefer `FFMPEG_PATH` when set; otherwise npm-vendored binaries (no host ffmpeg). */
export function configureFfmpeg(explicitFfmpegPath?: string): void {
  if (configured) return;
  configured = true;

  ffmpeg.setFfmpegPath(explicitFfmpegPath || ffmpegPath);
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
}
