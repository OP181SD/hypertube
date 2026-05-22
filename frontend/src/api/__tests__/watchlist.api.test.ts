import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "../watchlist.api";
import client from "../client";

vi.mock("../client", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

describe("watchlist.api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getWatchlist fetches and returns the /watchlist payload", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [{ id: "m1" }] });

    const result = await getWatchlist();

    expect(client.get).toHaveBeenCalledWith("/watchlist");
    expect(result).toEqual([{ id: "m1" }]);
  });

  it("addToWatchlist posts to /watchlist/:movieId", async () => {
    vi.mocked(client.post).mockResolvedValue({ data: {} });

    await addToWatchlist("m1");

    expect(client.post).toHaveBeenCalledWith("/watchlist/m1");
  });

  it("removeFromWatchlist deletes /watchlist/:movieId", async () => {
    vi.mocked(client.delete).mockResolvedValue({ data: {} });

    await removeFromWatchlist("m1");

    expect(client.delete).toHaveBeenCalledWith("/watchlist/m1");
  });
});
