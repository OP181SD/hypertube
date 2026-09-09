import { Injectable, Logger } from "@nestjs/common";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { TranscodingService } from "./transcoding.service";
import type { TorrentFile } from "../interfaces";

const SEGMENT_SECONDS = 6;
const SEGMENTS_TO_START = 2;
export const SECONDS_TO_START = SEGMENT_SECONDS * SEGMENTS_TO_START;
const PLAYLIST_NAME = "index.m3u8";
const INIT_NAME = "init.mp4";
const END_MARKER = "#EXT-X-ENDLIST";
const SEGMENT_NAME_PATTERN = /^(seg\d{5}\.m4s|init\.mp4)$/;
/** Safari MSE: max 2 audio channels. */
const MAX_AUDIO_CHANNELS = 2;
const MAX_HEIGHT = 1080;
const MAX_ATTEMPTS = 2;

const INPUT_FORMATS: Record<string, string> = {
  ".mkv": "matroska",
  ".avi": "avi",
  ".mov": "mov",
  ".mp4": "mp4",
  ".m4v": "mp4",
  ".webm": "webm",
  ".flv": "flv",
  ".wmv": "asf",
};

export interface HlsState {
  status: "starting" | "playable" | "done" | "failed";
  attempts: number;
  segments: number;
  converted: number;
  duration: number;
  error?: string;
}

@Injectable()
export class HlsService {
  private readonly logger = new Logger(HlsService.name);
  private readonly states = new Map<string, HlsState>();

  constructor(private readonly transcodingService: TranscodingService) {}

  async ensure(torrentId: string, file: TorrentFile, complete: boolean): Promise<HlsState> {
    const known = this.states.get(torrentId);
    if (known && !this.shouldRetry(known)) {
      if (known.status === "done" && (await this.isTruncated(file))) {
        this.logger.warn(`[HLS] Truncated playlist for ${torrentId} — reconverting`);
        known.status = "failed";
        known.error = "truncated";
        known.attempts = 0;
      } else {
        if (known.status !== "failed") known.segments = await this.countSegments(file.path);
        if (known.status === "starting" && known.segments >= SEGMENTS_TO_START)
          known.status = "playable";
        return known;
      }
    }

    const finished = !known && (await this.isFinished(file.path));
    if (finished && complete && !(await this.isTruncated(file))) {
      this.logger.log(`[HLS] Reusing playlist for ${torrentId}`);
      return this.remember(torrentId, {
        status: "done",
        segments: await this.countSegments(file.path),
        converted: 0,
        duration: 0,
        attempts: 0,
      });
    }
    if (finished) {
      this.logger.warn(
        `[HLS] Ignoring stale playlist for ${torrentId} complete=${complete}`,
      );
    }

    const attempts = (known?.attempts ?? 0) + 1;
    if (known)
      this.logger.warn(`[HLS] Retrying ${torrentId} after: ${known.error} (attempt ${attempts})`);
    const state = this.remember(torrentId, {
      status: "starting",
      segments: 0,
      converted: 0,
      duration: 0,
      attempts,
    });
    void this.run(torrentId, file, complete, state);
    return state;
  }

  private shouldRetry(state: HlsState): boolean {
    return state.status === "failed" && state.attempts < MAX_ATTEMPTS;
  }

  playlistPath(sourcePath: string): string {
    return join(hlsDir(sourcePath), PLAYLIST_NAME);
  }

  segmentPath(sourcePath: string, name: string): string | null {
    if (!SEGMENT_NAME_PATTERN.test(name)) return null;
    return join(hlsDir(sourcePath), name);
  }

  private async run(
    torrentId: string,
    file: TorrentFile,
    complete: boolean,
    state: HlsState,
  ): Promise<void> {
    const dir = hlsDir(file.path);
    try {
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });

      const info = await this.transcodingService.describe(file.path);
      state.duration = info?.duration ?? 0;
      const copyVideo = info?.videoCodec === "h264";
      const copyAudio =
        info?.audioCodec === "aac" && (info?.audioChannels ?? 0) <= MAX_AUDIO_CHANNELS;
      const encoder = copyVideo ? "copy" : await this.transcodingService.h264Encoder();
      const downscale = !copyVideo && (info?.videoHeight ?? 0) > MAX_HEIGHT;
      this.logger.log(
        `[HLS] Starting ${torrentId} ${info?.videoCodec ?? "?"}→${encoder} ` +
          `${info?.audioCodec ?? "?"}/${info?.audioChannels ?? "?"}ch→${copyAudio ? "copy" : "aac stereo"} ` +
          `${downscale ? `${info?.videoHeight}p→${MAX_HEIGHT}p ` : ""}` +
          `${state.duration.toFixed(0)}s complete=${complete}`,
      );

