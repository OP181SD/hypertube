import { useState } from "react";
import { useHeroMovies } from "@/hooks/useHeroMovies";
import { useMovies } from "@/hooks/useMovies";
import { useDebounce } from "@/hooks/useDebounce";
import { HeroSection } from "@/components/ui/HeroSection";
import { NavigationGender } from "./navigation/NavigationGender";
import { MoviesSection } from "@/components/ui/MoviesSection";
import type { SortTypes } from "./navigation/types/filters";
import type { SearchMoviesParams } from "@/types/api";

interface MovieBrowserProps {
  search?: string;
  mediaType?: SearchMoviesParams["mediaType"];
}

const sortMap: Record<SortTypes, SearchMoviesParams["sortBy"] | undefined> = {
  Popular: undefined,
  Name: "title",
  Year: "year",
  Rating: "rating",
};

export const MovieBrowser: React.FC<MovieBrowserProps> = ({ search, mediaType = "movie" }) => {
  const debouncedSearch = useDebounce(search || "", 300);
  const isSeries = mediaType === "series";
  const [selectedGenre, setSelectedGenre] = useState("");
  const [sortBy, setSortBy] = useState<SearchMoviesParams["sortBy"]>();
  const [minRating, setMinRating] = useState<number>();
  const [yearRange, setYearRange] = useState<[number?, number?]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Spec: search results must be sorted by name
  const effectiveSortBy = debouncedSearch ? "title" : sortBy;

  const hero = useHeroMovies();
  const { movies, loading, loadMore, hasMore } = useMovies({
    genre: selectedGenre || undefined,
    sortBy: effectiveSortBy,
    query: debouncedSearch || undefined,
    mediaType,
    minRating,
    minYear: yearRange[0],
    maxYear: yearRange[1],
  });

  const handleSort = (type: SortTypes) => {
    setSortBy(sortMap[type]);
  };

  const isSearching = debouncedSearch.length > 0;
  // The hero showcases popular movies, so it only applies to the movies page.
  const showHero = !isSearching && !isSeries;
  const hasHero = showHero && hero.movies.length > 0;
  const heroLoading = showHero && hero.loading;

  return (
    <section className="flex flex-col w-full pt-14 md:pt-16">
      {/* Hero — movies only, hidden during search */}
      {showHero && (
        <>
          {hero.loading && (
            <div className="w-full h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] bg-gray-900/50 animate-pulse" />
          )}
          {!hero.loading && hasHero && (
            <HeroSection
              movies={hero.movies}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
            />
          )}
        </>
      )}

      {/* Content */}
      <div
        className={`flex flex-col items-center w-full px-3 sm:px-4 md:px-6 lg:px-8 ${
          isSearching || (!hasHero && !heroLoading) ? "pt-16 md:pt-20" : ""
        }`}
      >
        <NavigationGender
          onSelectGenre={setSelectedGenre}
          onSelectSort={handleSort}
          onSelectMinRating={setMinRating}
          onSelectYearRange={setYearRange}
        />

        <MoviesSection
          movies={movies}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          title={isSearching ? `Résultats pour « ${debouncedSearch} »` : undefined}
        />
      </div>
    </section>
  );
};
