// YTS API types

export interface YtsTorrent {
  url: string;
  hash: string;
  quality: string;
  type: string;
  seeds: number;
  peers: number;
  size: string;
  size_bytes: number;
}

export interface YtsMovie {
  id: number;
  url: string;
  imdb_code: string;
  title: string;
  title_english: string;
  title_long: string;
  year: number;
  rating: number;
  runtime: number;
  genres: string[];
  summary: string;
  synopsis: string;
  medium_cover_image: string;
  large_cover_image: string;
  torrents: YtsTorrent[];
}

export interface YtsListResponse {
  status: string;
  status_message: string;
  data: {
    movie_count: number;
    limit: number;
    page_number: number;
    movies?: YtsMovie[];
  };
}

// EZTV API types

export interface EztvTorrent {
  id: number;
  hash: string;
  filename: string;
  episode_url: string;
  torrent_url: string;
  magnet_url: string;
  title: string;
  imdb_id: string;
  season: string;
  episode: string;
  small_screenshot: string;
  large_screenshot: string;
  seeds: number;
  peers: number;
  date_released_unix: number;
  size_bytes: number;
}

export interface EztvListResponse {
  torrents_count: number;
  limit: number;
  page: number;
  torrents?: EztvTorrent[];
}

// TMDb API types

export interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCastMember {
  name: string;
  character: string;
  order: number;
}

export interface TmdbCrewMember {
  name: string;
  job: string;
  department: string;
}

export interface TmdbMovieDetail {
  id: number;
  imdb_id: string;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  genres: TmdbGenre[];
  credits?: {
    cast: TmdbCastMember[];
    crew: TmdbCrewMember[];
  };
}

export interface TmdbFindResponse {
  movie_results: TmdbSearchResult[];
}

// Internal paginated result

export interface PaginatedMovies {
  data: MovieListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface MovieListItem {
  id: string;
  title: string;
  year: number | null;
  imdbRating: number | null;
  posterUrl: string | null;
  genres: string[];
  watched: boolean;
}

export interface SubtitleInfo {
  lang: string;
  label: string;
}

export interface MovieDetail {
  id: string;
  title: string;
  imdbId: string;
  year: number | null;
  imdbRating: number | null;
  runtime: number | null;
  summary: string | null;
  posterUrl: string | null;
  genres: string[];
  director: string | null;
  cast: string[];
  torrents: TorrentItem[];
  subtitles: SubtitleInfo[];
  commentsCount: number;
  watched: boolean;
}

export interface TorrentItem {
  id: string;
  quality: string;
  seeds: number;
  peers: number;
  sizeBytes: string; // BigInt serialized as string
  magnetUrl: string;
}
