import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { LocalStrategy } from "./local.strategy";
import { AuthService } from "../auth.service";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDbUser } from "../../../test/fixtures/users.fixture";

const mockAuthService = {
  validateLocalUser: vi.fn(),
};

describe("LocalStrategy", () => {
  let strategy: LocalStrategy;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
  });

  it("should return user when credentials are valid", async () => {
    mockAuthService.validateLocalUser.mockResolvedValue(mockDbUser);

    const result = await strategy.validate("testuser", "SecurePass123!");

    expect(result).toEqual(mockDbUser);
    expect(mockAuthService.validateLocalUser).toHaveBeenCalledWith(
      "testuser",
      "SecurePass123!",
    );
  });

  it("should propagate UnauthorizedException when credentials are invalid", async () => {
    mockAuthService.validateLocalUser.mockRejectedValue(
      new UnauthorizedException("Invalid credentials"),
    );

    await expect(
      strategy.validate("testuser", "wrongpassword"),
    ).rejects.toThrow(UnauthorizedException);
  });
});
