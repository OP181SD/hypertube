import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TorrentService } from "./torrent.service";
import { PrismaService } from "../../prisma/prisma.service";

// Mock torrent-stream module
const mockCreateReadStream = vi.fn();
const mockFileSelect = vi.fn();
const mockFile = {
  name: "Movie.mp4",
  path: "Movie.mp4",
  length: 1_000_000_000,
  createReadStream: mockCreateReadStream,
  select: mockFileSelect,
  deselect: vi.fn(),
};

const mockEngine = {
  files: [mockFile],
  destroy: vi.fn((cb?: () => void) => cb?.()),
  on: vi.fn(),
  remove: vi.fn((_, cb?: () => void) => cb?.()),
};

// Engine event handlers registered by startDownload — captured so tests can fire them.
const engineHandlers: Record<string, (...args: unknown[]) => void> = {};

vi.mock("torrent-stream", () => ({
  default: vi.fn(() => mockEngine),
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
    if (key === "STORAGE_PATH") return "/tmp/test-videos";
    return "";
  }),
};

describe("TorrentService", () => {
  let service: TorrentService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Capture every engine handler, and auto-fire "ready" asynchronously.
    for (const key of Object.keys(engineHandlers)) delete engineHandlers[key];
    mockEngine.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      engineHandlers[event] = cb;
      if (event === "ready") {
        setTimeout(() => cb(), 0);
      }
    });

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
    // Destroy any active engines
    service.onModuleDestroy();
  });

  describe("startDownload", () => {
    it("should start a torrent download and update DB status", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1", downloadStatus: "downloading" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");

      // Wait for the ready event to fire
      await new Promise((r) => setTimeout(r, 50));

      expect(mockPrisma.torrent.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: expect.objectContaining({ downloadStatus: "downloading" }),
      });
    });

    it("should not start duplicate download for same torrentId", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1", downloadStatus: "downloading" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");
      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");

      // Should only create one engine
      const torrentStream = await import("torrent-stream");
      expect(torrentStream.default).toHaveBeenCalledTimes(1);
    });

    it("should select the largest video file from engine", async () => {
      const smallFile = {
        name: "sample.mp4",
        path: "sample.mp4",
        length: 100,
        createReadStream: vi.fn(),
        select: vi.fn(),
        deselect: vi.fn(),
      };
      const largeVideo = {
        name: "Movie.mkv",
        path: "Movie.mkv",
        length: 2_000_000_000,
        createReadStream: vi.fn(),
        select: vi.fn(),
        deselect: vi.fn(),
      };

      mockEngine.files = [smallFile, largeVideo];
      mockPrisma.torrent.update.mockResolvedValue({ id: "t2" });

      await service.startDownload("magnet:?xt=urn:btih:def456", "t2");
      await new Promise((r) => setTimeout(r, 50));

      expect(largeVideo.select).toHaveBeenCalled();
      expect(smallFile.deselect).toHaveBeenCalled();

      // Reset for other tests
      mockEngine.files = [mockFile];
    });
  });

  describe("getProgress", () => {
    it("should return idle status when no engine exists", () => {
      const progress = service.getProgress("nonexistent");

      expect(progress).toEqual({
        status: "idle",
        progress: 0,
        filePath: null,
        fileSize: null,
      });
    });

    it("should return downloading status before the video file is ready", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");

      // getProgress is read synchronously, before the mocked async "ready"
      // event has had a chance to fire and select a video file.
      const progress = service.getProgress("t1");

      expect(progress.status).toBe("downloading");
      expect(progress.fileSize).toBeNull();

      // let the "ready" event fire so the peer-log interval gets cleared
      await new Promise((r) => setTimeout(r, 50));
    });

    it("should return ready status once the video file is selected", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");
      await new Promise((r) => setTimeout(r, 50));

      const progress = service.getProgress("t1");

      expect(progress.status).toBe("ready");
      expect(progress.fileSize).toBe(1_000_000_000);
    });
  });

  describe("isActive", () => {
    it("should return false for unknown torrent", () => {
      expect(service.isActive("unknown")).toBe(false);
    });

    it("should return true for an active torrent", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");
      await new Promise((r) => setTimeout(r, 50));

      expect(service.isActive("t1")).toBe(true);
    });
  });

  describe("getFile", () => {
    it("should return null for unknown torrent", () => {
      expect(service.getFile("unknown")).toBeNull();
    });

    it("should return the file for an active torrent", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");
      await new Promise((r) => setTimeout(r, 50));

      const file = service.getFile("t1");
      expect(file).not.toBeNull();
      expect(file?.name).toBe("Movie.mp4");
    });
  });

  describe("destroy", () => {
    it("should destroy an active engine", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");
      await new Promise((r) => setTimeout(r, 50));

      service.destroyEngine("t1");

      expect(mockEngine.destroy).toHaveBeenCalled();
      expect(service.getFile("t1")).toBeNull();
    });

    it("should do nothing for unknown torrent", () => {
      expect(() => service.destroyEngine("unknown")).not.toThrow();
    });
  });

  describe("onModuleDestroy", () => {
    it("should destroy all active engines", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");
      await new Promise((r) => setTimeout(r, 50));

      service.onModuleDestroy();

      expect(mockEngine.destroy).toHaveBeenCalled();
    });
  });

  describe("engine events", () => {
    it("marks the torrent ready in the DB once downloading completes", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");
      await new Promise((r) => setTimeout(r, 50)); // let "ready" fire first

      mockPrisma.torrent.update.mockClear();
      engineHandlers.idle();

      expect(mockPrisma.torrent.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { downloadStatus: "ready" },
      });
    });

    it("does not crash when the engine emits an error", async () => {
      mockPrisma.torrent.update.mockResolvedValue({ id: "t1" });

      await service.startDownload("magnet:?xt=urn:btih:abc123", "t1");
      await new Promise((r) => setTimeout(r, 50));

      expect(() =>
        engineHandlers.error(new Error("swarm error")),
      ).not.toThrow();
    });
  });
});
