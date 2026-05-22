import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VideoPlayer } from "../player/VideoPlayer";
import type { SubtitleInfo } from "@/types/api";

vi.mock("@/api/stream.api");
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));

// Plyr cannot run inside jsdom (relies on TextTrack, media APIs, layout).
// Stub it with a plain <video> so we can assert what VideoPlayer feeds it.
vi.mock("plyr-react", () => ({
  Plyr: ({
    source,
  }: {
    source?: {
      tracks?: Array<{
        kind: string;
        src: string;
        srclang: string;
        label: string;
      }>;
    };
  }) => (
    <div data-testid="video-player">
      <video>
        {(source?.tracks ?? []).map((tr, i) => (
          <track
            key={i}
            kind={tr.kind}
            src={tr.src}
            srcLang={tr.srclang}
            label={tr.label}
          />
        ))}
      </video>
    </div>
  ),
}));

const subtitles: SubtitleInfo[] = [
  { lang: "en", label: "English" },
  { lang: "fr", label: "French" },
];

describe("VideoPlayer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders video element when status is ready", async () => {
    const { getStreamStatus } = await import("@/api/stream.api");
    vi.mocked(getStreamStatus).mockResolvedValue({
      status: "ready",
      progress: 100,
    });

    render(
      <VideoPlayer
        torrentId="t-1"
        movieId="movie-1"
        subtitles={subtitles}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("video-player")).toBeInTheDocument();
    });
  });

  it("shows download progress while downloading", async () => {
    const { getStreamStatus } = await import("@/api/stream.api");
    vi.mocked(getStreamStatus).mockResolvedValue({
      status: "downloading",
      progress: 45,
    });

    render(
      <VideoPlayer
        torrentId="t-1"
        movieId="movie-1"
        subtitles={subtitles}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/45/)).toBeInTheDocument();
    });
  });

  it("renders subtitle tracks", async () => {
    const { getStreamStatus, getSubtitleUrl } = await import(
      "@/api/stream.api"
    );
    vi.mocked(getStreamStatus).mockResolvedValue({
      status: "ready",
      progress: 100,
    });
    vi.mocked(getSubtitleUrl).mockImplementation(
      (movieId, lang) => `http://localhost:3000/subtitles/${movieId}/${lang}`,
    );

    render(
      <VideoPlayer
        torrentId="t-1"
        movieId="movie-1"
        subtitles={subtitles}
      />,
    );

    await waitFor(() => {
      const tracks = screen.getByTestId("video-player").querySelectorAll("track");
      expect(tracks).toHaveLength(2);
      expect(tracks[0]).toHaveAttribute("srclang", "en");
      expect(tracks[1]).toHaveAttribute("srclang", "fr");
    });
  });
});
