import { useState, useEffect } from "react";
import { fetchPopularHero } from "@/api/movies.api";
import type { HeroMovie } from "@/types/api";

export function useHeroMovies(mediaType: "movie" | "series" = "movie") {
  const [movies, setMovies] = useState<HeroMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMovies([]);

    fetchPopularHero(mediaType)
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
  }, [mediaType]);

  return { movies, loading, error };
}
