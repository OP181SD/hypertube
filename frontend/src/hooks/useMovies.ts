import { useState, useEffect, useCallback, useRef } from "react";
import { searchMovies } from "@/api/movies.api";
import type { MovieListItem, SearchMoviesParams } from "@/types/api";

interface UseMoviesParams {
  genre?: string;
  sortBy?: SearchMoviesParams["sortBy"];
  query?: string;
  mediaType?: SearchMoviesParams["mediaType"];
  minRating?: number;
  minYear?: number;
  maxYear?: number;
}

export function useMovies(params: UseMoviesParams = {}) {
  const { genre, sortBy, query, mediaType, minRating, minYear, maxYear } = params;
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  /** Bumps on every fetch; stale responses (incl. cancelled finally) are ignored. */
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);

  const filterKey = JSON.stringify({
    genre,
    sortBy,
    query,
    mediaType,
    minRating,
    minYear,
    maxYear,
  });

  const [seededFilterKey, setSeededFilterKey] = useState(filterKey);
  if (filterKey !== seededFilterKey) {
    setSeededFilterKey(filterKey);
    setPage(1);
    setMovies([]);
    setHasMore(true);
    // Block infinite-scroll loadMore until the new page-1 request finishes.
    // Otherwise the sentinel can bump page to 2 and cancel page 1 → empty results.
    requestIdRef.current += 1;
    loadingRef.current = true;
    setLoading(true);
  }

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const fetchPage = page;

    loadingRef.current = true;
    setLoading(true);

    const apiParams: SearchMoviesParams = { page: fetchPage, limit: 20 };
    if (genre) apiParams.genre = genre;
    if (query) apiParams.query = query;
    if (mediaType) apiParams.mediaType = mediaType;
    if (sortBy) apiParams.sortBy = sortBy;
    if (minRating !== undefined) apiParams.minRating = minRating;
    if (minYear !== undefined) apiParams.minYear = minYear;
    if (maxYear !== undefined) apiParams.maxYear = maxYear;

    searchMovies(apiParams)
      .then((res) => {
        if (requestId !== requestIdRef.current) return;

        setMovies((prev) => {
          if (fetchPage === 1) return res.data;
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...res.data.filter((m) => !seen.has(m.id))];
        });
        setHasMore(res.hasMore);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        if (fetchPage === 1) setMovies([]);
        setHasMore(false);
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        loadingRef.current = false;
        setLoading(false);
      });
  }, [page, filterKey, genre, query, mediaType, sortBy, minRating, minYear, maxYear]);

  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMore) {
      setPage((p) => p + 1);
    }
  }, [hasMore]);

  return { movies, loading, loadMore, hasMore };
}
