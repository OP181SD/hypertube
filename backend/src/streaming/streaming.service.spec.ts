import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { PassThrough } from "node:stream";
import { StreamingService } from "./streaming.service";
import { TorrentService } from "./services/torrent.service";
import { TranscodingService } from "./services/transcoding.service";
import { SubtitleService } from "./services/subtitle.service";
import { PrismaService } from "../prisma/prisma.service";
const mockTorrentService = {
    ensurePlayback: vi.fn(),
    getProgress: vi.fn(),
    isActive: vi.fn(),
    getFile: vi.fn(),
    destroyEngine: vi.fn(),
};
const mockTranscodingService = {
    needsTranscoding: vi.fn(),
    transcodeToMp4: vi.fn(),
};
const mockSubtitleService = {
    getAvailableSubtitles: vi.fn(),
    downloadSubtitle: vi.fn(),
    getCachedSubtitle: vi.fn(),
};
const mockPrisma = {
    torrent: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    watchHistory: {
        upsert: vi.fn(),
    },
    movie: {
        findUnique: vi.fn(),
    },
};
describe("StreamingService", () => {
    let service: StreamingService;
    beforeEach(async () => {
        vi.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StreamingService,
                { provide: TorrentService, useValue: mockTorrentService },
                { provide: TranscodingService, useValue: mockTranscodingService },
                { provide: SubtitleService, useValue: mockSubtitleService },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();
        service = module.get<StreamingService>(StreamingService);
    });
    describe("initiateStream", () => {
        it("should throw NotFoundException for unknown torrent", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue(null);
            await expect(service.initiateStream("nonexistent", "user-1")).rejects.toThrow(NotFoundException);
        });
        it("should start playback for idle torrent", async () => {
            const torrent = {
                id: "t1",
                movieId: "m1",
                magnetUrl: "magnet:?xt=urn:btih:abc",
                downloadStatus: "idle",
                movie: { id: "m1" },
            };
            mockPrisma.torrent.findUnique.mockResolvedValue(torrent);
            mockPrisma.torrent.update.mockResolvedValue(torrent);
            mockPrisma.watchHistory.upsert.mockResolvedValue({});
            mockTorrentService.ensurePlayback.mockResolvedValue(undefined);
            mockTorrentService.getProgress.mockReturnValue({
                status: "downloading",
                progress: 0,
                filePath: null,
                fileSize: null,
            });
            const result = await service.initiateStream("t1", "user-1");
            expect(mockTorrentService.ensurePlayback).toHaveBeenCalledWith("t1");
            expect(result.status).toBe("downloading");
        });
        it("should resolve playback without restarting an active download", async () => {
            const torrent = {
                id: "t1",
                movieId: "m1",
                magnetUrl: "magnet:?xt=urn:btih:abc",
                downloadStatus: "downloading",
                movie: { id: "m1" },
            };
            mockPrisma.torrent.findUnique.mockResolvedValue(torrent);
            mockPrisma.torrent.update.mockResolvedValue(torrent);
            mockPrisma.watchHistory.upsert.mockResolvedValue({});
            mockTorrentService.ensurePlayback.mockResolvedValue(undefined);
            mockTorrentService.getProgress.mockReturnValue({
                status: "downloading",
                progress: 50,
                filePath: null,
                fileSize: null,
            });
            const result = await service.initiateStream("t1", "user-1");
            expect(mockTorrentService.ensurePlayback).toHaveBeenCalledWith("t1");
            expect(result.progress).toBe(50);
        });
        it("should record watch history", async () => {
            const torrent = {
                id: "t1",
                movieId: "m1",
                magnetUrl: "magnet:?xt=urn:btih:abc",
                downloadStatus: "ready",
                movie: { id: "m1" },
            };
            mockPrisma.torrent.findUnique.mockResolvedValue(torrent);
            mockPrisma.torrent.update.mockResolvedValue(torrent);
            mockPrisma.watchHistory.upsert.mockResolvedValue({});
            mockTorrentService.ensurePlayback.mockResolvedValue(undefined);
            mockTorrentService.getProgress.mockReturnValue({
                status: "ready",
                progress: 100,
                filePath: "/path/movie.mp4",
                fileSize: 1000,
            });
            await service.initiateStream("t1", "user-1");
            expect(mockPrisma.watchHistory.upsert).toHaveBeenCalledWith({
                where: { userId_movieId: { userId: "user-1", movieId: "m1" } },
                create: { userId: "user-1", movieId: "m1" },
                update: { watchedAt: expect.any(Date) },
            });
        });
        it("should update lastAccessedAt on torrent", async () => {
            const torrent = {
                id: "t1",
                movieId: "m1",
                magnetUrl: "magnet:?xt=urn:btih:abc",
                downloadStatus: "ready",
                movie: { id: "m1" },
            };
            mockPrisma.torrent.findUnique.mockResolvedValue(torrent);
            mockPrisma.torrent.update.mockResolvedValue(torrent);
            mockPrisma.watchHistory.upsert.mockResolvedValue({});
            mockTorrentService.ensurePlayback.mockResolvedValue(undefined);
            mockTorrentService.getProgress.mockReturnValue({
                status: "ready",
                progress: 100,
                filePath: "/path/movie.mp4",
                fileSize: 1000,
            });
            await service.initiateStream("t1", "user-1");
            expect(mockPrisma.torrent.update).toHaveBeenCalledWith({
                where: { id: "t1" },
                data: { lastAccessedAt: expect.any(Date) },
            });
        });
    });
    describe("getStreamStatus", () => {
        it("should throw NotFoundException for unknown torrent", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue(null);
            await expect(service.getStreamStatus("nonexistent")).rejects.toThrow(NotFoundException);
        });
        it("should return progress for existing torrent", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                magnetUrl: "magnet:?xt=urn:btih:abc",
                downloadStatus: "downloading",
            });
            mockTorrentService.ensurePlayback.mockResolvedValue(undefined);
            mockTorrentService.getProgress.mockReturnValue({
                status: "downloading",
                progress: 75,
                filePath: null,
                fileSize: 1000,
            });
            const result = await service.getStreamStatus("t1");
            expect(mockTorrentService.ensurePlayback).toHaveBeenCalledWith("t1");
            expect(result.status).toBe("downloading");
            expect(result.progress).toBe(75);
        });
    });
    describe("getVideoStream", () => {
        it("should throw NotFoundException when torrent not found", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue(null);
            await expect(service.getVideoStream("nonexistent")).rejects.toThrow(NotFoundException);
        });
        it("should throw NotFoundException when file not available", async () => {
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                filePath: "/path/movie.mp4",
            });
            mockTorrentService.getFile.mockReturnValue(null);
            await expect(service.getVideoStream("t1")).rejects.toThrow(NotFoundException);
        });
        it("should return direct stream for MP4 files", async () => {
            const mockStream = new PassThrough();
            const mockFile = {
                name: "movie.mp4",
                length: 1000,
                createReadStream: vi.fn().mockReturnValue(mockStream),
            };
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                filePath: "/path/movie.mp4",
            });
            mockTorrentService.getFile.mockReturnValue(mockFile);
            mockTranscodingService.needsTranscoding.mockReturnValue(false);
            const result = await service.getVideoStream("t1");
            expect(result.mimeType).toBe("video/mp4");
            expect(result.fileSize).toBe(1000);
        });
        it("should return transcoded stream for MKV files", async () => {
            const mockStream = new PassThrough();
            const mockFile = {
                name: "movie.mkv",
                length: 2000,
                createReadStream: vi.fn().mockReturnValue(new PassThrough()),
            };
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                filePath: "/path/movie.mkv",
            });
            mockTorrentService.getFile.mockReturnValue(mockFile);
            mockTranscodingService.needsTranscoding.mockReturnValue(true);
            mockTranscodingService.transcodeToMp4.mockReturnValue(mockStream);
            const result = await service.getVideoStream("t1");
            expect(result.mimeType).toBe("video/mp4");
            expect(result.fileSize).toBeNull();
        });
        it("should support range requests for direct streams", async () => {
            const mockStream = new PassThrough();
            const mockFile = {
                name: "movie.mp4",
                length: 10000,
                createReadStream: vi.fn().mockReturnValue(mockStream),
            };
            mockPrisma.torrent.findUnique.mockResolvedValue({
                id: "t1",
                filePath: "/path/movie.mp4",
            });
            mockTorrentService.getFile.mockReturnValue(mockFile);
            mockTranscodingService.needsTranscoding.mockReturnValue(false);
            const result = await service.getVideoStream("t1", "bytes=0-999");
            expect(result.start).toBe(0);
            expect(result.end).toBe(999);
            expect(result.totalSize).toBe(10000);
            expect(mockFile.createReadStream).toHaveBeenCalledWith({
                start: 0,
                end: 999,
            });
        });
    });
    describe("getSubtitlesByMovieId", () => {
        it("should throw NotFoundException for unknown movie", async () => {
            mockPrisma.movie.findUnique.mockResolvedValue(null);
            await expect(service.getSubtitlesByMovieId("nonexistent")).rejects.toThrow(NotFoundException);
        });
        it("should return subtitles for existing movie", async () => {
            mockPrisma.movie.findUnique.mockResolvedValue({
                id: "m1",
                imdbId: "tt0133093",
            });
            mockSubtitleService.getAvailableSubtitles.mockResolvedValue([
                { lang: "en", label: "English", fileId: "100" },
            ]);
            const result = await service.getSubtitlesByMovieId("m1");
            expect(mockPrisma.movie.findUnique).toHaveBeenCalledWith({
                where: { id: "m1" },
            });
            expect(mockSubtitleService.getAvailableSubtitles).toHaveBeenCalledWith("tt0133093");
            expect(result).toHaveLength(1);
            expect(result[0].lang).toBe("en");
        });
    });
    describe("getSubtitleFileByMovieId", () => {
        it("should throw NotFoundException for unknown movie", async () => {
            mockPrisma.movie.findUnique.mockResolvedValue(null);
            await expect(service.getSubtitleFileByMovieId("nonexistent", "en")).rejects.toThrow(NotFoundException);
        });
        it("should throw NotFoundException when language not available", async () => {
            mockPrisma.movie.findUnique.mockResolvedValue({
                id: "m1",
                imdbId: "tt0133093",
            });
            mockSubtitleService.getAvailableSubtitles.mockResolvedValue([]);
            await expect(service.getSubtitleFileByMovieId("m1", "en")).rejects.toThrow(NotFoundException);
        });
        it("should return empty VTT when download fails", async () => {
            mockPrisma.movie.findUnique.mockResolvedValue({
                id: "m1",
                imdbId: "tt0133093",
            });
            mockSubtitleService.getAvailableSubtitles.mockResolvedValue([
                { lang: "en", label: "English", fileId: "100" },
            ]);
            mockSubtitleService.downloadSubtitle.mockResolvedValue(null);
            const result = await service.getSubtitleFileByMovieId("m1", "en");
            expect(result.content).toBe("WEBVTT\n\n");
        });
        it("should return VTT content for valid subtitle", async () => {
            mockPrisma.movie.findUnique.mockResolvedValue({
                id: "m1",
                imdbId: "tt0133093",
            });
            mockSubtitleService.getAvailableSubtitles.mockResolvedValue([
                { lang: "en", label: "English", fileId: "100" },
            ]);
            mockSubtitleService.downloadSubtitle.mockResolvedValue("WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello");
            const result = await service.getSubtitleFileByMovieId("m1", "en");
            expect(result.content).toContain("WEBVTT");
            expect(mockSubtitleService.downloadSubtitle).toHaveBeenCalledWith("100", "m1", "en");
        });
    });
});
