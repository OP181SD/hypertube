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
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTorrentId, setSelectedTorrentId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([getMovie(id), getComments(id)])
      .then(([movieData, commentsData]) => {
        if (!cancelled) {
          setMovie(movieData);
          setComments(commentsData);
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
    getComments(id).then(setComments).catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
          {t("loading")}
        </div>
      </div>
    );
  }

  if (!movie) return null;

  const rating = movie.imdbRating?.toFixed(1) ?? "N/A";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative">
        {movie.posterUrl && (
          <div className="absolute inset-0 h-96">
            <img
              src={movie.posterUrl}
              alt=""
              className="w-full h-full object-cover opacity-20 blur-xl"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
          </div>
        )}

        <div className="relative max-w-5xl mx-auto px-4 pt-8 pb-12">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 text-white/60 hover:text-white text-sm flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("back")}
          </button>

          <div className="flex flex-col md:flex-row gap-6">
            {movie.posterUrl && (
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-48 md:w-56 rounded-lg shadow-2xl self-start"
              />
            )}

            <div className="flex-1 flex flex-col gap-3">
              <h1 className="text-2xl md:text-3xl font-bold">{movie.title}</h1>

              <div className="flex items-center gap-3 text-sm text-white/70">
                <span>{movie.year}</span>
                <span className="text-white/80 font-medium">{rating}</span>
                {movie.runtime && <span>{movie.runtime} min</span>}
              </div>

              {movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {movie.genres.map((g) => (
                    <span key={g} className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/70">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {movie.summary && (
                <p className="text-sm text-white/70 leading-relaxed">{movie.summary}</p>
              )}

              {movie.producer && (
                <p className="text-sm text-white/50">
                  <span className="text-white/70">{t("producer")}:</span> {movie.producer}
                </p>
              )}

              {movie.director && (
                <p className="text-sm text-white/50">
                  <span className="text-white/70">{t("director")}:</span> {movie.director}
                </p>
              )}

              {movie.cast.length > 0 && (
                <p className="text-sm text-white/50">
                  <span className="text-white/70">{t("cast")}:</span> {movie.cast.join(", ")}
                </p>
              )}

              <QualitySelector
                torrents={movie.torrents}
                selectedId={selectedTorrentId}
                onSelect={setSelectedTorrentId}
              />
            </div>
          </div>

          {selectedTorrentId && (
            <div className="mt-8">
              <VideoPlayer
                torrentId={selectedTorrentId}
                movieId={movie.id}
                subtitles={movie.subtitles}
              />
            </div>
          )}

          <div className="mt-8">
            <CommentsSection
              movieId={movie.id}
              comments={comments}
              onCommentChange={refreshComments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
