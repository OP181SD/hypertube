import { FC, useEffect, useRef, useCallback } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { PosterImage } from "@/components/ui/PosterImage";
import type { HeroMovie } from "@/types/api";

interface HeroSectionProps {
  movies: HeroMovie[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const AUTOPLAY_INTERVAL = 6000;

export const HeroSection: FC<HeroSectionProps> = ({
  movies,
  activeIndex,
  setActiveIndex,
}) => {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const goNext = useCallback(() => {
    setActiveIndex((activeIndex + 1) % movies.length);
  }, [activeIndex, movies.length, setActiveIndex]);

  const goPrev = useCallback(() => {
    setActiveIndex((activeIndex - 1 + movies.length) % movies.length);
  }, [activeIndex, movies.length, setActiveIndex]);

  useEffect(() => {
    if (movies.length <= 1) return;

    const start = () => {
      timerRef.current = setInterval(() => {
        if (!pausedRef.current) goNext();
      }, AUTOPLAY_INTERVAL);
    };

    start();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [goNext, movies.length]);

  const handleMouseEnter = () => {
    pausedRef.current = true;
  };

  const handleMouseLeave = () => {
    pausedRef.current = false;
  };

  const handleSelect = (index: number) => {
    setActiveIndex(index);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) goNext();
    }, AUTOPLAY_INTERVAL);
  };

  if (!movies.length) return null;

  const movie = movies[activeIndex];
  const rating = movie.rating?.toFixed(1) ?? "N/A";

  return (
    <section
      className="relative w-full overflow-hidden group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative w-full h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)]">

        {movies.map((m, index) => {
          const img = m.backdropUrl ?? m.posterUrl;
          return (
            <div
              key={m.tmdbId}
              className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-in-out ${
                index === activeIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              {img ? (
                <PosterImage
                  src={img}
                  alt={m.title}
                  placeholder="silent"
                  className="w-full h-full object-cover object-[center_20%]"
                  placeholderClassName="w-full h-full bg-gray-900"
                />
              ) : (
                <div className="w-full h-full bg-gray-900" />
              )}
            </div>
          );
        })}

        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/60 via-transparent to-transparent" />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-5 sm:p-8 md:p-10 lg:p-14 pb-14 sm:pb-16 text-white">
          <button
            type="button"
            className="pointer-events-auto w-fit max-w-2xl text-left cursor-pointer"
            onClick={() => navigate(`/movies/${movie.id}`)}
          >
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-2 sm:mb-3 drop-shadow-lg hover:underline">
              {movie.title}
            </h1>

            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base text-white/70 mb-3">
              {movie.year && <span>{movie.year}</span>}
              <span>·</span>
              <span className="text-yellow-400 font-semibold">{rating}</span>
              {movie.genres.length > 0 && (
                <>
                  <span>·</span>
                  <span>{movie.genres.slice(0, 3).join(", ")}</span>
                </>
              )}
            </div>

            {movie.overview && (
              <p className="hidden sm:block text-sm md:text-base text-white/60 max-w-xl line-clamp-3 leading-relaxed">
                {movie.overview}
              </p>
            )}
          </button>
        </div>

        {movies.length > 1 && (
          <button
            type="button"
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 sm:left-4 top-1/2 z-20 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity duration-300 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full p-2 sm:p-3 text-white cursor-pointer"
            aria-label="Previous movie"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 sm:h-6">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {movies.length > 1 && (
          <button
            type="button"
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 sm:right-4 top-1/2 z-20 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity duration-300 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full p-2 sm:p-3 text-white cursor-pointer"
            aria-label="Next movie"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 sm:h-6">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        {movies.length > 1 && (
          <div className="absolute bottom-4 sm:bottom-6 inset-x-0 z-20 flex justify-center">
            <ul className="flex gap-1.5 sm:gap-2 items-center px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
              {movies.map((m, index) => (
                <li
                  key={m.id}
                  onClick={() => handleSelect(index)}
                  className={`rounded-full cursor-pointer transition-all duration-300 ${
                    index === activeIndex
                      ? "w-6 sm:w-8 h-1.5 sm:h-2 bg-white"
                      : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
