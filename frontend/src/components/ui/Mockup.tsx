import { useState } from "react";
import { useHeroMovies } from "@/components/hooks/useMockupMovies";
import { useMovies } from "@/components/hooks/Movies";
import { HeroSection } from "@/components/ui/HeroSection";
import { NavigationGender } from "./navigation/NavigationGender";
import { MoviesSection } from "@/components/ui/MoviesSection";


// ----------------------------
// COMPOSANT PRINCIPAL
// ----------------------------
export const Mockup = () => {
  const hero = useHeroMovies();
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const { movies, loading, loadMore, hasMore } = useMovies(selectedGenre);
  const [activeIndex, setActiveIndex] = useState(0);

  if (hero.loading) return <div>Chargement...</div>;
  if (hero.error || hero.movies.length === 0)
    return <div>Erreur ou pas de films</div>;

  return (
    <main className="flex flex-col items-center w-full">
      <HeroSection
        movies={hero.movies}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />

      <NavigationGender onSelectGenre={setSelectedGenre} />

      <MoviesSection
        movies={movies}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </main>
  );
};
