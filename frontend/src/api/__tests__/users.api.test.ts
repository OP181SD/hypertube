import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../client";
import { getUser } from "../users.api";
import type { UserPublic } from "@/types/api";

vi.mock("../client", () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(client.get);

describe("users.api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should GET /users/:id", async () => {
    const user: UserPublic = {
      id: "u1",
      username: "john",
      firstName: "John",
      lastName: "Doe",
      profilePictureUrl: null,
      language: "EN",
    };
    mockGet.mockResolvedValueOnce({ data: user });

    const result = await getUser("u1");

    expect(mockGet).toHaveBeenCalledWith("/users/u1");
    expect(result).toEqual(user);
  });
});
