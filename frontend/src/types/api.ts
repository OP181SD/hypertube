

export interface RegisterRequest {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}

export interface UserPublic {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  language: string;
  email?: string;
}

export interface MovieListItem {
  id: string;
  title: string;
  year: number | null;
  imdbRating: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  watched: boolean;
  inWatchlist: boolean;
}

export interface PaginatedMovies {
  data: MovieListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface TorrentItem {
  id: string;
  quality: string;
  episodeLabel: string | null;
  season: number | null;
  episode: number | null;
  seeds: number;
  peers: number;
  sizeBytes: string;
  magnetUrl: string;
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
  backdropUrl: string | null;
  genres: string[];
  producer: string | null;
  director: string | null;
  cast: string[];
  torrents: TorrentItem[];
  subtitles: SubtitleInfo[];
  commentsCount: number;
  watched: boolean;
  inWatchlist: boolean;
}

export interface CommentAuthor {
  id: string;
  username: string;
}

export interface Comment {
  id: string;
  content: string;
  movieId: string;
  author: CommentAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface StreamStatus {
  status: string;
  progress: number;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface HeroMovie {
  id: string;
  tmdbId: number;
  title: string;
  year: number | null;
  rating: number;
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string;
  overview: string;
}

export interface SearchMoviesParams {
  query?: string;
  genre?: string;
  mediaType?: "movie" | "series";
  sortBy?: "title" | "year" | "rating" | "seeds";
  order?: "asc" | "desc";
  minRating?: number;
  minYear?: number;
  maxYear?: number;
  page?: number;
  limit?: number;
}
