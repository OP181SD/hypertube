import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getMovie } from "@/api/movies.api";
import { getComments } from "@/api/comments.api";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { QualitySelector } from "@/components/player/QualitySelector";
import { CommentsSection } from "@/components/comments/CommentsSection";
import type { MovieDetail, Comment } from "@/types/api";

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTorrentId, setSelectedTorrentId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getMovie(id)
      .then((movieData) => {
        if (!cancelled) {
          setMovie(movieData);
          if (movieData.torrents.length > 0) {
            const best = [...movieData.torrents].sort((a, b) => b.seeds - a.seeds)[0];
            setSelectedTorrentId(best.id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) navigate("/dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, navigate]);

  const refreshComments = useCallback(() => {
    if (!id) return;
    getComments(id)
      .then(setComments)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  if (loading) {
    return (
      <div
        data-testid="movie-detail-loading"
        className="min-h-screen bg-linear-to-b from-black via-zinc-950 to-black flex items-center justify-center"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-white/80 rounded-full animate-pulse [animation-delay:0.2s]" />
          <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse [animation-delay:0.4s]" />
        </div>
      </div>
    );
  }

  if (!movie) return null;

  return (
    <div className="min-h-screen bg-black">
      <div className="relative">
        {movie.backdropUrl && (
          <div className="absolute inset-0 h-32 overflow-hidden">
            <img
              src={movie.backdropUrl}
              alt=""
              className="w-full h-full object-cover opacity-20 blur-2xl"
            />
            <div className="absolute inset-0 bg-linear-to-b from-black/60 to-black" />
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-6 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-white/60 hover:text-white transition-all duration-200"
          >
            <svg
              className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">{t("back")}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 pb-12">
        {selectedTorrentId ? (
          <VideoPlayer
            torrentId={selectedTorrentId}
            movieId={movie.id}
            subtitles={movie.subtitles}
          />
        ) : (
          <div className="flex items-center justify-center h-48 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm">
            {t("no_stream_available")}
          </div>
        )}

        <div className="mt-8 flex flex-col lg:flex-row gap-6 lg:gap-12">

          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-3">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60 mb-4">
              <span>{movie.year}</span>
              <span className="w-1 h-1 bg-white/40 rounded-full" />
              <div className="flex items-center gap-1.5">
                {movie.imdbRating && (
                  <p className="flex items-center gap-1 bg-linear-to-r from-[#795EF0] via-[#C270ED] to-[#38BDF8] bg-clip-text text-transparent font-semibold">
                    ★ {movie.imdbRating}
                  </p>
                )}
              </div>
              {movie.runtime && (
                <>
                  <span className="w-1 h-1 bg-white/40 rounded-full" />
                  <span>{movie.runtime} min</span>
                </>
              )}
            </div>

            {movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {movie.summary && (
              <p className="text-sm text-white/70 leading-relaxed mb-4">
                {movie.summary}
              </p>
            )}

            <QualitySelector
              torrents={movie.torrents}
              selectedId={selectedTorrentId}
              onSelect={setSelectedTorrentId}
            />
          </div>

          <div className="lg:w-80 space-y-3 text-sm text-white/70">
            {movie.posterUrl && (
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full rounded-xl"
              />
            )}

            {movie.director && (
              <div>
                <span className="text-white/50">{t("director")}</span>
                <p className="text-white mt-0.5">{movie.director}</p>
              </div>
            )}

            {movie.producer && (
              <div>
                <span className="text-white/50">{t("producer")}</span>
                <p className="text-white mt-0.5">{movie.producer}</p>
              </div>
            )}

            {movie.cast.length > 0 && (
              <div>
                <span className="text-white/50">{t("cast")}</span>
                <p className="text-white mt-0.5">{movie.cast.slice(0, 3).join(", ")}</p>
              </div>
            )}
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
    </div>
  );
}