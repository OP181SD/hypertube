import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EztvService } from "./eztv.service";
import {
  eztvListResponse,
  eztvEmptyResponse,
} from "../../../test/fixtures/movies.fixture";

describe("EztvService", () => {
  let service: EztvService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EztvService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === "EZTV_BASE_URL") return "https://eztv.re/api";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EztvService>(EztvService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("searchTorrents", () => {
    it("should search torrents with query", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => eztvListResponse,
      });

      const result = await service.searchTorrents({ query: "breaking bad" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("get-torrents"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(result.torrents).toHaveLength(1);
      expect(result.torrentsCount).toBe(1);
      expect(result.torrents[0].imdb_id).toBe("0903747");
    });

    it("should search by imdbId", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => eztvListResponse,
      });

      await service.searchTorrents({ imdbId: "0903747" });

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("imdb_id=0903747");
    });

    it("should pass page and limit params", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => eztvListResponse,
      });

      await service.searchTorrents({ page: 2, limit: 50 });

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain("page=2");
      expect(url).toContain("limit=50");
    });

    it("should return empty on no results", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => eztvEmptyResponse,
      });

      const result = await service.searchTorrents({ query: "nonexistent" });

      expect(result.torrents).toEqual([]);
      expect(result.torrentsCount).toBe(0);
    });

    it("should return empty on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });

      const result = await service.searchTorrents({ query: "test" });

      expect(result.torrents).toEqual([]);
      expect(result.torrentsCount).toBe(0);
    });

    it("should return empty on network failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));

      const result = await service.searchTorrents({ query: "test" });

      expect(result.torrents).toEqual([]);
      expect(result.torrentsCount).toBe(0);
    });
  });

  describe("getAllTorrentsByImdb", () => {
    const makePage = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        ...eztvListResponse.torrents![0],
        hash: `hash-${i}-${Math.random()}`,
      }));

    it("should page until a short page and concatenate results", async () => {
      // page 1 full (100), page 2 short (5) → stops after page 2
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ torrents: makePage(100), torrents_count: 105 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ torrents: makePage(5), torrents_count: 105 }) });

      const all = await service.getAllTorrentsByImdb("0903747");

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(all).toHaveLength(105);
    });

    it("should stop after the first page when it is already short", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ torrents: makePage(12), torrents_count: 12 }),
      });

      const all = await service.getAllTorrentsByImdb("0903747");

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(all).toHaveLength(12);
    });
  });
});
