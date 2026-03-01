import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PlayIcon, PlusIcon, ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import type { MovieDetail, Comment } from "@/types/api";
import { getComments } from "@/api/comments.api";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { useChangeLanguage } from "@/hooks/useChangeLanguage";
import { useWatchlist } from "@/hooks/useWatchlist";

interface MoviePresentationProps {
  movie: MovieDetail;
}

const MoviePresentation: React.FC<MoviePresentationProps> = ({ movie }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { changeLanguage, currentLang } = useChangeLanguage();
  const { inWatchlist, watchlistLoading, toggleWatchlist } = useWatchlist(movie.id, movie.inWatchlist);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

  const synopsisLimit = 500;
  const isLongSynopsis = movie.summary && movie.summary.length > synopsisLimit;
  const displayedSynopsis =
    !showFullSynopsis && isLongSynopsis
      ? movie.summary?.slice(0, synopsisLimit) + "..."
      : movie.summary;

  const refreshComments = useCallback(() => {
    if (!movie.id) return;
    getComments(movie.id)
      .then(setComments)
      .catch(() => {
        console.error("Erreur lors de la récupération des commentaires");
      });
  }, [movie.id]);

  const handlePlay = () => {
    navigate(`/movies/${movie.id}`);
  };

  const handleBack = () => navigate(-1);
  const handleLogout = () => navigate("/login");

  return (
    <div className="bg-black min-h-screen">
      <nav className="h-14 md:h-16 px-3 sm:px-4 md:px-6 xl:px-8 bg-black/80 backdrop-blur-xl fixed w-full top-0 z-50 border-b border-white/10 shadow-2xl">
        <div className="flex items-center justify-between h-full max-w-full mx-auto w-full gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all duration-300 hover:scale-105"
            >
              <ArrowLeftIcon className="w-5 h-5 text-white" />
            </button>
            <span className="text-xs sm:text-sm md:text-base text-white/70 font-medium">Hyper</span>
            <span className="ml-0.5 sm:ml-1 text-xs sm:text-sm md:text-base font-medium bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
              Tube
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 shrink-0 ml-auto">
            <select
              value={currentLang}
              onChange={(e) => changeLanguage(e.target.value)}
              className="bg-white/5 backdrop-blur-md text-white/90 px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-all duration-300 text-xs sm:text-sm cursor-pointer outline-none shadow-lg"
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="es">ES</option>
            </select>

            <button
              onClick={handleLogout}
              className="hidden sm:block px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/10 text-white/90 text-sm font-medium transition-all duration-300 hover:scale-105 backdrop-blur-sm shadow-lg"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </nav>

      {/* HEADER IMAGE */}
      <div
        className="relative w-full h-[60vh] sm:h-[70vh] lg:h-[75vh] max-h-200 bg-cover bg-center bg-no-repeat flex items-end mt-14 md:mt-16"
        style={{ backgroundImage: `url(${movie.backdropUrl || movie.posterUrl})` }}
      >
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black/90" />
        <h1 className="absolute top-8 left-4 sm:left-8 text-3xl sm:text-4xl lg:text-6xl font-bold text-white drop-shadow-2xl max-w-3xl z-10">
          {movie.title}
        </h1>

        <div className="relative z-10 flex flex-col lg:flex-row text-white gap-4 lg:gap-6 justify-center px-4 sm:px-8 lg:px-12 pb-8 lg:pb-12 w-full">
          <div className="flex flex-row lg:flex-col gap-3 lg:gap-4 lg:flex">
            <button
              onClick={handlePlay}
              className="flex items-center justify-center gap-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all duration-300 w-full lg:w-48 h-12 text-sm sm:text-base shadow-2xl hover:shadow-white/20 hover:scale-105"
            >
              <PlayIcon className="w-5 h-5" />
              {movie.watched ? "Revoir" : "Regarder"}
            </button>

            <button
              onClick={toggleWatchlist}
              disabled={watchlistLoading}
              className={`flex items-center justify-center gap-2 backdrop-blur-md font-bold rounded-lg transition-all duration-300 w-full lg:w-48 h-12 text-sm sm:text-base border shadow-2xl hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed ${
                inWatchlist
                  ? "bg-blue-500/30 border-blue-400/50 text-blue-200 hover:bg-red-500/30 hover:border-red-400/50 hover:text-red-200"
                  : "bg-white/10 border-white/20 text-white hover:bg-white/20"
              }`}
            >
              {watchlistLoading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : inWatchlist ? (
                <CheckIcon className="w-5 h-5" />
              ) : (
                <PlusIcon className="w-5 h-5" />
              )}
              {t(inWatchlist ? "in_watchlist" : "add_to_watchlist")}
            </button>
          </div>

          <div className="lg:flex flex flex-col gap-4 lg:gap-6">
            <p className="text-sm sm:text-base leading-relaxed drop-shadow-lg">
              {displayedSynopsis}
              {isLongSynopsis && !showFullSynopsis && (
                <button
                  onClick={() => setShowFullSynopsis(true)}
                  className="underline ml-2 hover:text-gray-300 transition-all duration-300"
                >
                  Afficher plus
                </button>
              )}
            </p>

            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm drop-shadow-lg">
              {movie.year && <span className="bg-white/5 backdrop-blur-sm px-2 py-1 rounded border border-white/10">{movie.year}</span>}
              {movie.runtime && <span className="bg-white/5 backdrop-blur-sm px-2 py-1 rounded border border-white/10">{movie.runtime} min</span>}
              {movie.imdbRating && (
                <span className="flex items-center gap-1 bg-white/5 backdrop-blur-sm px-2 py-1 rounded border border-white/10">
                  <span className="bg-linear-to-r from-[#795EF0] via-[#C270ED] to-[#38BDF8] bg-clip-text text-transparent">★</span>
                  <span className="bg-linear-to-r from-[#795EF0] via-[#C270ED] to-[#38BDF8] bg-clip-text text-transparent">{movie.imdbRating}</span>
                </span>
              )}
              {movie.genres.map((g) => <span key={g} className="bg-white/5 backdrop-blur-sm px-2 py-1 rounded border border-white/10">{g}</span>)}
            </div>

            <div className="text-xs sm:text-sm drop-shadow-lg">
              {movie.director && (
                <p className="bg-white/5 backdrop-blur-sm px-3 py-2 rounded border border-white/10 mb-2">
                  <strong>Réalisateur :</strong> {movie.director}
                </p>
              )}
              {movie.cast.length > 0 && (
                <p className="bg-white/5 backdrop-blur-sm px-3 py-2 rounded border border-white/10">
                  <strong>Avec :</strong> {movie.cast.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <CommentsSection
          movieId={movie.id}
          comments={comments}
          onCommentChange={refreshComments}
        />
      </div>
    </div>
  );
};

export default MoviePresentation;