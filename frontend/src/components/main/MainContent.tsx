import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { fetchFrontpageMovies } from "@/api/movies.api";
import { PosterImage } from "@/components/ui/PosterImage";
import type { HeroMovie } from "@/types/api";

export default function MainContent() {
  const { t } = useTranslation();
  const { openAuthModal } = useAuthModal();
  const [topMovies, setTopMovies] = useState<HeroMovie[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingTop(true);
    fetchFrontpageMovies()
      .then((movies) => {
        if (!cancelled) setTopMovies(movies.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setTopMovies([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTop(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-4">
      <div className="flex w-full max-w-5xl flex-col items-center text-center">
        <h1
          className="
            text-[32px]
            leading-tight
            font-extrabold
            tracking-wide
            text-white
            uppercase
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
            max-w-70
            text-[14px]
            leading-relaxed
            font-medium
            text-white/90
            sm:mt-4
            sm:max-w-md
            sm:text-[15px]
            md:max-w-lg
            md:text-[18px]
            lg:text-[20px]
          "
        >
          {t("simple_fluid_fast")}
          <span className="colors-title-gradient"> {t("new_experience")}</span>
        </p>

        <p className="mt-6 max-w-md text-sm text-white/60 sm:mt-8 sm:text-base">
          {t("identify_description")}
        </p>

        <button
          type="button"
          onClick={openAuthModal}
          className="mt-6 cursor-pointer rounded-xl bg-[#0071e3] px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] sm:mt-8 sm:px-10 sm:py-4 sm:text-base"
        >
          {t("start_watching")}
        </button>

        {(loadingTop || topMovies.length > 0) && (
          <div className="mt-10 w-full sm:mt-12">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">
              {t("top_movies")}
            </p>
            <div className="flex justify-center gap-2 sm:gap-3 md:gap-4">
              {loadingTop
                ? Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={i}
                      className="aspect-2/3 w-[18%] max-w-[140px] animate-pulse rounded-lg bg-white/10"
                    />
                  ))
                : topMovies.map((movie, index) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={openAuthModal}
                      className="group relative w-[18%] max-w-[140px] cursor-pointer text-left"
                    >
                      <div className="relative overflow-hidden rounded-lg ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-[1.03] group-hover:ring-white/25">
                        <PosterImage
                          src={movie.posterUrl}
                          alt={movie.title}
                          className="aspect-2/3 w-full object-cover"
                          placeholder="silent"
                        />
                        <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/75 text-xs font-bold text-white sm:h-7 sm:w-7 sm:text-sm">
                          {index + 1}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-snug text-white/80 sm:text-xs">
                        {movie.title}
                      </p>
                      {(movie.year != null || movie.rating > 0) && (
                        <p className="mt-0.5 text-[10px] text-white/45 sm:text-[11px]">
                          {[
                            movie.year,
                            movie.rating > 0 ? movie.rating.toFixed(1) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </button>
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
