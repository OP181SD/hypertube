import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { AuthProvider } from "@prisma/client";
import { GithubStrategy } from "./github.strategy";
import type { AuthService } from "../auth.service";

const mockConfig = {
  get: (key: string) =>
    key.includes("CALLBACK") ? "http://localhost:3000/cb" : "test-value",
} as unknown as ConfigService;

const mockAuthService = { validateOAuthUser: vi.fn() };

describe("GithubStrategy", () => {
  let strategy: GithubStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new GithubStrategy(
      mockConfig,
      mockAuthService as unknown as AuthService,
    );
  });

  it("maps a GitHub profile, splitting displayName into first/last name", async () => {
    mockAuthService.validateOAuthUser.mockResolvedValue({ id: "u1" });

    await strategy.validate("at", "rt", {
      id: 7,
      username: "octocat",
      displayName: "Mona Lisa Octocat",
      emails: [{ value: "mona@github.com" }],
      photos: [{ value: "octo.png" }],
    });

    expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith(
      {
        id: "7",
        username: "octocat",
        email: "mona@github.com",
        firstName: "Mona",
        lastName: "Lisa Octocat",
        profilePictureUrl: "octo.png",
      },
      AuthProvider.GITHUB,
    );
  });

  it("falls back to a generated username and empty names for a sparse profile", async () => {
    mockAuthService.validateOAuthUser.mockResolvedValue({ id: "u1" });

    await strategy.validate("at", "rt", { id: 8 });

    expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith(
      {
        id: "8",
        username: "github_8",
        email: "",
        firstName: "",
        lastName: "",
        profilePictureUrl: undefined,
      },
      AuthProvider.GITHUB,
    );
  });
});
