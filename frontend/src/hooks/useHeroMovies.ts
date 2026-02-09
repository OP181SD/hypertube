import { useState, useEffect } from "react";
import { searchMovies } from "@/api/movies.api";
import type { MovieListItem } from "@/types/api";

export function useHeroMovies() {
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    searchMovies({ sortBy: "rating", order: "desc", limit: 7, page: 1 })
      .then((res) => {
        if (!cancelled) setMovies(res.data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { movies, loading, error };
}
