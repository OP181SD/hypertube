import client from "./client";
import type { PaginatedMovies, MovieDetail, SearchMoviesParams, HeroMovie } from "@/types/api";

export async function searchMovies(
  params: SearchMoviesParams,
): Promise<PaginatedMovies> {
  const res = await client.get<PaginatedMovies>("/movies", { params });
  return res.data;
}

export async function fetchPopularMovies(): Promise<HeroMovie[]> {
  const res = await client.get<HeroMovie[]>("/movies/popular");
  return res.data;
}

export async function getMovie(id: string): Promise<MovieDetail> {
  const res = await client.get<MovieDetail>(`/movies/${id}`);
  return res.data;
}
