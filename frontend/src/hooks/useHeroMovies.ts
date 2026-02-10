import { useState, useEffect } from "react";
import { fetchPopularMovies } from "@/api/movies.api";
import type { HeroMovie } from "@/types/api";

export function useHeroMovies() {
  const [movies, setMovies] = useState<HeroMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPopularMovies()
      .then((data) => {
        if (!cancelled) setMovies(data);
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
