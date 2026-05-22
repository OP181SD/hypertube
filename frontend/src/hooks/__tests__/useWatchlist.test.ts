import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWatchlist } from "../useWatchlist";

vi.mock("@/api/watchlist.api", () => ({
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
}));

import { addToWatchlist, removeFromWatchlist } from "@/api/watchlist.api";

describe("useWatchlist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts with the given initial state", () => {
    const { result } = renderHook(() => useWatchlist("m1", true));
    expect(result.current.inWatchlist).toBe(true);
  });

  it("adds the movie to the watchlist when toggled on", async () => {
    vi.mocked(addToWatchlist).mockResolvedValue(undefined);
    const { result } = renderHook(() => useWatchlist("m1", false));

    await act(async () => {
      await result.current.toggleWatchlist();
    });

    expect(addToWatchlist).toHaveBeenCalledWith("m1");
    expect(result.current.inWatchlist).toBe(true);
  });

  it("removes the movie from the watchlist when toggled off", async () => {
    vi.mocked(removeFromWatchlist).mockResolvedValue(undefined);
    const { result } = renderHook(() => useWatchlist("m1", true));

    await act(async () => {
      await result.current.toggleWatchlist();
    });

    expect(removeFromWatchlist).toHaveBeenCalledWith("m1");
    expect(result.current.inWatchlist).toBe(false);
  });

  it("keeps the current state when the API call fails", async () => {
    vi.mocked(addToWatchlist).mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useWatchlist("m1", false));

    await act(async () => {
      await result.current.toggleWatchlist();
    });

    expect(result.current.inWatchlist).toBe(false);
  });
});
