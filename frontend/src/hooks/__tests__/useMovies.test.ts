import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMovies } from "../useMovies";

vi.mock("@/api/movies.api", () => ({
  searchMovies: vi.fn(),
}));

import { searchMovies } from "@/api/movies.api";

const mockSearchMovies = vi.mocked(searchMovies);

const RESPONSE = {
  data: [
    {
      id: "1",
      title: "Batman",
      year: 2022,
      imdbRating: 8.0,
      posterUrl: "url",
      backdropUrl: null,
      genres: ["Action"],
      watched: false,
      inWatchlist: false,
    },
  ],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  hasMore: false,
};

describe("useMovies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMovies.mockResolvedValue(RESPONSE);
  });

  it("fetches movies on mount", async () => {
    const { result } = renderHook(() => useMovies());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.movies).toEqual(RESPONSE.data);
    expect(mockSearchMovies).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it("passes genre filter", async () => {
    const { result } = renderHook(() => useMovies({ genre: "Action" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSearchMovies).toHaveBeenCalledWith(
      expect.objectContaining({ genre: "Action" }),
    );
  });

  it("passes query filter", async () => {
    const { result } = renderHook(() => useMovies({ query: "batman" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSearchMovies).toHaveBeenCalledWith(
      expect.objectContaining({ query: "batman" }),
    );
  });

  it("passes sortBy filter", async () => {
    const { result } = renderHook(() => useMovies({ sortBy: "rating" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSearchMovies).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: "rating" }),
    );
  });
});
