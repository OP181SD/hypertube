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
  // Synchronous in-flight guard. Using the async `loading` state here races:
  // a short first page leaves the infinite-scroll sentinel visible, so
  // loadMore could bump the page before page 1 resolves — which cancelled the
  // page-1 request and dropped its results (the series page showed nothing).
  const fetchingRef = useRef(false);

  // Stable key representing filter params (excludes page)
  const filterKey = JSON.stringify({ genre, sortBy, query, mediaType, minRating, minYear, maxYear });

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
    fetchingRef.current = true;
    // Flag the in-flight request before awaiting; this is the canonical
    // data-fetching pattern, not a cascading-render bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        if (!cancelled) {
          // Offset pagination over a dataset that keeps growing (each page
          // re-queries the providers and caches new rows) can return the same
          // movie on consecutive pages — dedupe by id when appending.
          setMovies((prev) => {
            if (fetchPage === 1) return res.data;
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...res.data.filter((m) => !seen.has(m.id))];
          });
          setHasMore(res.hasMore);
        }
      })
      .catch(() => {})
      .finally(() => {
        fetchingRef.current = false;
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    // Guard on the synchronous ref, not `loading`, so an early sentinel hit
    // can't advance the page while the current request is still in flight.
    if (!fetchingRef.current && hasMore) {
      setPage((p) => p + 1);
    }
  }, [hasMore]);

  return { movies, loading, loadMore, hasMore };
}
