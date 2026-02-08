
import { useTranslation } from "react-i18next";

interface Props {
  search: string;
  setSearch: (value: string) => void;
}

export function SearchBar({ search, setSearch }: Props) {
  const { t } = useTranslation();

  return (
    <div className="relative w-full group">
      <div className="flex items-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-all duration-300 focus-within:bg-black/80 focus-within:border-white/30 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 md:h-5 md:w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search")} 
          className="w-full bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 focus:outline-none ml-2 sm:ml-3 text-xs sm:text-sm"
        />
      </div>
    </div>
  );
}