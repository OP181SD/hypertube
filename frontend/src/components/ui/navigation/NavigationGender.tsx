import { useState } from "react";
import { useTranslation } from "react-i18next";
import { genres, sortTypes } from "./types/filters";
import { NavigationDesktop } from "./NavigationDesktop";
import { SortTypes } from "./types/filters";
import { NavigationMobile } from "./NavigationMobile";

interface NavigationGenderProps {
  onSelectGenre: (genreName: string) => void;
  onSelectSort: (sortType: SortTypes) => void;
  onSelectMinRating?: (rating: number | undefined) => void;
  onSelectYearRange?: (range: [number?, number?]) => void;
}

const ratingOptions = [0, 5, 6, 7, 8, 9];
const currentYear = new Date().getFullYear();

export const NavigationGender: React.FC<NavigationGenderProps> = ({
  onSelectGenre,
  onSelectSort,
  onSelectMinRating,
  onSelectYearRange,
}) => {
  const { t } = useTranslation();
  const [openGenres, setOpenGenres] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);
  const [minRating, setMinRating] = useState<number | undefined>();
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");

  const handleRating = (val: string) => {
    const rating = val ? Number(val) : undefined;
    setMinRating(rating);
    onSelectMinRating?.(rating);
  };

  const handleMinYear = (val: string) => {
    setMinYear(val);
    const min = val ? Number(val) : undefined;
    const max = maxYear ? Number(maxYear) : undefined;
    onSelectYearRange?.([min, max]);
  };

  const handleMaxYear = (val: string) => {
    setMaxYear(val);
    const min = minYear ? Number(minYear) : undefined;
    const max = val ? Number(val) : undefined;
    onSelectYearRange?.([min, max]);
  };

  const translatedGenres = genres.map((genre) => t(`genres.${genre}`));

  return (
    <div className="relative w-full my-4 py-4 bg-white/3 backdrop-blur-sm border-y border-white/6">
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/5 to-transparent pointer-events-none" />

      <NavigationDesktop
        openGenres={openGenres}
        openCategory={openCategory}
        setOpenGenres={setOpenGenres}
        setOpenCategory={setOpenCategory}

        genres={translatedGenres}
        sortTypes={sortTypes}
        onSelectGenre={onSelectGenre}
        onSelectSort={onSelectSort}
      />

      <NavigationMobile
        openGenres={openGenres}
        openCategory={openCategory}
        setOpenGenres={setOpenGenres}
        setOpenCategory={setOpenCategory}

        genres={translatedGenres}
        sortTypes={sortTypes}
        onSelectGenre={onSelectGenre}
        onSelectSort={onSelectSort}
      />

      <div className="flex flex-wrap justify-center items-center gap-4 mt-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <label className="text-[11px] sm:text-xs text-white/40 tracking-wide">{t("min_rating")}:</label>
          <select
            value={minRating ?? ""}
            onChange={(e) => handleRating(e.target.value)}
            className="bg-white/6 backdrop-blur-sm text-white text-[11px] sm:text-xs px-2.5 py-1.5 rounded-lg border border-white/12 hover:border-white/25 hover:bg-white/10 focus:outline-none focus:border-white/30 transition-all duration-200 cursor-pointer"
          >
            <option value="">{t("all")}</option>
            {ratingOptions.map((r) => (
              <option key={r} value={r}>{r}+</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="text-[11px] sm:text-xs text-white/40 tracking-wide">{t("year")}:</label>
          <input
            type="number"
            value={minYear}
            onChange={(e) => handleMinYear(e.target.value)}
            placeholder="1900"
            min={1900}
            max={currentYear}
            className="w-16 sm:w-20 bg-white/6 backdrop-blur-sm text-white text-[11px] sm:text-xs px-2.5 py-1.5 rounded-lg border border-white/12 hover:border-white/25 hover:bg-white/10 focus:outline-none focus:border-white/30 placeholder-white/25 transition-all duration-200"
          />
          <span className="text-white/20 text-xs">—</span>
          <input
            type="number"
            value={maxYear}
            onChange={(e) => handleMaxYear(e.target.value)}
            placeholder={String(currentYear)}
            min={1900}
            max={currentYear}
            className="w-16 sm:w-20 bg-white/6 backdrop-blur-sm text-white text-[11px] sm:text-xs px-2.5 py-1.5 rounded-lg border border-white/12 hover:border-white/25 hover:bg-white/10 focus:outline-none focus:border-white/30 placeholder-white/25 transition-all duration-200"
          />
        </div>
      </div>
    </div>
  );
};
