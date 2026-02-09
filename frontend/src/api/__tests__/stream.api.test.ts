import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../client";
import { getStreamUrl, getStreamStatus, getSubtitleUrl } from "../stream.api";
import type { StreamStatus } from "@/types/api";

vi.mock("../client", () => ({
  default: {
    get: vi.fn(),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

const mockGet = vi.mocked(client.get);

describe("stream.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStreamUrl", () => {
    it("should return the correct stream URL", () => {
      const url = getStreamUrl("torrent-1");
      expect(url).toBe("http://localhost:3000/stream/torrent-1");
    });
  });

  describe("getStreamStatus", () => {
    it("should GET /stream/:torrentId/status", async () => {
      const status: StreamStatus = {
        status: "downloading",
        progress: 45,
      };
      mockGet.mockResolvedValueOnce({ data: status });

      const result = await getStreamStatus("torrent-1");

      expect(mockGet).toHaveBeenCalledWith("/stream/torrent-1/status");
      expect(result).toEqual(status);
    });
  });

  describe("getSubtitleUrl", () => {
    it("should return the correct subtitle URL", () => {
      const url = getSubtitleUrl("movie-1", "en");
      expect(url).toBe("http://localhost:3000/subtitles/movie-1/en");
    });
  });
});
