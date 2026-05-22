import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { User } from "@prisma/client";
import { WatchlistController } from "./watchlist.controller";
import { WatchlistService } from "./watchlist.service";

const mockWatchlistService = {
  getUserWatchlist: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
};

const mockUser = { id: "user-1" } as User;

describe("WatchlistController", () => {
  let controller: WatchlistController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WatchlistController],
      providers: [
        { provide: WatchlistService, useValue: mockWatchlistService },
      ],
    }).compile();

    controller = module.get<WatchlistController>(WatchlistController);
  });

  describe("GET /watchlist", () => {
    it("returns the current user's watchlist", async () => {
      const list = [{ id: "m1" }];
      mockWatchlistService.getUserWatchlist.mockResolvedValue(list);

      const result = await controller.getWatchlist(mockUser);

      expect(result).toBe(list);
      expect(mockWatchlistService.getUserWatchlist).toHaveBeenCalledWith(
        "user-1",
      );
    });
  });

  describe("POST /watchlist/:movieId", () => {
    it("adds a movie to the current user's watchlist", async () => {
      mockWatchlistService.add.mockResolvedValue({
        message: "Added to watchlist",
      });

      const result = await controller.addToWatchlist("m1", mockUser);

      expect(result).toEqual({ message: "Added to watchlist" });
      expect(mockWatchlistService.add).toHaveBeenCalledWith("user-1", "m1");
    });
  });

  describe("DELETE /watchlist/:movieId", () => {
    it("removes a movie from the current user's watchlist", async () => {
      mockWatchlistService.remove.mockResolvedValue(undefined);

      await controller.removeFromWatchlist("m1", mockUser);

      expect(mockWatchlistService.remove).toHaveBeenCalledWith("user-1", "m1");
    });
  });
});
