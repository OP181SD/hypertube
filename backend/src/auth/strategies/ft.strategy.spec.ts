import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { AuthProvider } from "@prisma/client";
import { FtStrategy } from "./ft.strategy";
import type { AuthService } from "../auth.service";

const mockConfig = {
  get: (key: string) =>
    key.includes("CALLBACK") ? "http://localhost:3000/cb" : "test-value",
} as unknown as ConfigService;

const mockAuthService = { validateOAuthUser: vi.fn() };

describe("FtStrategy", () => {
  let strategy: FtStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new FtStrategy(
      mockConfig,
      mockAuthService as unknown as AuthService,
    );
  });

  it("maps a 42 profile and delegates to AuthService.validateOAuthUser", async () => {
    mockAuthService.validateOAuthUser.mockResolvedValue({ id: "u1" });

    await strategy.validate("at", "rt", {
      id: 42,
      username: "jdoe",
      emails: [{ value: "jdoe@student.42.fr" }],
      name: { givenName: "John", familyName: "Doe" },
      photos: [{ value: "avatar.jpg" }],
    });

    expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith(
      {
        id: "42",
        username: "jdoe",
        email: "jdoe@student.42.fr",
        firstName: "John",
        lastName: "Doe",
        profilePictureUrl: "avatar.jpg",
      },
      AuthProvider.FORTY_TWO,
    );
  });

  it("falls back to a generated username and empty fields for a sparse profile", async () => {
    mockAuthService.validateOAuthUser.mockResolvedValue({ id: "u1" });

    await strategy.validate("at", "rt", { id: 99 });

    expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith(
      {
        id: "99",
        username: "ft_99",
        email: "",
        firstName: "",
        lastName: "",
        profilePictureUrl: undefined,
      },
      AuthProvider.FORTY_TWO,
    );
  });
});
