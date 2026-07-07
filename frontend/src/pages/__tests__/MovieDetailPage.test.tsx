import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MovieDetailPage from "../MovieDetailPage";
import type { MovieDetail, Comment } from "@/types/api";

vi.mock("@/api/movies.api");
vi.mock("@/api/comments.api");
vi.mock("@/api/stream.api", () => ({
  getStreamUrl: (id: string) => `http://localhost:3000/stream/${id}`,
  getStreamStatus: vi.fn().mockResolvedValue({ status: "ready", progress: 100 }),
  getSubtitleUrl: (movieId: string, lang: string) => `http://localhost:3000/subtitles/${movieId}/${lang}`,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", username: "alice" },
    isAuthenticated: true,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));
// Plyr cannot run inside jsdom — stub it so the page can render in tests.
vi.mock("plyr-react", () => ({
  Plyr: () => <div data-testid="video-player" />,
}));

const mockMovie: MovieDetail = {
  id: "movie-1",
  title: "Test Movie",
  imdbId: "tt1234567",
  year: 2024,
  imdbRating: 8.5,
  runtime: 120,
  summary: "A great test movie.",
  posterUrl: "https://example.com/poster.jpg",
  backdropUrl: null,
  genres: ["Action", "Drama"],
  producer: null,
  director: "John Director",
  cast: ["Actor One", "Actor Two"],
  torrents: [
    {
      id: "t-720",
      quality: "720p",
      episodeLabel: null,
      season: null,
      episode: null,
      seeds: 50,
      peers: 10,
      sizeBytes: "800000000",
      magnetUrl: "magnet:?xt=urn:btih:abc",
    },
    {
      id: "t-1080",
      quality: "1080p",
      episodeLabel: null,
      season: null,
      episode: null,
      seeds: 120,
      peers: 30,
      sizeBytes: "1500000000",
      magnetUrl: "magnet:?xt=urn:btih:def",
    },
  ],
  subtitles: [
    { lang: "en", label: "English" },
    { lang: "fr", label: "French" },
  ],
  commentsCount: 2,
  watched: false,
  inWatchlist: false,
};

const mockComments: Comment[] = [
  {
    id: "c-1",
    content: "Great movie!",
    movieId: "movie-1",
    author: { id: "user-1", username: "alice" },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "c-2",
    content: "Not bad.",
    movieId: "movie-1",
    author: { id: "user-2", username: "bob" },
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/movies/movie-1"]}>
      <Routes>
        <Route path="/movies/:id" element={<MovieDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MovieDetailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders movie details after loading", async () => {
    const { getMovie } = await import("@/api/movies.api");
    const { getComments } = await import("@/api/comments.api");
    vi.mocked(getMovie).mockResolvedValue(mockMovie);
    vi.mocked(getComments).mockResolvedValue(mockComments);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });
    expect(screen.getByText("2024")).toBeInTheDocument();
    // Rating is rendered as "★ 8.5"
    expect(screen.getByText(/8\.5/)).toBeInTheDocument();
    expect(screen.getByText("A great test movie.")).toBeInTheDocument();
    expect(screen.getByText("John Director")).toBeInTheDocument();
  });

  it("renders quality selector with available torrents", async () => {
    const { getMovie } = await import("@/api/movies.api");
    const { getComments } = await import("@/api/comments.api");
    vi.mocked(getMovie).mockResolvedValue(mockMovie);
    vi.mocked(getComments).mockResolvedValue(mockComments);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("720p")).toBeInTheDocument();
    });
    expect(screen.getByText("1080p")).toBeInTheDocument();
  });

  it("renders comments section", async () => {
    const { getMovie } = await import("@/api/movies.api");
    const { getComments } = await import("@/api/comments.api");
    vi.mocked(getMovie).mockResolvedValue(mockMovie);
    vi.mocked(getComments).mockResolvedValue(mockComments);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Great movie!")).toBeInTheDocument();
    });
    expect(screen.getByText("Not bad.")).toBeInTheDocument();
  });

  it("shows a poster placeholder when no cover image is available", async () => {
    const { getMovie } = await import("@/api/movies.api");
    const { getComments } = await import("@/api/comments.api");
    vi.mocked(getMovie).mockResolvedValue({ ...mockMovie, posterUrl: null });
    vi.mocked(getComments).mockResolvedValue(mockComments);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });
    expect(screen.getByRole("img", { name: "Test Movie" })).toHaveTextContent(
      "no_poster",
    );
  });

  it("shows loading state initially", async () => {
    const { getMovie } = await import("@/api/movies.api");
    const { getComments } = await import("@/api/comments.api");
    vi.mocked(getMovie).mockReturnValue(new Promise(() => {}));
    vi.mocked(getComments).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId("movie-detail-loading")).toBeInTheDocument();
  });
});