      await new Promise<void>((resolve, reject) => {
        const stream = complete ? null : file.createReadStream();
        const format = stream ? inputFormatFor(file.name) : undefined;
        const command = stream
          ? format
            ? ffmpeg(stream).inputFormat(format)
            : ffmpeg(stream)
          : ffmpeg(file.path);
        command
          .videoCodec(encoder)
          .audioCodec(copyAudio ? "copy" : "aac")
          .outputOptions([
            "-sn",
            ...(downscale ? ["-vf", `scale=-2:${MAX_HEIGHT}`] : []),
            ...videoQualityOptions(encoder),
            ...(copyAudio ? [] : ["-ac", String(MAX_AUDIO_CHANNELS)]),
            "-hls_time",
            String(SEGMENT_SECONDS),
            "-hls_playlist_type",
            "event",
            "-hls_list_size",
            "0",
            "-hls_segment_type",
            "fmp4",
            "-hls_fmp4_init_filename",
            INIT_NAME,
            "-hls_segment_filename",
            join(dir, "seg%05d.m4s"),
          ])
          .format("hls")
          .output(join(dir, PLAYLIST_NAME))
          .on("progress", (progress: { timemark?: string }) => {
            state.converted = parseTimemark(progress.timemark) ?? state.converted;
          })
          .on("end", () => {
            stream?.destroy();
            resolve();
          })
          .on("error", (err: Error) => {
            stream?.destroy();
            reject(err);
          })
          .run();
      });

      state.segments = await this.countSegments(file.path);
      state.status = "done";
      this.logger.log(`[HLS] Done ${torrentId}: ${state.segments} segments`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.status = "failed";
      state.error = message;
      await this.dropEndMarker(file.path);
      this.logger.error(`[HLS] Failed ${torrentId}: ${message}`);
    }
  }

  private async countSegments(sourcePath: string): Promise<number> {
    const playlist = await readFile(this.playlistPath(sourcePath), "utf8").catch(() => null);
    if (!playlist) return 0;
    return playlist.split("\n").filter((line) => line.startsWith("#EXTINF")).length;
  }

  private async dropEndMarker(sourcePath: string): Promise<void> {
    const path = this.playlistPath(sourcePath);
    const playlist = await readFile(path, "utf8").catch(() => null);
    if (!playlist?.includes(END_MARKER)) return;
    await writeFile(
      path,
      playlist
        .split("\n")
        .filter((line) => line.trim() !== END_MARKER)
        .join("\n"),
    ).catch(() => undefined);
  }

  private async isFinished(sourcePath: string): Promise<boolean> {
    const playlist = await readFile(this.playlistPath(sourcePath), "utf8").catch(() => null);
    return playlist?.includes(END_MARKER) ?? false;
  }

  /** ffmpeg writes ENDLIST when its input stream ends, even if the mkv is still short. */
  private async isTruncated(file: TorrentFile): Promise<boolean> {
    const playlistSeconds = await this.playlistDuration(file.path);
    const info = await this.transcodingService.describe(file.path);
    const sourceSeconds = info?.duration ?? 0;
    if (sourceSeconds <= 0 || playlistSeconds <= 0) return false;
    return playlistSeconds < sourceSeconds * 0.9;
  }

  private async playlistDuration(sourcePath: string): Promise<number> {
    const playlist = await readFile(this.playlistPath(sourcePath), "utf8").catch(() => null);
    if (!playlist) return 0;
    let seconds = 0;
    for (const line of playlist.split("\n")) {
      if (!line.startsWith("#EXTINF:")) continue;
      const value = Number(line.slice("#EXTINF:".length).split(",")[0]);
      if (Number.isFinite(value)) seconds += value;
    }
    return seconds;
  }

  private remember(torrentId: string, state: HlsState): HlsState {
    this.states.set(torrentId, state);
    return state;
  }
}

export function hlsDir(sourcePath: string): string {
  const dot = sourcePath.lastIndexOf(".");
  return `${dot > 0 ? sourcePath.slice(0, dot) : sourcePath}.hls`;
}

function videoQualityOptions(encoder: string): string[] {
  if (encoder === "copy") return [];
  if (encoder === "libx264")
    return ["-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"];
  return ["-b:v", "5000k", "-pix_fmt", "yuv420p"];
}

export function inputFormatFor(fileName: string): string | undefined {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
  return INPUT_FORMATS[ext];
}

function parseTimemark(timemark?: string): number | null {
  const match = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(timemark ?? "");
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}
