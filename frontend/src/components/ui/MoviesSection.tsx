import { FC, useRef, useEffect } from "react";
import { Movies } from "@/types/Movies";

interface MoviesSectionProps {
  movies: Movies[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export const MoviesSection: FC<MoviesSectionProps> = ({ movies, loading, hasMore, onLoadMore }) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loading]);

  return (
    <section className="w-full max-w-400 mt-6 px-4 sm:px-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Films populaires
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {movies.map((m, index) => (
          <div
            key={`${m.id}-${index}`}
            className="group relative rounded-lg overflow-hidden bg-gray-900 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-2xl"
          >
            {m.coverUrl ? (
              <img
                src={m.coverUrl}
                alt={m.title}
                className="w-full h-87.5 object-cover"
              />
            ) : (
              <div className="w-full h-87.5 bg-gray-800 flex items-center justify-center text-white/40 text-sm">
                No image
              </div>
            )}

            <div className="absolute bottom-0 left-0 w-full h-2/5 bg-linear-to-t from-black via-black/60 to-transparent pointer-events-none" />

            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-inner" />

            <div className="absolute bottom-0 w-full p-3 text-white">
              <h3 className="text-sm font-semibold leading-tight line-clamp-2 drop-shadow-lg">
                {m.title}
              </h3>

              <div className="flex justify-between items-center text-[11px] text-white/90 mt-1 drop-shadow-md">
                <span>{m.releaseYear}</span>
                <span>{m.imdbRating?.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div ref={sentinelRef} className="w-full py-8 flex justify-center">
        {loading && (
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            Chargement...
          </div>
        )}
      </div>
    </section>
  );
};