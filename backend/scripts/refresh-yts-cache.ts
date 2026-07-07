import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { fetchWithTimeout } from "../src/common/http/fetch-with-timeout";
import type { YtsListResponse, YtsMovie } from "../src/movies/interfaces";

const YTS_BASE_URL =
  process.env.YTS_BASE_URL ?? "https://movies-api.accel.li/api/v2";
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

const YTS_TRACKERS = [
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.openbittorrent.com:80",
  "udp://tracker.coppersurfer.tk:6969",
  "udp://glotorrents.pw:6969/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://torrent.gresille.org:80/announce",
  "udp://p4p.arenabg.com:1337",
  "udp://tracker.leechers-paradise.org:6969",
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

function buildMagnetUrl(hash: string, title: string): string {
  const params = new URLSearchParams({ dn: title, xt: `urn:btih:${hash}` });
  for (const tracker of YTS_TRACKERS) {
    params.append("tr", tracker);
  }
  return `magnet:?${params.toString()}`;
}

async function fetchYtsPage(page: number): Promise<YtsMovie[]> {
  const url = new URL(`${YTS_BASE_URL}/list_movies.json`);
  url.searchParams.set("sort_by", "download_count");
  url.searchParams.set("order_by", "desc");
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_SIZE));

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    throw new Error(`YTS API returned ${response.status}`);
  }

  const data: YtsListResponse = await response.json();
  return data.data.movies ?? [];
}

async function cacheYtsMovies(movies: YtsMovie[]): Promise<void> {
  for (const yts of movies) {
    const movie = await prisma.movie.upsert({
      where: { imdbId: yts.imdb_code },
      create: {
        imdbId: yts.imdb_code,
        title: yts.title,
        year: yts.year,
        imdbRating: yts.rating,
        runtime: yts.runtime,
        posterUrl: yts.medium_cover_image?.trim() || null,
        backdropUrl: yts.background_image?.trim() || null,
        summary: yts.summary || null,
        genres: yts.genres ?? [],
        mediaType: "movie",
      },
      update: {
        imdbRating: yts.rating,
        posterUrl: yts.medium_cover_image?.trim() || undefined,
        backdropUrl: yts.background_image?.trim() || undefined,
      },
    });

    for (const torrent of yts.torrents ?? []) {
      const magnetUrl = buildMagnetUrl(torrent.hash, yts.title);
      await prisma.torrent.upsert({
        where: { hash: torrent.hash },
        create: {
          movieId: movie.id,
          hash: torrent.hash,
          quality: torrent.quality,
          source: "YTS",
          seeds: torrent.seeds,
          peers: torrent.peers,
          sizeBytes: BigInt(torrent.size_bytes),
          magnetUrl,
          torrentFileUrl: torrent.url,
        },
        update: {
          seeds: torrent.seeds,
          peers: torrent.peers,
          torrentFileUrl: torrent.url,
        },
      });
    }
  }
}

async function main() {
  let totalCached = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const movies = await fetchYtsPage(page);
    if (movies.length === 0) break;

    await cacheYtsMovies(movies);
    totalCached += movies.length;
    console.log(`Page ${page}: cached ${movies.length} movies`);
  }

  const withUrl = await prisma.torrent.count({
    where: { source: "YTS", torrentFileUrl: { not: null } },
  });
  const ytsTotal = await prisma.torrent.count({ where: { source: "YTS" } });

  console.log(`Done. Cached ${totalCached} movies from YTS API.`);
  console.log(`DB: ${withUrl}/${ytsTotal} YTS torrents have torrentFileUrl.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
