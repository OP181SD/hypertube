import { useState } from "react";
import { addToWatchlist, removeFromWatchlist } from "@/api/watchlist.api";

export function useWatchlist(movieId: string, initialState: boolean) {
  const [inWatchlist, setInWatchlist] = useState(initialState);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  const toggleWatchlist = async () => {
    if (watchlistLoading) return;
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(movieId);
        setInWatchlist(false);
      } else {
        await addToWatchlist(movieId);
        setInWatchlist(true);
      }
    } catch {

    } finally {
      setWatchlistLoading(false);
    }
  };

  return { inWatchlist, watchlistLoading, toggleWatchlist };
}
