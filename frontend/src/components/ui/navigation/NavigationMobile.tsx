// NavigationMobile.tsx
import { useState } from "react";
import { SortTypes } from "./types/filters";

interface NavigationMobileProps {
  openGenres: boolean;
  openCategory: boolean;
  setOpenGenres: (value: boolean) => void;
  setOpenCategory: (value: boolean) => void;
  genres: string[];
  sortTypes: SortTypes[];
  onSelectGenre: (genreName: string) => void;
  onSelectSort?: (sortType: SortTypes) => void;
}

export const NavigationMobile: React.FC<NavigationMobileProps> = ({
  openGenres,
  openCategory,
  setOpenGenres,
  setOpenCategory,
  genres,
  sortTypes,
  onSelectGenre,
  onSelectSort,
}) => {
  const [activeGenre, setActiveGenre] = useState<string>("");
  const [activeSort, setActiveSort] = useState<SortTypes>("Popular");

  const handleClickGenre = (genre: string) => {
    setActiveGenre(genre);
    onSelectGenre(genre);
  };

  const handleClickSort = (sort: SortTypes) => {
    setActiveSort(sort);
    onSelectSort?.(sort);
  };

  const renderButton = (label: string, isActive: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all duration-300 ${
        isActive ? "bg-white text-black shadow-md" : "bg-white/10 text-white hover:shadow-md"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="lg:hidden px-4 sm:px-6">
      <div className="space-y-4">

        {/* Bouton All */}
        <div className="flex justify-center">
          {renderButton("All", activeGenre === "", () => handleClickGenre(""))}
        </div>

        {/* Genres */}
        <div>
          <button
            onClick={() => setOpenGenres(!openGenres)}
            className="w-full text-left px-3 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>Genres</span>
            <svg 
              className={`w-4 h-4 transition-transform duration-300 ${openGenres ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            className={`grid grid-cols-2 sm:grid-cols-3 gap-2 transition-all duration-300 overflow-hidden ${
              openGenres ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            {genres.map((genre) =>
              renderButton(genre, activeGenre === genre, () => handleClickGenre(genre))
            )}
          </div>
        </div>

        {/* Category / Sort */}
        <div>
          <button
            onClick={() => setOpenCategory(!openCategory)}
            className="w-full text-left px-3 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>Category</span>
            <svg 
              className={`w-4 h-4 transition-transform duration-300 ${openCategory ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            className={`grid grid-cols-2 sm:grid-cols-3 gap-2 transition-all duration-300 overflow-hidden ${
              openCategory ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            {sortTypes.map((sort) =>
              renderButton(sort, activeSort === sort, () => handleClickSort(sort))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};