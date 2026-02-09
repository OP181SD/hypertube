import { FC } from "react";
import { useTranslation } from "react-i18next";
import type { TorrentItem } from "@/types/api";

interface QualitySelectorProps {
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

export const QualitySelector: FC<QualitySelectorProps> = ({
  torrents,
  selectedId,
  onSelect,
}) => {
  const { t } = useTranslation();

  if (torrents.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-white/70">{t("quality")}</h3>
      <div className="flex flex-wrap gap-2">
        {torrents.map((torrent) => (
          <button
            key={torrent.id}
            onClick={() => onSelect(torrent.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              selectedId === torrent.id
                ? "bg-blue-600 text-white"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            <span>{torrent.quality}</span>
            <span className="ml-2 text-xs text-white/50">
              {formatSize(torrent.sizeBytes)} · {torrent.seeds} {t("seeds")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
