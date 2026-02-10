import type {
  YtsMovie,
  YtsListResponse,
  EztvTorrent,
  EztvListResponse,
  TmdbMovieDetail,
  TmdbSearchResponse,
  TmdbFindResponse,
  TmdbPopularResponse,
} from "../../src/movies/interfaces";

export const ytsMovie: YtsMovie = {
  id: 1,
  url: "https://yts.mx/movies/the-matrix-1999",
  imdb_code: "tt0133093",
  title: "The Matrix",
  title_english: "The Matrix",
  title_long: "The Matrix (1999)",
  year: 1999,
  rating: 8.7,
  runtime: 136,
  genres: ["Action", "Sci-Fi"],
  summary: "A computer hacker learns about the true nature of reality.",
  synopsis: "A computer hacker learns about the true nature of reality.",
  medium_cover_image: "https://yts.mx/assets/images/movies/the_matrix_1999/medium-cover.jpg",
  large_cover_image: "https://yts.mx/assets/images/movies/the_matrix_1999/large-cover.jpg",
  background_image: "https://yts.mx/assets/images/movies/the_matrix_1999/background.jpg",
  background_image_original: "https://yts.mx/assets/images/movies/the_matrix_1999/background.jpg",
  torrents: [
    {
      url: "https://yts.mx/torrent/download/abc123",
      hash: "ABC123DEF456GHI789JKL012MNO345PQ",
      quality: "1080p",
      type: "bluray",
      seeds: 150,
      peers: 25,
      size: "2.5 GB",
      size_bytes: 2684354560,
    },
    {
      url: "https://yts.mx/torrent/download/xyz789",
      hash: "XYZ789UVW456RST123OPQ012LMN345AB",
      quality: "720p",
      type: "bluray",
      seeds: 80,
      peers: 10,
      size: "1.2 GB",
      size_bytes: 1288490188,
    },
  ],
};

export const ytsMovie2: YtsMovie = {
  id: 2,
  url: "https://yts.mx/movies/inception-2010",
  imdb_code: "tt1375666",
  title: "Inception",
  title_english: "Inception",
  title_long: "Inception (2010)",
  year: 2010,
  rating: 8.8,
  runtime: 148,
  genres: ["Action", "Adventure", "Sci-Fi"],
  summary: "A thief who steals corporate secrets through dream-sharing technology.",
  synopsis: "A thief who steals corporate secrets through dream-sharing technology.",
  medium_cover_image: "https://yts.mx/assets/images/movies/inception_2010/medium-cover.jpg",
  large_cover_image: "https://yts.mx/assets/images/movies/inception_2010/large-cover.jpg",
  background_image: "https://yts.mx/assets/images/movies/inception_2010/background.jpg",
  background_image_original: "https://yts.mx/assets/images/movies/inception_2010/background.jpg",
  torrents: [
    {
      url: "https://yts.mx/torrent/download/inc1080",
      hash: "INC1080HASHVALUE1234567890ABCDEFG",
      quality: "1080p",
      type: "bluray",
      seeds: 200,
      peers: 30,
      size: "2.8 GB",
      size_bytes: 3006477107,
    },
  ],
};

export const ytsListResponse: YtsListResponse = {
  status: "ok",
  status_message: "Query was successful",
  data: {
    movie_count: 2,
    limit: 20,
    page_number: 1,
    movies: [ytsMovie, ytsMovie2],
  },
};

export const ytsEmptyResponse: YtsListResponse = {
  status: "ok",
  status_message: "Query was successful",
  data: {
    movie_count: 0,
    limit: 20,
    page_number: 1,
  },
};

export const eztvTorrent: EztvTorrent = {
  id: 100,
  hash: "EZTV100HASHVALUE1234567890ABCDEFG",
  filename: "Breaking.Bad.S01E01.1080p.BluRay.x264.mkv",
  episode_url: "https://eztv.re/ep/100",
  torrent_url: "https://zoink.ch/torrent/Breaking.Bad.S01E01.torrent",
  magnet_url: "magnet:?xt=urn:btih:EZTV100HASHVALUE1234567890ABCDEFG",
  title: "Breaking Bad S01E01 1080p BluRay x264",
  imdb_id: "0903747",
  season: "1",
  episode: "1",
  small_screenshot: "https://eztv.re/screenshots/100-small.jpg",
  large_screenshot: "https://eztv.re/screenshots/100-large.jpg",
  seeds: 45,
  peers: 12,
  date_released_unix: 1640000000,
  size_bytes: 1500000000,
};

export const eztvListResponse: EztvListResponse = {
  torrents_count: 1,
  limit: 30,
  page: 1,
  torrents: [eztvTorrent],
};

export const eztvEmptyResponse: EztvListResponse = {
  torrents_count: 0,
  limit: 30,
  page: 1,
  torrents: [],
};

