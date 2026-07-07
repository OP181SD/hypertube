import client from "./client";
import type { StreamStatus } from "@/types/api";

export function getStreamUrl(torrentId: string): string {
  return `${client.defaults.baseURL}/stream/${torrentId}`;
}

export async function getStreamStatus(torrentId: string): Promise<StreamStatus> {
  const res = await client.get<StreamStatus>(`/stream/${torrentId}/status`);
  return res.data;
}

export function getSubtitleUrl(movieId: string, lang: string): string {
  return `${client.defaults.baseURL}/subtitles/${movieId}/${lang}`;
}
