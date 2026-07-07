import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CleanupService } from "./cleanup.service";
import { PrismaService } from "../../prisma/prisma.service";
vi.mock("node:fs/promises", () => ({
    rm: vi.fn().mockResolvedValue(undefined),
}));
const mockPrisma = {
    torrent: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
    },
};
const mockConfig = {
    get: vi.fn((key: string) => (key === "STORAGE_PATH" ? "./data/videos" : "")),
};
describe("CleanupService", () => {
    let service: CleanupService;
    beforeEach(async () => {
        vi.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CleanupService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ConfigService, useValue: mockConfig },
            ],
        }).compile();
        service = module.get<CleanupService>(CleanupService);
    });
    describe("handleCleanup", () => {
        it("should delete torrent directories by info hash", async () => {
            const staleTorrents = [
                {
                    id: "t1",
                    hash: "abc123",
                    filePath: "/data/videos/abc123/movie1.mp4",
                    downloadStatus: "ready",
                    lastAccessedAt: new Date("2025-01-01"),
                },
            ];
            mockPrisma.torrent.findMany.mockResolvedValue(staleTorrents);
            mockPrisma.torrent.updateMany.mockResolvedValue({ count: 1 });
            await service.handleCleanup();
            const fs = await import("node:fs/promises");
            expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining("abc123"), { recursive: true, force: true });
            expect(mockPrisma.torrent.updateMany).toHaveBeenCalled();
        });
        it("should handle no stale torrents", async () => {
            mockPrisma.torrent.findMany.mockResolvedValue([]);
            await service.handleCleanup();
            expect(mockPrisma.torrent.updateMany).not.toHaveBeenCalled();
        });
        it("should continue cleanup even if file deletion fails", async () => {
            mockPrisma.torrent.findMany.mockResolvedValue([
                {
                    id: "t1",
                    hash: "deadbeef",
                    filePath: "/data/videos/deadbeef/movie.mp4",
                    downloadStatus: "ready",
                    lastAccessedAt: new Date("2025-01-01"),
                },
            ]);
            mockPrisma.torrent.updateMany.mockResolvedValue({ count: 1 });
            const fs = await import("node:fs/promises");
            (fs.rm as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ENOENT"));
            await expect(service.handleCleanup()).resolves.not.toThrow();
            expect(mockPrisma.torrent.updateMany).toHaveBeenCalled();
        });
    });
});