export const tmdbMovieDetail: TmdbMovieDetail = {
  id: 603,
  imdb_id: "tt0133093",
  title: "The Matrix",
  overview: "Set in the 22nd century, The Matrix tells the story of a computer hacker.",
  poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  backdrop_path: "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
  release_date: "1999-03-30",
  runtime: 136,
  vote_average: 8.2,
  genres: [
    { id: 28, name: "Action" },
    { id: 878, name: "Science Fiction" },
  ],
  credits: {
    cast: [
      { name: "Keanu Reeves", character: "Thomas A. Anderson / Neo", order: 0 },
      { name: "Laurence Fishburne", character: "Morpheus", order: 1 },
      { name: "Carrie-Anne Moss", character: "Trinity", order: 2 },
    ],
    crew: [
      { name: "Lana Wachowski", job: "Director", department: "Directing" },
      { name: "Lilly Wachowski", job: "Director", department: "Directing" },
      { name: "Joel Silver", job: "Producer", department: "Production" },
    ],
  },
};

export const tmdbSearchResponse: TmdbSearchResponse = {
  page: 1,
  results: [
    {
      id: 603,
      title: "The Matrix",
      original_title: "The Matrix",
      overview: "Set in the 22nd century, The Matrix tells the story of a computer hacker.",
      poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      backdrop_path: "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
      release_date: "1999-03-30",
      vote_average: 8.2,
      vote_count: 23104,
      genre_ids: [28, 878],
      popularity: 79.309,
    },
  ],
  total_pages: 1,
  total_results: 1,
};

export const tmdbFindResponse: TmdbFindResponse = {
  movie_results: [
    {
      id: 603,
      title: "The Matrix",
      original_title: "The Matrix",
      overview: "Set in the 22nd century, The Matrix tells the story of a computer hacker.",
      poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      backdrop_path: "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
      release_date: "1999-03-30",
      vote_average: 8.2,
      vote_count: 23104,
      genre_ids: [28, 878],
      popularity: 79.309,
    },
  ],
};

export const tmdbPopularResponse: TmdbPopularResponse = {
  page: 1,
  results: [
    {
      id: 603,
      title: "The Matrix",
      original_title: "The Matrix",
      overview: "Set in the 22nd century, The Matrix tells the story of a computer hacker.",
      poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      backdrop_path: "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
      release_date: "1999-03-30",
      vote_average: 8.2,
      vote_count: 23104,
      genre_ids: [28, 878],
      popularity: 79.309,
    },
    {
      id: 27205,
      title: "Inception",
      original_title: "Inception",
      overview: "A thief who steals corporate secrets through dream-sharing technology.",
      poster_path: "/9gk7adHYeDvHkCSEhniVolaAcKp.jpg",
      backdrop_path: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
      release_date: "2010-07-15",
      vote_average: 8.4,
      vote_count: 35000,
      genre_ids: [28, 12, 878],
      popularity: 100.5,
    },
    {
      id: 999,
      title: "No Backdrop Movie",
      original_title: "No Backdrop Movie",
      overview: "A movie without a backdrop image.",
      poster_path: "/poster.jpg",
      backdrop_path: null,
      release_date: "2020-01-01",
      vote_average: 5.0,
      vote_count: 100,
      genre_ids: [18],
      popularity: 10.0,
    },
  ],
  total_pages: 500,
  total_results: 10000,
};

export const mockDbMovie = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  imdbId: "tt0133093",
  title: "The Matrix",
  year: 1999,
  imdbRating: 8.7,
  runtime: 136,
  posterUrl: "https://yts.mx/assets/images/movies/the_matrix_1999/medium-cover.jpg",
  backdropUrl: "https://yts.mx/assets/images/movies/the_matrix_1999/background.jpg",
  summary: "A computer hacker learns about the true nature of reality.",
  tmdbId: 603,
  genres: ["Action", "Sci-Fi"],
  director: "Lana Wachowski",
  producer: "Joel Silver",
  cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockDbMovie2 = {
  id: "550e8400-e29b-41d4-a716-446655440011",
  imdbId: "tt1375666",
  title: "Inception",
  year: 2010,
  imdbRating: 8.8,
  runtime: 148,
  posterUrl: "https://yts.mx/assets/images/movies/inception_2010/medium-cover.jpg",
  backdropUrl: "https://yts.mx/assets/images/movies/inception_2010/background.jpg",
  summary: "A thief who steals corporate secrets through dream-sharing technology.",
  tmdbId: null,
  genres: ["Action", "Adventure", "Sci-Fi"],
  director: null,
  producer: null,
  cast: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockDbTorrent = {
  id: "550e8400-e29b-41d4-a716-446655440020",
  movieId: mockDbMovie.id,
  hash: "ABC123DEF456GHI789JKL012MNO345PQ",
  quality: "1080p",
  source: "YTS",
  seeds: 150,
  peers: 25,
  sizeBytes: BigInt(2684354560),
  magnetUrl:
    "magnet:?xt=urn:btih:ABC123DEF456GHI789JKL012MNO345PQ&dn=The+Matrix&tr=udp://tracker.example.com:80",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};
