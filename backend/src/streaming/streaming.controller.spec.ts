import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { PassThrough } from "node:stream";
import { StreamingController } from "./streaming.controller";
import { StreamingService } from "./streaming.service";
import { PrismaService } from "../prisma/prisma.service";
import { mockDbUser } from "../../test/fixtures/users.fixture";

const mockStreamingService = {
  initiateStream: vi.fn(),
  getStreamStatus: vi.fn(),
  getVideoStream: vi.fn(),
  getSubtitles: vi.fn(),
  getSubtitleFile: vi.fn(),
};

const mockPrisma = {
  movie: {
    findUnique: vi.fn(),
  },
};

describe("StreamingController", () => {
  let controller: StreamingController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StreamingController],
      providers: [
        { provide: StreamingService, useValue: mockStreamingService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<StreamingController>(StreamingController);
  });

  describe("GET /stream/:torrentId", () => {
    it("should initiate stream and return status", async () => {
      mockStreamingService.initiateStream.mockResolvedValue({
        status: "downloading",
        progress: 0,
        filePath: null,
        fileSize: null,
      });

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      await controller.stream(
        "t1",
        mockDbUser as any,
        undefined,
        mockReply as any,
      );

      expect(mockStreamingService.initiateStream).toHaveBeenCalledWith(
        "t1",
        mockDbUser.id,
      );
    });

    it("should serve video with 206 for range requests", async () => {
      const mockStream = new PassThrough();
      mockStreamingService.initiateStream.mockResolvedValue({
        status: "ready",
        progress: 100,
        filePath: "/path/movie.mp4",
        fileSize: 10000,
      });
      mockStreamingService.getVideoStream.mockResolvedValue({
        stream: mockStream,
        mimeType: "video/mp4",
        fileSize: 1000,
        start: 0,
        end: 999,
        totalSize: 10000,
      });

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      await controller.stream(
        "t1",
        mockDbUser as any,
        "bytes=0-999",
        mockReply as any,
      );

      expect(mockReply.status).toHaveBeenCalledWith(206);
      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Range",
        "bytes 0-999/10000",
      );
      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Type",
        "video/mp4",
      );
    });

    it("should return download status JSON when not ready", async () => {
      mockStreamingService.initiateStream.mockResolvedValue({
        status: "downloading",
        progress: 50,
        filePath: null,
        fileSize: null,
      });

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      await controller.stream(
        "t1",
        mockDbUser as any,
        undefined,
        mockReply as any,
      );

      expect(mockReply.status).toHaveBeenCalledWith(202);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: "downloading",
        progress: 50,
        filePath: null,
        fileSize: null,
      });
    });
  });

  describe("GET /stream/:torrentId/status", () => {
    it("should return stream status", async () => {
      mockStreamingService.getStreamStatus.mockResolvedValue({
        status: "downloading",
        progress: 75,
        filePath: null,
        fileSize: 1000,
      });

      const result = await controller.getStatus("t1");

      expect(result.progress).toBe(75);
    });

    it("should propagate NotFoundException", async () => {
      mockStreamingService.getStreamStatus.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.getStatus("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("GET /subtitles/:movieId", () => {
    it("should return available subtitles", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue({
        id: "m1",
        imdbId: "tt0133093",
      });
      mockStreamingService.getSubtitles.mockResolvedValue([
        { lang: "en", label: "English", fileId: "100" },
      ]);

      const result = await controller.getSubtitles("m1");

      expect(result).toHaveLength(1);
      expect(result[0].lang).toBe("en");
    });

    it("should throw NotFoundException for unknown movie", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue(null);

      await expect(controller.getSubtitles("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("GET /subtitles/:movieId/:lang", () => {
    it("should return VTT content", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue({
        id: "m1",
        imdbId: "tt0133093",
      });
      mockStreamingService.getSubtitles.mockResolvedValue([
        { lang: "en", label: "English", fileId: "100" },
      ]);
      mockStreamingService.getSubtitleFile.mockResolvedValue(
        "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello",
      );

      const mockReply = {
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      await controller.getSubtitleFile("m1", "en", mockReply as any);

      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Type",
        "text/vtt; charset=utf-8",
      );
    });

    it("should throw NotFoundException when subtitle not available", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue({
        id: "m1",
        imdbId: "tt0133093",
      });
      mockStreamingService.getSubtitles.mockResolvedValue([]);

      const mockReply = {
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      await expect(
        controller.getSubtitleFile("m1", "en", mockReply as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
