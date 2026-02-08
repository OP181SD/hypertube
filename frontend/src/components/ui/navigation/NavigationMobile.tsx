// NavigationMobile.tsx
import { renderButton } from "./utils/renderButton";

interface NavigationMobileProps {
  openGenres: boolean;
  openCategory: boolean;
  setOpenGenres: (value: boolean) => void;
  setOpenCategory: (value: boolean) => void;
  genres: string[];
  sortTypes: string[];
}

export const NavigationMobile: React.FC<NavigationMobileProps> = ({
  openGenres,
  openCategory,
  setOpenGenres,
  setOpenCategory,
  genres,
  sortTypes,
}) => {
  return (
    <div className="lg:hidden px-4 sm:px-6">
      <div className="space-y-4">
        <div className="flex justify-center">
          {renderButton("All", true)}
        </div>
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
        {genres.map((genre) => renderButton(genre))}
          </div>
        </div>

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
            {sortTypes.map((genre) => renderButton(genre))}
          </div>
        </div>
      </div>
    </div>
  );
};