import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Movies } from "@/types/Movies";
import { SortTypes } from "../ui/navigation/types/filters";
import { TMDBMovie } from "@/api/TmdbMovie";
import { GENRES } from "@/constants/genres";

const API_KEY = "f974be2281a400200a07927981a67d4a";
const BASE_URL = "https://api.themoviedb.org/3";

const getArrayMovies = (movies: TMDBMovie[]): Movies[] => {
  return movies
    .filter(movie => movie.poster_path)
    .map(movie => ({
      id: movie.id,
      title: movie.title,
      releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
      imdbRating: movie.vote_average ? Number(movie.vote_average.toFixed(1)) : undefined,
      coverUrl: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
      watched: false,
      genres: movie.genre_ids || [],
    }));
};

export interface UseMoviesResult {
  movies: Movies[];
  loading: boolean;
  loadMore: () => void;
  hasMore: boolean;
  sortMoviesBy: (type: SortTypes) => void;
}


export const useMovies = (
  selectedGenre?: string
): UseMoviesResult => {
  const [allMovies, setAllMovies] = useState<Movies[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortType, setSortType] = useState<SortTypes>("Popular");

  const pageRef = useRef(1);

  const fetchPage = useCallback(async (page: number, reset: boolean) => {
    setLoading(true);
    try {
      const genreId = selectedGenre
        ? Number(Object.entries(GENRES).find(([_, name]) => name === selectedGenre)?.[0])
        : undefined;

        console.log("Genre ID:", genreId);
      const res = await axios.get<{ results: TMDBMovie[]; total_pages: number }>(
        `${BASE_URL}/discover/movie`,
        {
          params: {
            api_key: API_KEY,
            language: "fr-FR",
            page,
            with_genres: genreId,
          },
        }
      );

      const formattedMovies = getArrayMovies(res.data.results);

      setAllMovies(prev => reset ? formattedMovies : [...prev, ...formattedMovies]);
      setHasMore(page < res.data.total_pages);
    } catch (err) {
      console.error("Erreur fetchMovies:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedGenre]);

  useEffect(() => {
    pageRef.current = 1;
    setAllMovies([]);
    setHasMore(true);
    fetchPage(1, true);
  }, [selectedGenre, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    pageRef.current += 1;
    fetchPage(pageRef.current, false);
  }, [loading, hasMore, fetchPage]);

  const sortMoviesBy = (type: SortTypes) => {
    setSortType(type);
  };

  const moviesToReturn = [...allMovies].sort((a, b) => {
    switch (sortType) {
      case "Name":
        return a.title.localeCompare(b.title);
      case "Year":
        return (b.releaseYear ?? 0) - (a.releaseYear ?? 0);
      case "Rating":
        return (b.imdbRating ?? 0) - (a.imdbRating ?? 0);
      case "Popular":
      default:
        return 0;
    }
  });

  return { movies: moviesToReturn, loading, loadMore, hasMore, sortMoviesBy };
};
