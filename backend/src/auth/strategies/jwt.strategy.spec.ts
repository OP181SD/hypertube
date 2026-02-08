import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";
import { ConfigService } from "@nestjs/config";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDbUser } from "../../../test/fixtures/users.fixture";

const mockUsersService = {
  findById: vi.fn(),
};

const mockAuthService = {
  isAccessTokenBlacklisted: vi.fn(),
};

const mockConfigService = {
  get: vi.fn().mockReturnValue("test-secret-min-32-characters-long"),
} as unknown as ConfigService;

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    vi.clearAllMocks();

    strategy = new JwtStrategy(
      mockConfigService,
      mockUsersService as any,
      mockAuthService as any,
    );
  });

  it("should return user for valid non-blacklisted token", async () => {
    mockAuthService.isAccessTokenBlacklisted.mockResolvedValue(false);
    mockUsersService.findById.mockResolvedValue(mockDbUser);

    const req = {
      headers: { authorization: "Bearer valid.jwt.token" },
    } as any;

    const result = await strategy.validate(req, { sub: mockDbUser.id });

    expect(result).toEqual(mockDbUser);
  });

  it("should throw UnauthorizedException for blacklisted token", async () => {
    mockAuthService.isAccessTokenBlacklisted.mockResolvedValue(true);

    const req = {
      headers: { authorization: "Bearer blacklisted.jwt.token" },
    } as any;

    await expect(
      strategy.validate(req, { sub: mockDbUser.id }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException when user not found", async () => {
    mockAuthService.isAccessTokenBlacklisted.mockResolvedValue(false);
    mockUsersService.findById.mockResolvedValue(null);

    const req = {
      headers: { authorization: "Bearer valid.jwt.token" },
    } as any;

    await expect(
      strategy.validate(req, { sub: "nonexistent-id" }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
