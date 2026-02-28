import client from "./client";
import type { MovieListItem } from "@/types/api";

export async function getWatchlist(): Promise<MovieListItem[]> {
  const res = await client.get<MovieListItem[]>("/watchlist");
  return res.data;
}

export async function addToWatchlist(movieId: string): Promise<void> {
  await client.post(`/watchlist/${movieId}`);
}

export async function removeFromWatchlist(movieId: string): Promise<void> {
  await client.delete(`/watchlist/${movieId}`);
}
