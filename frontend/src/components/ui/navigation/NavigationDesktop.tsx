import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SortTypes } from "./types/filters";

interface NavigationDesktopProps {
  openGenres: boolean;
  openCategory: boolean;
  setOpenGenres: (value: boolean) => void;
  setOpenCategory: (value: boolean) => void;
  genres: string[];
  sortTypes: SortTypes[];
  onSelectGenre: (genreName: string) => void;
  onSelectSort?: (sortType: SortTypes) => void;
}

export const NavigationDesktop: React.FC<NavigationDesktopProps> = ({
  openGenres,
  openCategory,
  setOpenGenres,
  setOpenCategory,
  genres,
  sortTypes,
  onSelectGenre,
  onSelectSort,
}) => {
  const { t } = useTranslation(); 

  const [activeGenre, setActiveGenre] = useState<string>("");
  const [activeSort, setActiveSort] = useState<SortTypes>("Popular");

  const handleClickGenre = (genre: string) => {
    setActiveGenre(genre);
    onSelectGenre(genre);
  };

  const handleClickSort = (type: SortTypes) => {
    setActiveSort(type);
    onSelectSort?.(type);
  };

  const genreLabels: Record<string, string> = {};
  genres.forEach((genre) => {
    genreLabels[genre] = t(`genres.${genre}`);
  });


  return (
    <div className="hidden lg:flex relative justify-center flex-nowrap items-center gap-3 px-4 sm:px-6 md:px-8 lg:px-10 overflow-x-auto no-scrollbar">

      <button
        className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 whitespace-nowrap ${
          activeGenre === ""
            ? "bg-white text-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
            : "bg-white/6 backdrop-blur-sm text-white/80 border border-white/12 hover:bg-white/12 hover:text-white hover:border-white/20"
        }`}
        onClick={() => handleClickGenre("")}
      >
        {t("all")}
      </button>

      <div className="w-px h-5 sm:h-6 bg-white/8" />

      <div className="relative flex justify-center" onClick={() => setOpenGenres(!openGenres)}>
        <button className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium bg-white/6 backdrop-blur-sm text-white/80 border border-white/12 hover:bg-white/12 hover:text-white hover:border-white/20 transition-all duration-200 cursor-pointer whitespace-nowrap">
          {t("genres_title")}
        </button>
      </div>

      <div
        className={`flex gap-2.5 transition-all duration-500 items-center overflow-hidden ${
          openGenres ? "max-w-full opacity-100 translate-x-0" : "max-w-0 opacity-0 -translate-x-10"
        }`}
      >
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => handleClickGenre(genre)}
            className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 whitespace-nowrap ${
              activeGenre === genre
                ? "bg-white text-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
                : "bg-white/6 backdrop-blur-sm text-white/80 border border-white/12 hover:bg-white/12 hover:text-white hover:border-white/20"
            }`}
          >
           {genre}
          </button>
        ))}
      </div>

      <div className="w-px h-5 sm:h-6 bg-white/8" />

      <div className="relative flex justify-center" onClick={() => setOpenCategory(!openCategory)}>
        <button className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium bg-white/6 backdrop-blur-sm text-white/80 border border-white/12 hover:bg-white/12 hover:text-white hover:border-white/20 transition-all duration-200 cursor-pointer whitespace-nowrap">
          {t("category_title")}
        </button>
      </div>

      <div
        className={`flex gap-2.5 transition-all duration-500 items-center overflow-hidden ${
          openCategory ? "max-w-full opacity-100 translate-x-0" : "max-w-0 opacity-0 -translate-x-10"
        }`}
      >
        {sortTypes.map((type) => (
          <button
            key={type}
            onClick={() => handleClickSort(type)}
            className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 whitespace-nowrap ${
              activeSort === type
                ? "bg-white text-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
                : "bg-white/6 backdrop-blur-sm text-white/80 border border-white/12 hover:bg-white/12 hover:text-white hover:border-white/20"
            }`}
          >
                {t(`sort.${type}`)}
          </button>
        ))}
      </div>
    </div>
  );
};