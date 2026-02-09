import { useState } from "react";
import { useHeroMovies } from "@/hooks/useHeroMovies";
import { useMovies } from "@/hooks/useMovies";
import { useDebounce } from "@/hooks/useDebounce";
import { HeroSection } from "@/components/ui/HeroSection";
import { NavigationGender } from "./navigation/NavigationGender";
import { MoviesSection } from "@/components/ui/MoviesSection";
import type { SortTypes } from "./navigation/types/filters";
import type { SearchMoviesParams } from "@/types/api";

interface MockupProps {
  search?: string;
}

const sortMap: Record<SortTypes, SearchMoviesParams["sortBy"] | undefined> = {
  Popular: undefined,
  Name: "title",
  Year: "year",
  Rating: "rating",
};

export const Mockup: React.FC<MockupProps> = ({ search }) => {
  const debouncedSearch = useDebounce(search || "", 300);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [sortBy, setSortBy] = useState<SearchMoviesParams["sortBy"]>();
  const [activeIndex, setActiveIndex] = useState(0);

  const hero = useHeroMovies();
  const { movies, loading, loadMore, hasMore } = useMovies({
    genre: selectedGenre || undefined,
    sortBy,
    query: debouncedSearch || undefined,
  });

  const handleSort = (type: SortTypes) => {
    setSortBy(sortMap[type]);
  };

  return (
    <main className="flex flex-col items-center w-full">
      {hero.movies.length > 0 && (
        <HeroSection
          movies={hero.movies}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
        />
      )}

      <NavigationGender
        onSelectGenre={setSelectedGenre}
        onSelectSort={handleSort}
      />

      <MoviesSection
        movies={movies}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </main>
  );
};
