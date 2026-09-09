import client from "./client";
import type { PaginatedMovies, MovieDetail, SearchMoviesParams, HeroMovie } from "@/types/api";

export async function searchMovies(
  params: SearchMoviesParams,
): Promise<PaginatedMovies> {
  const res = await client.get<PaginatedMovies>("/movies/search", { params });
  return res.data;
}

export async function fetchPopularHero(
  mediaType: "movie" | "series" = "movie",
): Promise<HeroMovie[]> {
  const res = await client.get<HeroMovie[]>("/movies/popular", {
    params: { mediaType },
  });
  return res.data;
}

export async function fetchFrontpageMovies(): Promise<HeroMovie[]> {
  const res = await client.get<HeroMovie[]>("/movies");
  return res.data;
}

export async function getMovie(id: string): Promise<MovieDetail> {
  const res = await client.get<MovieDetail>(`/movies/${id}`);
  return res.data;
}
