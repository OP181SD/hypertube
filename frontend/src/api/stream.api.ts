import client from "./client";
import type { StreamStatus, SubtitleInfo } from "@/types/api";

export function getStreamUrl(torrentId: string): string {
  return `/stream/${torrentId}`;
}

export function getHlsUrl(torrentId: string): string {
  return `/stream/${torrentId}/hls/index.m3u8`;
}

export async function getStreamStatus(torrentId: string): Promise<StreamStatus> {
  const res = await client.get<StreamStatus>(`/stream/${torrentId}/status`);
  return res.data;
}

export async function getSubtitles(
  movieId: string,
  episode?: { season: number; episode: number },
): Promise<SubtitleInfo[]> {
  const res = await client.get<SubtitleInfo[]>(`/subtitles/${movieId}`, {
    params: episode,
  });
  return res.data;
}

export function getSubtitleUrl(
  movieId: string,
  lang: string,
  episode?: { season: number; episode: number },
): string {
  const qs = episode
    ? `?season=${episode.season}&episode=${episode.episode}`
    : "";
  return `/subtitles/${movieId}/${lang}${qs}`;
}
