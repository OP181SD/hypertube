import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Movies } from "@/types/Movies";
import { TMDBMovie } from "@/api/TmdbMovie";
import { GENRES } from "@/constants/genres";

const API_KEY = "f974be2281a400200a07927981a67d4a";
const BASE_URL = "https://api.themoviedb.org/3";

const getArrayMovies = (movies: TMDBMovie[]): Movies[] => {
  return movies.map((movie) => ({
    id: movie.id,
    title: movie.title,
    coverUrl: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : "",
    watched: false,
    genres: movie.genre_ids || []
  }));
};

const filterMoviesByGenres = (movies: Movies[], genreIds: number[]): Movies[] => {
  if (!genreIds.length) return movies;
  return movies.filter(movie =>
    (movie.genres ?? []).some(g => genreIds.includes(g))
  );
};

export interface UseMoviesResult {
  movies: Movies[];
  loading: boolean;
  loadMore: () => void;
  hasMore: boolean;
}

export const useMovies = (selectedGenre?: string): UseMoviesResult => {
  const [allMovies, setAllMovies] = useState<Movies[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);
  const prevGenreRef = useRef(selectedGenre);

  const fetchPage = useCallback(async (page: number, reset: boolean) => {
    setLoading(true);
    try {
      const res = await axios.get<{ results: TMDBMovie[]; total_pages: number }>(
        `${BASE_URL}/discover/movie`,
        {
          params: {
            api_key: API_KEY,
            language: "fr-FR",
            page,
            with_genres: 28,
          },
        }
      );
      const formattedMovies = getArrayMovies(res.data.results);
      setAllMovies(prev => reset ? formattedMovies : [...prev, ...formattedMovies]);
      setHasMore(page < res.data.total_pages);
    } catch (err) {
      console.error("Erreur fetchPopularMovieSection:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    pageRef.current = 1;
    fetchPage(1, true);
  }, [fetchPage]);

  // Reset when genre changes
  useEffect(() => {
    if (prevGenreRef.current !== selectedGenre) {
      prevGenreRef.current = selectedGenre;
    }
  }, [selectedGenre]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    pageRef.current += 1;
    fetchPage(pageRef.current, false);
  }, [loading, hasMore, fetchPage]);

  // Apply genre filter
  const filteredMovies = (() => {
    if (!selectedGenre) return allMovies;
    const genreIds = Object.entries(GENRES)
      .filter(([_, name]) => name === selectedGenre)
      .map(([id]) => Number(id));
    return filterMoviesByGenres(allMovies, genreIds);
  })();

  return { movies: filteredMovies, loading, loadMore, hasMore };
};
