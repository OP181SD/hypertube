import type { TorrentItem } from "@/types/api";

const QUALITY_RANK: Record<string, number> = { "1080p": 0, "720p": 1, "480p": 2, "2160p": 4 };

function qualityRank(quality: string): number {
  return QUALITY_RANK[quality.toLowerCase()] ?? 3;
}

export function pickDefaultTorrent(torrents: TorrentItem[]): TorrentItem | null {
  if (torrents.length === 0) return null;
  const isSeries = torrents.some((torrent) => torrent.season != null);

  return [...torrents].sort(
    (a, b) =>
      (isSeries
        ? (b.season ?? -1) - (a.season ?? -1) || (b.episode ?? -1) - (a.episode ?? -1)
        : 0) ||
      qualityRank(a.quality) - qualityRank(b.quality) ||
      b.seeds - a.seeds ||
      a.id.localeCompare(b.id),
  )[0];
}
