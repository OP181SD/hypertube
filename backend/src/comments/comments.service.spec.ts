import { Test, TestingModule } from "@nestjs/testing";
import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
} from "vitest";
import {
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { PrismaService } from "../prisma/prisma.service";
import { mockDbUser, mockDbUser2 } from "../../test/fixtures/users.fixture";
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

const mockPrisma = {
  comment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  movie: {
    findUnique: vi.fn(),
  },
};

describe("CommentsService", () => {
  let service: CommentsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe("findAll", () => {
    it("should return all comments with author info", async () => {
      mockPrisma.comment.findMany.mockResolvedValue([mockComment]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].author.username).toBe("testuser");
      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            author: expect.any(Object),
          }),
        }),
      );
    });

    it("should filter by movieId when provided", async () => {
      mockPrisma.comment.findMany.mockResolvedValue([mockComment]);

      await service.findAll(mockDbMovie.id);

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { movieId: mockDbMovie.id },
        }),
      );
    });

    it("should order by createdAt descending", async () => {
      mockPrisma.comment.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });

  describe("findById", () => {
    it("should return comment with author info", async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);

      const result = await service.findById("comment-1");

      expect(result).toEqual(mockComment);
    });

    it("should throw NotFoundException when not found", async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.findById("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    it("should create a comment", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue(mockDbMovie);
      mockPrisma.comment.create.mockResolvedValue(mockComment);

      const result = await service.create(
        mockDbUser.id,
        mockDbMovie.id,
        "Great movie!",
      );

      expect(result).toEqual(mockComment);
      expect(mockPrisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            content: "Great movie!",
            authorId: mockDbUser.id,
            movieId: mockDbMovie.id,
          },
        }),
      );
    });

    it("should throw NotFoundException when movie not found", async () => {
      mockPrisma.movie.findUnique.mockResolvedValue(null);

      await expect(
        service.create(mockDbUser.id, "nonexistent", "test"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update own comment", async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);
      const updated = { ...mockComment, content: "Updated!" };
      mockPrisma.comment.update.mockResolvedValue(updated);

      const result = await service.update(
        "comment-1",
        mockDbUser.id,
        "Updated!",
      );

      expect(result.content).toBe("Updated!");
    });

    it("should throw NotFoundException when not found", async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.update("nonexistent", mockDbUser.id, "test"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when not the author", async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);

      await expect(
        service.update("comment-1", mockDbUser2.id, "Hacked!"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("remove", () => {
    it("should delete own comment", async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);
      mockPrisma.comment.delete.mockResolvedValue(mockComment);

      await service.remove("comment-1", mockDbUser.id);

      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({
        where: { id: "comment-1" },
      });
    });

    it("should throw NotFoundException when not found", async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.remove("nonexistent", mockDbUser.id),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when not the author", async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);

      await expect(
        service.remove("comment-1", mockDbUser2.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
