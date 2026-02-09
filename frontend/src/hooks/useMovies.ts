import { useState, useEffect, useCallback } from "react";
import { searchMovies } from "@/api/movies.api";
import type { MovieListItem, SearchMoviesParams } from "@/types/api";

interface UseMoviesParams {
  genre?: string;
  sortBy?: SearchMoviesParams["sortBy"];
  query?: string;
  minRating?: number;
  minYear?: number;
  maxYear?: number;
}

export function useMovies(params: UseMoviesParams = {}) {
  const { genre, sortBy, query, minRating, minYear, maxYear } = params;
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [genre, sortBy, query, minRating, minYear, maxYear]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const apiParams: SearchMoviesParams = { page, limit: 20 };
    if (genre) apiParams.genre = genre;
    if (query) apiParams.query = query;
    if (sortBy) apiParams.sortBy = sortBy;
    if (minRating !== undefined) apiParams.minRating = minRating;
    if (minYear !== undefined) apiParams.minYear = minYear;
    if (maxYear !== undefined) apiParams.maxYear = maxYear;

    searchMovies(apiParams)
      .then((res) => {
        if (!cancelled) {
          setMovies((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
          setHasMore(res.hasMore);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, genre, query, sortBy, minRating, minYear, maxYear]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((p) => p + 1);
    }
  }, [loading, hasMore]);

  return { movies, loading, loadMore, hasMore };
}
