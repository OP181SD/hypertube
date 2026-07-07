import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SubtitleService } from "./subtitle.service";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn(),
}));

const mockConfig = {
  get: vi.fn((key: string) => {
    if (key === "OPENSUBTITLES_API_KEY") return "test-api-key";
    if (key === "OPENSUBTITLES_BASE_URL")
      return "https://api.opensubtitles.com/api/v1";
    if (key === "STORAGE_PATH") return "/tmp/test-videos";
    return "";
  }),
};

describe("SubtitleService", () => {
  let service: SubtitleService;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockConfig.get.mockImplementation((key: string) => {
      if (key === "OPENSUBTITLES_API_KEY") return "test-api-key";
      if (key === "OPENSUBTITLES_BASE_URL")
        return "https://api.opensubtitles.com/api/v1";
      if (key === "STORAGE_PATH") return "/tmp/test-videos";
      return "";
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubtitleService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<SubtitleService>(SubtitleService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAvailableSubtitles", () => {
    it("should return subtitle entries from OpenSubtitles API", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          total_count: 2,
          data: [
            {
              id: "sub-1",
              attributes: {
                language: "en",
                files: [{ file_id: 100, file_name: "movie.en.srt" }],
              },
            },
            {
              id: "sub-2",
              attributes: {
                language: "fr",
                files: [{ file_id: 200, file_name: "movie.fr.srt" }],
              },
            },
          ],
        }),
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse as unknown as Response,
      );

      const result = await service.getAvailableSubtitles("tt0133093");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        lang: "en",
        label: "English",
        fileId: "100",
      });
      expect(result[1]).toEqual({
        lang: "fr",
        label: "Français",
        fileId: "200",
      });
    });

    it("should return empty array on API error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      const result = await service.getAvailableSubtitles("tt0133093");
      expect(result).toEqual([]);
    });

    it("should return empty array when API key is missing", async () => {

      mockConfig.get.mockImplementation((key: string) =>
        key === "OPENSUBTITLES_API_KEY" ? "" : "/tmp/test-videos",
      );
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SubtitleService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile();
      const serviceWithoutKey = module.get<SubtitleService>(SubtitleService);

      const result = await serviceWithoutKey.getAvailableSubtitles("tt0133093");
      expect(result).toEqual([]);
    });

    it("should return empty array on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await service.getAvailableSubtitles("tt0133093");
      expect(result).toEqual([]);
    });
  });

  describe("downloadSubtitle", () => {
    it("should download SRT and convert to VTT", async () => {

      const downloadResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          link: "https://dl.opensubtitles.com/file/123",
          file_name: "movie.srt",
        }),
      };

      const srtContent =
        "1\n00:00:01,000 --> 00:00:04,000\nHello, world!\n\n2\n00:00:05,000 --> 00:00:08,000\nGoodbye!\n";

      const srtResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(srtContent),
      };

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(downloadResponse as unknown as Response)
        .mockResolvedValueOnce(srtResponse as unknown as Response);

      const result = await service.downloadSubtitle("100", "movie-1", "en");

      expect(result).toContain("WEBVTT");
      expect(result).toContain("Hello, world!");
    });

    it("should return null on download error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Download failed"),
      );

      const result = await service.downloadSubtitle("100", "movie-1", "en");
      expect(result).toBeNull();
    });
  });

  describe("srtToVtt", () => {
    it("should convert SRT to WebVTT format", () => {
      const srt =
        "1\r\n00:00:01,000 --> 00:00:04,000\r\nHello, world!\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nGoodbye!\r\n";

      const vtt = service.srtToVtt(srt);

      expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
      expect(vtt).toContain("00:00:01.000 --> 00:00:04.000");
      expect(vtt).toContain("Hello, world!");
      expect(vtt).not.toContain(",000");
    });
  });
});
