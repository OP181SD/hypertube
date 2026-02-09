import { useState, useCallback, useRef } from "react";
import { Movies } from "@/types/Movies";
import { SortTypes } from "../ui/navigation/types/filters";

export interface UseMoviesResult {
  movies: Movies[];
  loading: boolean;
  loadMore: () => void;
  hasMore: boolean;
  sortMoviesBy: (type: SortTypes) => void;
}

// Temporary stub — will be replaced in Phase 3 with backend API hook
export const useMovies = (
  _selectedGenre?: string,
): UseMoviesResult => {
  const [allMovies] = useState<Movies[]>([]);
  const [loading] = useState(false);
  const [hasMore] = useState(false);
  const [sortType, setSortType] = useState<SortTypes>("Popular");
  const pageRef = useRef(1);

  const loadMore = useCallback(() => {
    pageRef.current += 1;
  }, []);

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
