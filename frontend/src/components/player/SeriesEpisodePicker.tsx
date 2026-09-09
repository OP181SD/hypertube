import { FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TorrentItem } from "@/types/api";

interface SeriesEpisodePickerProps {
  torrents: TorrentItem[];
  selectedId: string | null;
  onSelect: (torrentId: string) => void;
}

function formatSize(sizeBytes: string): string {
  const bytes = Number(sizeBytes);
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

export const SeriesEpisodePicker: FC<SeriesEpisodePickerProps> = ({
  torrents,
  selectedId,
  onSelect,
}) => {
  const { t } = useTranslation();

  const { seasons, bySeason, other } = useMemo(() => {
    const bySeason = new Map<number, Map<number, TorrentItem[]>>();
    const other: TorrentItem[] = [];

    for (const torrent of torrents) {
      if (torrent.season == null || torrent.episode == null) {
        other.push(torrent);
        continue;
      }
      if (!bySeason.has(torrent.season)) bySeason.set(torrent.season, new Map());
      const episodes = bySeason.get(torrent.season)!;
      if (!episodes.has(torrent.episode)) episodes.set(torrent.episode, []);
      episodes.get(torrent.episode)!.push(torrent);
    }

    for (const episodes of bySeason.values())
      for (const releases of episodes.values())
        releases.sort((a, b) => b.seeds - a.seeds || a.id.localeCompare(b.id));

    const seasons = [...bySeason.keys()].sort((a, b) => b - a);
    return { seasons, bySeason, other };
  }, [torrents]);

  const selected = torrents.find((torrent) => torrent.id === selectedId);
  const [season, setSeason] = useState<number | null>(
    selected?.season ?? seasons[0] ?? null,
  );
  const [openEpisode, setOpenEpisode] = useState<number | null>(
    selected?.episode ?? null,
  );

  const episodes =
    season != null && bySeason.has(season)
      ? [...bySeason.get(season)!.keys()].sort((a, b) => b - a)
      : [];

  const pill = (active: boolean) =>
    `shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? "bg-blue-600 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
    }`;

  const release = (active: boolean) =>
    `flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? "bg-blue-600 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
    }`;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-white/70">{t("episodes")}</h3>

      {seasons.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {seasons.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSeason(s);
                setOpenEpisode(null);
              }}
              className={pill(season === s)}
            >
              S{s}
            </button>
          ))}
          {other.length > 0 && (
            <button
              onClick={() => {
                setSeason(null);
                setOpenEpisode(null);
              }}
              className={pill(season === null)}
            >
              {t("other")}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {season != null &&
          episodes.map((ep) => {
            const releases = bySeason.get(season)!.get(ep)!;
            const isOpen = openEpisode === ep;
            const hasSelected = releases.some((r) => r.id === selectedId);
            return (
              <div
                key={ep}
                className="rounded-lg bg-white/5 border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => setOpenEpisode(isOpen ? null : ep)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  <span
                    className={`text-sm font-medium ${
                      hasSelected ? "text-blue-400" : "text-white"
                    }`}
                  >
                    S{season}E{String(ep).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-white/40">
                    {releases.length} {t("releases")}
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-1 px-3 pb-2">
                    {releases.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => onSelect(r.id)}
                        className={release(selectedId === r.id)}
                      >
                        <span>{r.quality}</span>
                        <span className="text-xs text-white/50">
                          {formatSize(r.sizeBytes)} · {r.seeds} {t("seeds")} ·{" "}
                          {r.peers} {t("leechers")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        {season === null &&
          other.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={release(selectedId === r.id)}
            >
              <span>{r.quality}</span>
              <span className="text-xs text-white/50">
                {formatSize(r.sizeBytes)} · {r.seeds} {t("seeds")} ·{" "}
                {r.peers} {t("leechers")}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
};
