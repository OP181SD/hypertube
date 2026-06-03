// src/pages/MoviePresentationWrapper.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MoviePresentation from "@/components/movie/MoviePresentation";
import type { MovieDetail } from "@/types/api";
import { getMovie } from "@/api/movies.api";

const MoviePresentationWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchMovie = async () => {
      try {
        const data = await getMovie(id);
        if (!cancelled) setMovie(data);
      } catch (err: unknown) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load movie");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMovie();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <div className="text-white text-center mt-20">{t("loading")}</div>;
  if (error || !movie) return <div className="text-red-500 text-center mt-20">{error || t("movie_not_found")}</div>;

  return <MoviePresentation movie={movie} />;
};

export default MoviePresentationWrapper;