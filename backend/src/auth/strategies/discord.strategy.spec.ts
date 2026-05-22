import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { AuthProvider } from "@prisma/client";
import { DiscordStrategy } from "./discord.strategy";
import type { AuthService } from "../auth.service";

const mockConfig = {
  get: (key: string) =>
    key.includes("CALLBACK") ? "http://localhost:3000/cb" : "test-value",
} as unknown as ConfigService;

const mockAuthService = { validateOAuthUser: vi.fn() };

describe("DiscordStrategy", () => {
  let strategy: DiscordStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new DiscordStrategy(
      mockConfig,
      mockAuthService as unknown as AuthService,
    );
  });

  it("maps a Discord profile and builds the avatar CDN url", async () => {
    mockAuthService.validateOAuthUser.mockResolvedValue({ id: "u1" });

    await strategy.validate("at", "rt", {
      id: "123",
      username: "gamer",
      discriminator: "4567",
      email: "gamer@discord.com",
      avatar: "abc",
    });

    expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith(
      {
        id: "123",
        username: "gamer",
        email: "gamer@discord.com",
        firstName: "gamer",
        lastName: "#4567",
        profilePictureUrl: "https://cdn.discordapp.com/avatars/123/abc.png",
      },
      AuthProvider.DISCORD,
    );
  });

  it("omits the discriminator suffix when it is '0' and has no avatar", async () => {
    mockAuthService.validateOAuthUser.mockResolvedValue({ id: "u1" });

    await strategy.validate("at", "rt", {
      id: "456",
      username: "newuser",
      discriminator: "0",
    });

    expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "456",
        username: "newuser",
        email: "",
        lastName: "",
        profilePictureUrl: undefined,
      }),
      AuthProvider.DISCORD,
    );
  });
});
