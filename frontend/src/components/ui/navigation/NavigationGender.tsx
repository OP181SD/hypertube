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
    <div className="relative border-8e py-3 w-full my-4">
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/5 to-transparent pointer-events-none" />

      <NavigationDesktop
        openGenres={openGenres}
        openCategory={openCategory}
        setOpenGenres={setOpenGenres}
        setOpenCategory={setOpenCategory}
        // genres={genres}
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
        // genres={genres}
        genres={translatedGenres}
        sortTypes={sortTypes}
        onSelectGenre={onSelectGenre}
        onSelectSort={onSelectSort}
      />

      <div className="flex flex-wrap justify-center items-center gap-3 mt-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <label className="text-[11px] sm:text-xs text-white/50">{t("min_rating")}:</label>
          <select
            value={minRating ?? ""}
            onChange={(e) => handleRating(e.target.value)}
            className="bg-white/10 text-white text-[11px] sm:text-xs px-2 py-1 rounded-md border border-white/10 focus:outline-none"
          >
            <option value="">{t("all")}</option>
            {ratingOptions.map((r) => (
              <option key={r} value={r}>{r}+</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] sm:text-xs text-white/50">{t("year")}:</label>
          <input
            type="number"
            value={minYear}
            onChange={(e) => handleMinYear(e.target.value)}
            placeholder="1900"
            min={1900}
            max={currentYear}
            className="w-16 sm:w-18 bg-white/10 text-white text-[11px] sm:text-xs px-2 py-1 rounded-md border border-white/10 focus:outline-none placeholder-white/30"
          />
          <span className="text-white/30 text-xs">-</span>
          <input
            type="number"
            value={maxYear}
            onChange={(e) => handleMaxYear(e.target.value)}
            placeholder={String(currentYear)}
            min={1900}
            max={currentYear}
            className="w-16 sm:w-18 bg-white/10 text-white text-[11px] sm:text-xs px-2 py-1 rounded-md border border-white/10 focus:outline-none placeholder-white/30"
          />
        </div>
      </div>
    </div>
  );
};
