import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CleanupService } from "./cleanup.service";
import { PrismaService } from "../../prisma/prisma.service";

vi.mock("node:fs/promises", () => ({
  rm: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = {
  torrent: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
};

describe("CleanupService", () => {
  let service: CleanupService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
  });

  describe("handleCleanup", () => {
    it("should find and delete stale torrents", async () => {
      const staleTorrents = [
        {
          id: "t1",
          filePath: "/data/videos/movie1.mp4",
          downloadStatus: "ready",
          lastAccessedAt: new Date("2025-01-01"),
        },
        {
          id: "t2",
          filePath: "/data/videos/movie2.mkv",
          downloadStatus: "ready",
          lastAccessedAt: new Date("2025-01-01"),
        },
      ];

      mockPrisma.torrent.findMany.mockResolvedValue(staleTorrents);
      mockPrisma.torrent.updateMany.mockResolvedValue({ count: 2 });

      await service.handleCleanup();

      expect(mockPrisma.torrent.findMany).toHaveBeenCalledWith({
        where: {
          downloadStatus: "ready",
          lastAccessedAt: {
            lt: expect.any(Date),
          },
        },
      });

      const fs = await import("node:fs/promises");
      expect(fs.rm).toHaveBeenCalledTimes(2);

      expect(mockPrisma.torrent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["t1", "t2"] } },
        data: {
          downloadStatus: "idle",
          filePath: null,
          lastAccessedAt: null,
        },
      });
    });

    it("should skip torrents without file path", async () => {
      const staleTorrents = [
        {
          id: "t1",
          filePath: null,
          downloadStatus: "ready",
          lastAccessedAt: new Date("2025-01-01"),
        },
      ];

      mockPrisma.torrent.findMany.mockResolvedValue(staleTorrents);
      mockPrisma.torrent.updateMany.mockResolvedValue({ count: 1 });

      await service.handleCleanup();

      const fs = await import("node:fs/promises");
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it("should handle no stale torrents", async () => {
      mockPrisma.torrent.findMany.mockResolvedValue([]);

      await service.handleCleanup();

      expect(mockPrisma.torrent.updateMany).not.toHaveBeenCalled();
    });

    it("should continue cleanup even if file deletion fails", async () => {
      const staleTorrents = [
        {
          id: "t1",
          filePath: "/data/videos/movie1.mp4",
          downloadStatus: "ready",
          lastAccessedAt: new Date("2025-01-01"),
        },
      ];

      mockPrisma.torrent.findMany.mockResolvedValue(staleTorrents);
      mockPrisma.torrent.updateMany.mockResolvedValue({ count: 1 });

      const fs = await import("node:fs/promises");
      (fs.rm as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("File not found"),
      );

      // Should not throw
      await service.handleCleanup();

      expect(mockPrisma.torrent.updateMany).toHaveBeenCalled();
    });
  });
});
