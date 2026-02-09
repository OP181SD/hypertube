import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../client";
import { getUser, updateUser, uploadProfilePicture } from "../users.api";
import type { UserPublic } from "@/types/api";

vi.mock("../client", () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

const mockGet = vi.mocked(client.get);
const mockPatch = vi.mocked(client.patch);
const mockPost = vi.mocked(client.post);

const mockUser: UserPublic = {
  id: "u1",
  username: "john",
  firstName: "John",
  lastName: "Doe",
  profilePictureUrl: null,
  language: "EN",
};

describe("users.api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should GET /users/:id", async () => {
    mockGet.mockResolvedValueOnce({ data: mockUser });

    const result = await getUser("u1");

    expect(mockGet).toHaveBeenCalledWith("/users/u1");
    expect(result).toEqual(mockUser);
  });

  it("should PATCH /users/:id with update data", async () => {
    const updated = { ...mockUser, firstName: "Jane" };
    mockPatch.mockResolvedValueOnce({ data: updated });

    const result = await updateUser("u1", { firstName: "Jane" });

    expect(mockPatch).toHaveBeenCalledWith("/users/u1", { firstName: "Jane" });
    expect(result).toEqual(updated);
  });

  it("should POST /users/:id/avatar with file", async () => {
    const response = { profilePictureUrl: "/uploads/avatars/abc.jpg" };
    mockPost.mockResolvedValueOnce({ data: response });

    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    const result = await uploadProfilePicture("u1", file);

    expect(mockPost).toHaveBeenCalledWith(
      "/users/u1/avatar",
      expect.any(FormData),
    );
    expect(result).toEqual(response);
  });
});
