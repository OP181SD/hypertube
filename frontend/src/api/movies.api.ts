import client from "./client";
import type { PaginatedMovies, MovieDetail, SearchMoviesParams } from "@/types/api";

export async function searchMovies(
  params: SearchMoviesParams,
): Promise<PaginatedMovies> {
  const res = await client.get<PaginatedMovies>("/movies", { params });
  return res.data;
}

export async function getMovie(id: string): Promise<MovieDetail> {
  const res = await client.get<MovieDetail>(`/movies/${id}`);
  return res.data;
}
