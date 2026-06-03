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

  // Stable key representing filter params (excludes page)
  const filterKey = JSON.stringify({ genre, sortBy, query, minRating, minYear, maxYear });

  // When the filters change, reset pagination and clear stale results during
  // render rather than in the fetch effect, so old movies never flash.
  const [seededFilterKey, setSeededFilterKey] = useState(filterKey);
  if (filterKey !== seededFilterKey) {
    setSeededFilterKey(filterKey);
    setPage(1);
    setMovies([]);
  }

  useEffect(() => {
    let cancelled = false;

    const fetchPage = page;
    // Flag the in-flight request before awaiting; this is the canonical
    // data-fetching pattern, not a cascading-render bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const apiParams: SearchMoviesParams = { page: fetchPage, limit: 20 };
    if (genre) apiParams.genre = genre;
    if (query) apiParams.query = query;
    if (sortBy) apiParams.sortBy = sortBy;
    if (minRating !== undefined) apiParams.minRating = minRating;
    if (minYear !== undefined) apiParams.minYear = minYear;
    if (maxYear !== undefined) apiParams.maxYear = maxYear;

    searchMovies(apiParams)
      .then((res) => {
        if (!cancelled) {
          setMovies((prev) => (fetchPage === 1 ? res.data : [...prev, ...res.data]));
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
  }, [page, filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((p) => p + 1);
    }
  }, [loading, hasMore]);

  return { movies, loading, loadMore, hasMore };
}
