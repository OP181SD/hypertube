import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { EventEmitter } from "node:events";
import { TorrentService } from "./torrent.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { TorrentFileHandle } from "../torrent/torrent-download";
const mockFileHandle: TorrentFileHandle = {
    name: "Movie.mp4",
    path: "/tmp/test-videos/abc123/Movie.mp4",
    length: 1000000000,
    createReadStream: vi.fn(),
};
let lastDownload: EventEmitter & {
    start: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    getFile: ReturnType<typeof vi.fn>;
};
let downloadConstructCount = 0;
let lastDownloadSource: unknown;
vi.mock("../torrent/torrent-download", () => ({
    TorrentDownload: class MockTorrentDownload extends EventEmitter {
        start = vi.fn(async () => {
            this.emit("ready");
        });
        destroy = vi.fn();
        getFile = vi.fn(() => mockFileHandle);
        constructor(source: unknown) {
            super();
            downloadConstructCount++;
            lastDownloadSource = source;
            lastDownload = this;
        }
    },
}));
const mockPrisma = {
    torrent: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
    },
};
const mockConfig = {
    get: vi.fn((key: string) => {
        if (key === "STORAGE_PATH")
            return "/tmp/test-videos";
        return "";
    }),
};
describe("TorrentService", () => {
    let service: TorrentService;
    beforeEach(async () => {
        vi.clearAllMocks();
        downloadConstructCount = 0;
        lastDownloadSource = undefined;
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TorrentService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ConfigService, useValue: mockConfig },
            ],
        }).compile();
        service = module.get<TorrentService>(TorrentService);
    });
    afterEach(() => {
        service.onModuleDestroy();
    });
    describe("ensurePlayback", () => {
        it("should serve a ready torrent from disk without starting download", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                downloadStatus: "ready",
                filePath: "/tmp/test-videos/Movie.mp4",
                magnetUrl: "magnet:?xt=urn:btih:abc123",
                torrentFileUrl: null,
            });
            vi.spyOn(fs, "stat").mockResolvedValue({
                isFile: () => true,
                size: 5000000,
            } as Awaited<ReturnType<typeof fs.stat>>);
            await service.ensurePlayback("t1");
            expect(downloadConstructCount).toBe(0);
            const progress = service.getProgress("t1");
            expect(progress).toEqual({
                status: "ready",
                progress: 100,
                filePath: "/tmp/test-videos/Movie.mp4",
                fileSize: 5000000,
            });
        });
        it("should re-download when the ready file is missing on disk", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                downloadStatus: "ready",
                filePath: "/tmp/test-videos/missing.mp4",
                magnetUrl: "magnet:?xt=urn:btih:abc123",
                torrentFileUrl: "https://yts.lt/torrent/download/abc",
            });
            vi.spyOn(fs, "stat").mockRejectedValue(new Error("ENOENT"));
            mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });
            await service.ensurePlayback("t1");
            await new Promise((r) => setTimeout(r, 20));
            expect(downloadConstructCount).toBe(1);
        });
        it("should prefer torrent file URL over magnet when available", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                downloadStatus: "idle",
                magnetUrl: "magnet:?xt=urn:btih:abc123",
                torrentFileUrl: "https://yts.lt/torrent/download/abc",
            });
            mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });
            await service.ensurePlayback("t1");
            await new Promise((r) => setTimeout(r, 20));
            expect(lastDownloadSource).toEqual({
                kind: "file",
                url: "https://yts.lt/torrent/download/abc",
            });
        });
        it("should not start duplicate playback for the same ready torrent", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                downloadStatus: "ready",
                filePath: "/tmp/test-videos/Movie.mp4",
                magnetUrl: "magnet:?xt=urn:btih:abc123",
            });
            vi.spyOn(fs, "stat").mockResolvedValue({
                isFile: () => true,
                size: 5000000,
            } as Awaited<ReturnType<typeof fs.stat>>);
            await service.ensurePlayback("t1");
            await service.ensurePlayback("t1");
            expect(mockPrisma.torrent.findUnique).toHaveBeenCalledTimes(1);
        });
    });
    describe("startDownload", () => {
        it("should start a torrent download and update DB status", async () => {
            mockPrisma.torrent.update.mockResolvedValue({ id: "t1", downloadStatus: "downloading" });
            await service.startDownload("t1", { kind: "magnet", uri: "magnet:?xt=urn:btih:abc123" });
            await new Promise((r) => setTimeout(r, 20));
            expect(mockPrisma.torrent.update).toHaveBeenCalledWith({
                where: { id: "t1" },
                data: expect.objectContaining({ downloadStatus: "downloading" }),
            });
        });
        it("should not start duplicate download for same torrentId", async () => {
            mockPrisma.torrent.update.mockResolvedValue({ id: "t1", downloadStatus: "downloading" });
            await service.startDownload("t1", { kind: "magnet", uri: "magnet:?xt=urn:btih:abc123" });
            await service.startDownload("t1", { kind: "magnet", uri: "magnet:?xt=urn:btih:abc123" });
            expect(downloadConstructCount).toBe(1);
        });
    });
    describe("getProgress", () => {
        it("should return idle status when no download exists", () => {
            expect(service.getProgress("nonexistent")).toEqual({
                status: "idle",
                progress: 0,
                filePath: null,
                fileSize: null,
            });
        });
        it("should return ready status once the video file is available", async () => {
            mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });
            await service.startDownload("t1", { kind: "magnet", uri: "magnet:?xt=urn:btih:abc123" });
            await new Promise((r) => setTimeout(r, 20));
            const progress = service.getProgress("t1");
            expect(progress.status).toBe("ready");
            expect(progress.fileSize).toBe(1000000000);
        });
    });
    describe("destroy", () => {
        it("should destroy an active download", async () => {
            mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });
            await service.startDownload("t1", { kind: "magnet", uri: "magnet:?xt=urn:btih:abc123" });
            await new Promise((r) => setTimeout(r, 20));
            service.destroyEngine("t1");
            expect(lastDownload.destroy).toHaveBeenCalled();
            expect(service.getFile("t1")).toBeNull();
        });
    });
    describe("complete event", () => {
        it("marks the torrent ready in the DB once downloading completes", async () => {
            mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });
            await service.startDownload("t1", { kind: "magnet", uri: "magnet:?xt=urn:btih:abc123" });
            await new Promise((r) => setTimeout(r, 20));
            mockPrisma.torrent.update.mockClear();
            lastDownload.emit("complete");
            expect(mockPrisma.torrent.update).toHaveBeenCalledWith({
                where: { id: "t1" },
                data: { downloadStatus: "ready" },
            });
        });
    });
});
