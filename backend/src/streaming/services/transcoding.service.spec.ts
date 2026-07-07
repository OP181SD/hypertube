import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PassThrough } from "node:stream";
import { TranscodingService } from "./transcoding.service";

const mockFfmpegInstance = {
  ffprobe: vi.fn(),
  inputFormat: vi.fn().mockReturnThis(),
  outputOptions: vi.fn().mockReturnThis(),
  format: vi.fn().mockReturnThis(),
  audioCodec: vi.fn().mockReturnThis(),
  videoCodec: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  pipe: vi.fn(),
};

vi.mock("fluent-ffmpeg", () => {
  const ffmpeg = vi.fn(() => mockFfmpegInstance);
  (ffmpeg as Record<string, unknown>).ffprobe = vi.fn();
  (ffmpeg as Record<string, unknown>).setFfmpegPath = vi.fn();
  return { default: ffmpeg };
});

const mockConfig = {
  get: vi.fn((key: string) => {
    if (key === "FFMPEG_PATH") return "";
    return "";
  }),
};

describe("TranscodingService", () => {
  let service: TranscodingService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscodingService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<TranscodingService>(TranscodingService);
  });

  describe("needsTranscoding", () => {
    it("should return false for .mp4 files", () => {
      expect(service.needsTranscoding("movie.mp4")).toBe(false);
    });

    it("should return false for .webm files", () => {
      expect(service.needsTranscoding("movie.webm")).toBe(false);
    });

    it("should return true for .mkv files", () => {
      expect(service.needsTranscoding("movie.mkv")).toBe(true);
    });

    it("should return true for .avi files", () => {
      expect(service.needsTranscoding("movie.avi")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(service.needsTranscoding("movie.MKV")).toBe(true);
      expect(service.needsTranscoding("movie.MP4")).toBe(false);
    });
  });

  describe("transcodeToMp4", () => {
    it("should return a readable stream", () => {
      const mockStream = new PassThrough();
      mockFfmpegInstance.pipe.mockReturnValue(mockStream);

      const result = service.transcodeToMp4(new PassThrough(), "/path/to/movie.mkv");

      expect(result).toBe(mockStream);
      expect(mockFfmpegInstance.outputOptions).toHaveBeenCalled();
      expect(mockFfmpegInstance.format).toHaveBeenCalledWith("mp4");
    });

    it("should use copy video codec for remuxing", () => {
      const mockStream = new PassThrough();
      mockFfmpegInstance.pipe.mockReturnValue(mockStream);

      service.transcodeToMp4(new PassThrough(), "/path/to/movie.mkv");

      expect(mockFfmpegInstance.videoCodec).toHaveBeenCalledWith("copy");
      expect(mockFfmpegInstance.audioCodec).toHaveBeenCalledWith("aac");
    });
  });

  describe("getVideoInfo", () => {
    it("should resolve with video info from ffprobe", async () => {
      const ffmpeg = await import("fluent-ffmpeg");
      const ffprobeStatic = (ffmpeg.default as unknown as Record<string, unknown>)
        .ffprobe as ReturnType<typeof vi.fn>;

      ffprobeStatic.mockImplementation(
        (_path: string, cb: (err: Error | null, data: unknown) => void) => {
          cb(null, {
            format: { format_name: "matroska,webm", duration: 7200 },
            streams: [
              { codec_type: "video", codec_name: "h264" },
              { codec_type: "audio", codec_name: "aac" },
            ],
          });
        },
      );

      const info = await service.getVideoInfo("/path/to/movie.mkv");

      expect(info).toEqual({
        format: "matroska,webm",
        duration: 7200,
        videoCodec: "h264",
        audioCodec: "aac",
      });
    });

    it("should reject on ffprobe error", async () => {
      const ffmpeg = await import("fluent-ffmpeg");
      const ffprobeStatic = (ffmpeg.default as unknown as Record<string, unknown>)
        .ffprobe as ReturnType<typeof vi.fn>;

      ffprobeStatic.mockImplementation(
        (_path: string, cb: (err: Error | null, data: unknown) => void) => {
          cb(new Error("ffprobe failed"), null);
        },
      );

      await expect(service.getVideoInfo("/path/to/movie.mkv")).rejects.toThrow(
        "ffprobe failed",
      );
    });
  });
});
