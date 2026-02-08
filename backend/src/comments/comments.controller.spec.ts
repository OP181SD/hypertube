import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";
import { mockDbUser } from "../../test/fixtures/users.fixture";
import { mockDbMovie } from "../../test/fixtures/movies.fixture";

const mockComment = {
  id: "comment-1",
  content: "Great movie!",
  movieId: mockDbMovie.id,
  authorId: mockDbUser.id,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  author: { id: mockDbUser.id, username: mockDbUser.username },
};

const mockCommentsService = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

describe("CommentsController", () => {
  let controller: CommentsController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        { provide: CommentsService, useValue: mockCommentsService },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
  });

  describe("GET /comments", () => {
    it("should return all comments", async () => {
      mockCommentsService.findAll.mockResolvedValue([mockComment]);

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
      expect(mockCommentsService.findAll).toHaveBeenCalledWith(undefined);
    });

    it("should filter by movieId", async () => {
      mockCommentsService.findAll.mockResolvedValue([mockComment]);

      await controller.findAll(mockDbMovie.id);

      expect(mockCommentsService.findAll).toHaveBeenCalledWith(mockDbMovie.id);
    });
  });

  describe("GET /comments/:id", () => {
    it("should return a single comment", async () => {
      mockCommentsService.findById.mockResolvedValue(mockComment);

      const result = await controller.findOne("comment-1");

      expect(result).toEqual(mockComment);
    });

    it("should propagate NotFoundException", async () => {
      mockCommentsService.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.findOne("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("POST /comments", () => {
    it("should create a comment", async () => {
      mockCommentsService.create.mockResolvedValue(mockComment);

      const result = await controller.create(
        { movieId: mockDbMovie.id, content: "Great movie!" },
        mockDbUser as any,
      );

      expect(result).toEqual(mockComment);
      expect(mockCommentsService.create).toHaveBeenCalledWith(
        mockDbUser.id,
        mockDbMovie.id,
        "Great movie!",
      );
    });
  });

  describe("POST /movies/:movie_id/comments", () => {
    it("should create a comment on a movie", async () => {
      mockCommentsService.create.mockResolvedValue(mockComment);

      const result = await controller.createForMovie(
        mockDbMovie.id,
        { content: "Awesome!" },
        mockDbUser as any,
      );

      expect(result).toEqual(mockComment);
      expect(mockCommentsService.create).toHaveBeenCalledWith(
        mockDbUser.id,
        mockDbMovie.id,
        "Awesome!",
      );
    });
  });

  describe("PATCH /comments/:id", () => {
    it("should update own comment", async () => {
      const updated = { ...mockComment, content: "Updated!" };
      mockCommentsService.update.mockResolvedValue(updated);

      const result = await controller.update(
        "comment-1",
        { content: "Updated!" },
        mockDbUser as any,
      );

      expect(result.content).toBe("Updated!");
    });

    it("should propagate ForbiddenException", async () => {
      mockCommentsService.update.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        controller.update(
          "comment-1",
          { content: "Hacked!" },
          mockDbUser as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("DELETE /comments/:id", () => {
    it("should delete own comment", async () => {
      mockCommentsService.remove.mockResolvedValue(undefined);

      await controller.remove("comment-1", mockDbUser as any);

      expect(mockCommentsService.remove).toHaveBeenCalledWith(
        "comment-1",
        mockDbUser.id,
      );
    });
  });
});
