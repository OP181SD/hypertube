import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMovies } from "@/hooks/useMovies";
import { useHeroMovies } from "@/hooks/useHeroMovies";
import { HeroSection } from "@/components/ui/HeroSection";
import { MoviesSection } from "@/components/ui/MoviesSection";

export default function MainContent() {
  const { t } = useTranslation();
  const { movies, loading } = useMovies({ sortBy: "rating" });
  const hero = useHeroMovies();
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex flex-1 flex-col">
      {/* Front page : les top films, visibles par tout le monde (sujet III.4) */}
      {hero.movies.length > 0 && (
        <HeroSection
          movies={hero.movies}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
        />
      )}

      {/* Content */}
      <div className="flex flex-1 justify-center items-center px-4">
        <div className="flex flex-col items-center text-center max-w-4xl mt-10">
          <h1
            className="
              font-extrabold
              uppercase
              tracking-wide
              text-white
              leading-tight
              text-[32px]
              sm:text-[40px]
              md:text-[56px]
              lg:text-[64px]
            "
          >
            {t("streaming")}
            <span className="colors-title-gradient"> {t("reinvented")}</span>
          </h1>

          <p
            className="
              mt-3
              sm:mt-4
              text-[14px]
              sm:text-[15px]
              md:text-[18px]
              lg:text-[20px]
              max-w-70
              sm:max-w-md
              md:max-w-lg
              font-medium
              leading-relaxed
              text-white/90
            "
          >
            {t("simple_fluid_fast")}
            <span className="colors-title-gradient">
              {" "}{t("new_experience")}
            </span>
          </p>
        </div>

        {(movies.length > 0 || loading) && (
          <div className="w-full mt-12">
            <MoviesSection
              movies={movies}
              loading={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
