import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHeroMovies } from "../useHeroMovies";

vi.mock("@/api/movies.api", () => ({
  fetchPopularMovies: vi.fn(),
}));

import { fetchPopularMovies } from "@/api/movies.api";

const mockFetchPopularMovies = vi.mocked(fetchPopularMovies);

describe("useHeroMovies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPopularMovies.mockResolvedValue([
      {
        id: "1",
        tmdbId: 100,
        title: "Top Movie",
        year: 2023,
        rating: 9.0,
        genres: [],
        posterUrl: "url",
        backdropUrl: "backdrop",
        overview: "An overview",
      },
    ]);
  });

  it("fetches popular movies", async () => {
    const { result } = renderHook(() => useHeroMovies());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.movies).toHaveLength(1);
    expect(mockFetchPopularMovies).toHaveBeenCalled();
  });

  it("handles error gracefully", async () => {
    mockFetchPopularMovies.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useHeroMovies());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.movies).toEqual([]);
    expect(result.current.error).toBe("Network error");
  });
});
