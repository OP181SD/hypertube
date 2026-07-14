import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookmarkSlashIcon, BookmarkIcon } from "@heroicons/react/24/solid";
import { getWatchlist, removeFromWatchlist } from "@/api/watchlist.api";
import { PosterImage } from "@/components/ui/PosterImage";
import type { MovieListItem } from "@/types/api";

export function WatchlistPage() {
  const { t } = useTranslation();
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    getWatchlist()
      .then(setMovies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (movieId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRemoving(movieId);
    try {
      await removeFromWatchlist(movieId);
      setMovies((prev) => prev.filter((m) => m.id !== movieId));
    } catch {

    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <BookmarkIcon className="w-16 h-16 text-white/20 mb-4" />
        <h3 className="text-xl font-semibold text-white/80 mb-2">
          {t("watchlist_empty")}
        </h3>
        <p className="text-white/50 max-w-sm">
          {t("watchlist_empty_detail")}
        </p>
      </div>
    );
  }

  return (
    <section className="w-full max-w-400 mt-6 px-4 sm:px-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        {t("my_watchlist")} ({movies.length})
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {movies.map((m) => (
          <div key={m.id} className="group relative">
            <Link
              to={`/movies/preview/${m.id}`}
              className="block relative rounded-lg overflow-hidden bg-gray-900 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-2xl"
            >
              <PosterImage
                src={m.posterUrl}
                alt={m.title}
                className="w-full h-87.5 object-cover"
                placeholderClassName="w-full h-87.5 bg-gray-800 flex items-center justify-center text-white/40 text-sm"
              />

              {m.watched && (
                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              <div className="absolute bottom-0 left-0 w-full h-2/5 bg-linear-to-t from-black via-black/60 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="absolute bottom-0 w-full p-3 text-white">
                <h3 className="text-sm font-semibold leading-tight line-clamp-2 drop-shadow-lg">
                  {m.title}
                </h3>
                <div className="flex justify-between items-center text-[11px] text-white/90 mt-1 drop-shadow-md">
                  <span>{m.year}</span>
                  <span>{m.imdbRating?.toFixed(1)}</span>
                </div>
              </div>
            </Link>

            <button
              onClick={(e) => handleRemove(m.id, e)}
              disabled={removing === m.id}
              title={t("remove_from_watchlist")}
              className="absolute top-2 left-2 bg-black/60 hover:bg-red-600/80 backdrop-blur-sm rounded-full p-1.5 transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50"
            >
              {removing === m.id ? (
                <div className="w-3.5 h-3.5 border border-white/60 border-t-white rounded-full animate-spin" />
              ) : (
                <BookmarkSlashIcon className="w-3.5 h-3.5 text-white" />
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
