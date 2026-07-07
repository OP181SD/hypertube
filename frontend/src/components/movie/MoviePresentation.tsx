import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PlayIcon, PlusIcon, ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import type { MovieDetail, Comment } from "@/types/api";
import { getComments } from "@/api/comments.api";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { PosterImage } from "@/components/ui/PosterImage";
import { useWatchlist } from "@/hooks/useWatchlist";

interface MoviePresentationProps {
  movie: MovieDetail;
}

const MoviePresentation: React.FC<MoviePresentationProps> = ({ movie }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      .catch(() => {});
  }, [movie.id]);

  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  const headerImage = movie.backdropUrl ?? movie.posterUrl;

  return (
    <div className="bg-black min-h-screen">
      <div className="relative w-full h-[50vh] sm:h-[70vh] lg:h-[75vh] max-h-200 overflow-hidden flex items-end">
        <PosterImage
          src={headerImage}
          alt={movie.title}
          placeholder="silent"
          className="absolute inset-0 w-full h-full object-cover object-center"
          placeholderClassName="absolute inset-0 w-full h-full bg-gray-900"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black/90" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 sm:left-8 z-10 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-all duration-300 hover:scale-105"
        >
          <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </button>

        <h1 className="absolute top-12 sm:top-16 left-3 sm:left-8 right-3 sm:right-auto text-2xl sm:text-4xl lg:text-6xl font-bold text-white drop-shadow-2xl max-w-3xl z-10 leading-tight">
          {movie.title}
        </h1>

        <div className="relative z-10 flex flex-col lg:flex-row text-white gap-3 sm:gap-4 lg:gap-6 justify-center px-3 sm:px-8 lg:px-12 pb-4 sm:pb-8 lg:pb-12 w-full">

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 sm:gap-3 lg:gap-4">
            <button
              onClick={() => navigate(`/movies/${movie.id}`)}
              className="flex items-center justify-center gap-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all duration-300 w-full sm:w-auto lg:w-48 h-11 sm:h-12 text-sm sm:text-base shadow-2xl hover:shadow-white/20 hover:scale-105"
            >
              <PlayIcon className="w-5 h-5" />
              {movie.watched ? t("rewatch") : t("watch")}
            </button>

            <button
              onClick={toggleWatchlist}
              disabled={watchlistLoading}
              className={`flex items-center justify-center gap-2 backdrop-blur-md font-bold rounded-lg transition-all duration-300 w-full sm:w-auto lg:w-48 h-11 sm:h-12 text-sm sm:text-base border shadow-2xl hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed ${
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

    
          <div className="flex flex-col gap-3 sm:gap-4 lg:gap-6 min-w-0">
            <p className="text-xs sm:text-base leading-relaxed drop-shadow-lg line-clamp-4 sm:line-clamp-none">
              {displayedSynopsis}
              {isLongSynopsis && !showFullSynopsis && (
                <button
                  onClick={() => setShowFullSynopsis(true)}
                  className="underline ml-2 hover:text-gray-300 transition-all duration-300"
                >
                  {t("show_more")}
                </button>
              )}
            </p>

            <div className="flex flex-nowrap sm:flex-wrap gap-2 sm:gap-3 text-[11px] sm:text-sm drop-shadow-lg overflow-x-auto scrollbar-hide pb-1">
              {movie.year && <span className="shrink-0 bg-white/5 backdrop-blur-sm px-2 py-1 rounded border border-white/10">{movie.year}</span>}
              {movie.runtime && <span className="shrink-0 bg-white/5 backdrop-blur-sm px-2 py-1 rounded border border-white/10">{movie.runtime} min</span>}
              {movie.imdbRating && (
                <span className="shrink-0 flex items-center gap-1 bg-white/5 backdrop-blur-sm px-2 py-1 rounded border border-white/10">
                  <span className="bg-linear-to-r from-[#795EF0] via-[#C270ED] to-[#38BDF8] bg-clip-text text-transparent">★</span>
                  <span className="bg-linear-to-r from-[#795EF0] via-[#C270ED] to-[#38BDF8] bg-clip-text text-transparent">{movie.imdbRating}</span>
                </span>
              )}
              {movie.genres.map((g) => (
                <span key={g} className="shrink-0 bg-white/5 backdrop-blur-sm px-2 py-1 rounded border border-white/10">{g}</span>
              ))}
            </div>

            <div className="hidden sm:block text-xs sm:text-sm drop-shadow-lg">
              {movie.director && (
                <p className="bg-white/5 backdrop-blur-sm px-3 py-2 rounded border border-white/10 mb-2">
                  <strong>{t("director")} :</strong> {movie.director}
                </p>
              )}
              {movie.producer && (
                <p className="bg-white/5 backdrop-blur-sm px-3 py-2 rounded border border-white/10 mb-2">
                  <strong>{t("producer")} :</strong> {movie.producer}
                </p>
              )}
              {movie.cast.length > 0 && (
                <p className="bg-white/5 backdrop-blur-sm px-3 py-2 rounded border border-white/10">
                  <strong>{t("cast")} :</strong> {movie.cast.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="block sm:hidden px-3 py-4 text-xs text-white/80 space-y-2">
        {movie.director && (
          <p className="bg-white/5 px-3 py-2 rounded border border-white/10">
            <strong>{t("director")} :</strong> {movie.director}
          </p>
        )}
        {movie.producer && (
          <p className="bg-white/5 px-3 py-2 rounded border border-white/10">
            <strong>{t("producer")} :</strong> {movie.producer}
          </p>
        )}
        {movie.cast.length > 0 && (
          <p className="bg-white/5 px-3 py-2 rounded border border-white/10">
            <strong>{t("cast")} :</strong> {movie.cast.join(", ")}
          </p>
        )}
      </div>

      <div className="mt-4 sm:mt-8 px-3 sm:px-0">
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