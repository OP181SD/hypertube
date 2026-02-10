import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHeroMovies } from "../useHeroMovies";

vi.mock("@/api/movies.api", () => ({
  searchMovies: vi.fn(),
}));

import { searchMovies } from "@/api/movies.api";

const mockSearchMovies = vi.mocked(searchMovies);

describe("useHeroMovies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMovies.mockResolvedValue({
      data: [
        {
          id: "1",
          title: "Top Movie",
          year: 2023,
          imdbRating: 9.0,
          posterUrl: "url",
          backdropUrl: null,
          genres: [],
          watched: false,
        },
      ],
      page: 1,
      limit: 7,
      total: 1,
      totalPages: 1,
      hasMore: false,
    });
  });

  it("fetches top-rated movies", async () => {
    const { result } = renderHook(() => useHeroMovies());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.movies).toHaveLength(1);
    expect(mockSearchMovies).toHaveBeenCalledWith({
      sortBy: "rating",
      order: "desc",
      limit: 7,
      page: 1,
    });
  });

  it("handles error gracefully", async () => {
    mockSearchMovies.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useHeroMovies());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.movies).toEqual([]);
    expect(result.current.error).toBe("Network error");
  });
});
