// NavigationGender.tsx
import { useState } from "react";
import { genres, sortTypes } from "./types/filters";
import { NavigationDesktop } from "./NavigationDesktop";
import { NavigationMobile } from "./NavigationMobile";

interface NavigationGenderProps {
  onSelectGenre: (genreName: string) => void;
}

export const NavigationGender: React.FC<NavigationGenderProps> = ({ onSelectGenre }) => {

  const [openGenres, setOpenGenres] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);

  return (
    <div className="relative border-8e py-3 w-full my-4">
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/5 to-transparent pointer-events-none" />

      <NavigationDesktop
        openGenres={openGenres}
        openCategory={openCategory}
        setOpenGenres={setOpenGenres}
        setOpenCategory={setOpenCategory}
        genres={genres}
        sortTypes={sortTypes}
        onSelectGenre={onSelectGenre}
      />

      <NavigationMobile
        openGenres={openGenres}
        openCategory={openCategory}
        setOpenGenres={setOpenGenres}
        setOpenCategory={setOpenCategory}
        genres={genres}
        sortTypes={sortTypes}
      />
    </div>
  );
};