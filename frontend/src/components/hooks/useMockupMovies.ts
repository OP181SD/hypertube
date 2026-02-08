import { useEffect, useState } from "react";
import axios from "axios";
import { HeroMovie } from "@/types/Heromovie";

const API_KEY = "f974be2281a400200a07927981a67d4a";

const fetchHeroSection = async (page: number = 1): Promise<HeroMovie[]> => {
  const res = await axios.get("https://api.themoviedb.org/3/movie/popular", {
    params: {
      api_key: API_KEY,
      language: "fr-FR",
      page,
    },
  });
  const ArraySlice = res.data.results.slice(0,7);
  return ArraySlice;
};

export const useHeroMovies = () => {
  const [movies, setMovies] = useState<HeroMovie[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {

        const randomPage = Math.floor(Math.random() * 40) + 1;
        const moviesArray = await fetchHeroSection(randomPage);
        setMovies(moviesArray);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Une erreur est survenue lors du chargement des films héros");
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []); 
  return { movies, loading, error };
};