import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../client";
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from "../comments.api";
import type { Comment } from "@/types/api";

vi.mock("../client", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockGet = vi.mocked(client.get);
const mockPost = vi.mocked(client.post);
const mockPatch = vi.mocked(client.patch);
const mockDelete = vi.mocked(client.delete);

const COMMENT: Comment = {
  id: "c1",
  content: "Great movie!",
  movieId: "m1",
  author: { id: "u1", username: "john" },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("comments.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getComments", () => {
    it("should GET /comments with movieId param", async () => {
      mockGet.mockResolvedValueOnce({ data: [COMMENT] });

      const result = await getComments("m1");

      expect(mockGet).toHaveBeenCalledWith("/comments", {
        params: { movieId: "m1" },
      });
      expect(result).toEqual([COMMENT]);
    });
  });

  describe("createComment", () => {
    it("should POST /movies/:movieId/comments", async () => {
      mockPost.mockResolvedValueOnce({ data: COMMENT });

      const result = await createComment("m1", "Great movie!");

      expect(mockPost).toHaveBeenCalledWith("/movies/m1/comments", {
        content: "Great movie!",
      });
      expect(result).toEqual(COMMENT);
    });
  });

  describe("updateComment", () => {
    it("should PATCH /comments/:id", async () => {
      const updated = { ...COMMENT, content: "Updated!" };
      mockPatch.mockResolvedValueOnce({ data: updated });

      const result = await updateComment("c1", "Updated!");

      expect(mockPatch).toHaveBeenCalledWith("/comments/c1", {
        content: "Updated!",
      });
      expect(result).toEqual(updated);
    });
  });

  describe("deleteComment", () => {
    it("should DELETE /comments/:id", async () => {
      mockDelete.mockResolvedValueOnce({ data: undefined });

      await deleteComment("c1");

      expect(mockDelete).toHaveBeenCalledWith("/comments/c1");
    });
  });
});
