import { useState } from "react";
import { HeroMovie } from "@/types/Heromovie";

// Temporary stub — will be replaced in Phase 3 with backend API hook
export const useHeroMovies = () => {
  const [movies] = useState<HeroMovie[]>([]);
  const [loading] = useState<boolean>(false);
  const [error] = useState<string | null>(null);

  return { movies, loading, error };
};
