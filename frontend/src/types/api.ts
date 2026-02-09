// ── Auth ──

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterRequest {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}

// ── Users ──

export interface UserPublic {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  language: string;
  email?: string;
}

// ── Movies ──

export interface MovieListItem {
  id: string;
  title: string;
  year: number | null;
  imdbRating: number | null;
  posterUrl: string | null;
  genres: string[];
  watched: boolean;
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
  genres: string[];
  producer: string | null;
  director: string | null;
  cast: string[];
  torrents: TorrentItem[];
  subtitles: SubtitleInfo[];
  commentsCount: number;
  watched: boolean;
}

// ── Comments ──

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

// ── Stream ──

export interface StreamStatus {
  status: string;
  progress: number;
  filePath?: string;
  fileSize?: number;
}

// ── Search params ──

export interface SearchMoviesParams {
  query?: string;
  genre?: string;
  sortBy?: "title" | "year" | "rating" | "seeds";
  order?: "asc" | "desc";
  minRating?: number;
  minYear?: number;
  maxYear?: number;
  page?: number;
  limit?: number;
}

// ── Errors ──

export interface ApiError {
  statusCode: number;
  message: string | string[];
  timestamp: string;
}
