import { FC } from "react";
import type { MovieListItem } from "@/types/api";

interface HeroSectionProps {
  movies: MovieListItem[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

export const HeroSection: FC<HeroSectionProps> = ({
  movies,
  activeIndex,
  setActiveIndex,
}) => {
  if (!movies.length) return null;

  const movie = movies[activeIndex];
  const rating = movie.imdbRating?.toFixed(1) ?? "N/A";
  const heroImage = movie.backdropUrl ?? movie.posterUrl;

  const renderIndicators = () =>
    movies.map((_, index) => (
      <li
        key={index}
        onClick={() => setActiveIndex(index)}
        className={`${
          index === activeIndex
            ? "w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white"
            : "w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/40 hover:bg-white/60 cursor-pointer"
        } rounded-full transition-all duration-300 ease-out`}
      />
    ));

  return (
    <section className="relative w-full">
      <div className="relative w-full group">
        {heroImage ? (
          <img
            src={heroImage}
            alt={movie.title}
            className="w-full h-[60vh] sm:h-[55vh] md:h-[60vh] lg:h-[65vh] xl:h-[70vh] 2xl:h-[75vh] object-cover"
          />
        ) : (
          <div className="w-full h-[60vh] sm:h-[55vh] md:h-[60vh] lg:h-[65vh] xl:h-[70vh] 2xl:h-[75vh] bg-gray-900" />
        )}

        <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8 lg:p-10 text-white">
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-semibold mb-2 drop-shadow-lg">
            {movie.title}
          </h1>

          <div className="flex items-center gap-2 text-[9px] sm:text-[10px] md:text-sm text-white/70 mb-2">
            <span>{movie.year}</span>
            <span>·</span>
            <span className="text-white/80 font-medium">{rating}</span>
            {movie.genres.length > 0 && (
              <>
                <span>·</span>
                <span>{movie.genres.slice(0, 3).join(", ")}</span>
              </>
            )}
          </div>
        </div>

        <div className="absolute hidden xl:flex justify-center bottom-4 inset-x-0">
          <ul className="flex gap-2 backdrop-blur-md items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
            {renderIndicators()}
          </ul>
        </div>
      </div>
    </section>
  );
};
