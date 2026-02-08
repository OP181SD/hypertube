import { Test, TestingModule } from "@nestjs/testing";
import {
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GrantType } from "./dto/oauth-token.dto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDbUser, validUser } from "../../test/fixtures/users.fixture";

const mockTokenPair = {
  access_token: "mock.jwt.token",
  refresh_token: "mock-refresh-token",
  token_type: "Bearer",
  expires_in: 900,
};

const mockAuthService = {
  register: vi.fn(),
  validateLocalUser: vi.fn(),
  generateTokens: vi.fn(),
  refreshTokens: vi.fn(),
  validateOAuthClient: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
};

describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe("POST /auth/register", () => {
    it("should register and return token pair", async () => {
      mockAuthService.register.mockResolvedValue(mockTokenPair);

      const result = await controller.register({
        email: validUser.email,
        username: validUser.username,
        firstName: validUser.firstName,
        lastName: validUser.lastName,
        password: validUser.password,
      });

      expect(result).toEqual(mockTokenPair);
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });
  });

  describe("POST /oauth/token", () => {
    it("should return tokens for password grant type", async () => {
      mockAuthService.validateOAuthClient.mockResolvedValue(true);
      mockAuthService.validateLocalUser.mockResolvedValue(mockDbUser);
      mockAuthService.generateTokens.mockResolvedValue(mockTokenPair);

      const result = await controller.token({
        grant_type: GrantType.PASSWORD,
        username: validUser.username,
        password: validUser.password,
        client_id: "test-client",
        client_secret: "test-secret",
      });

      expect(result).toEqual(mockTokenPair);
    });

    it("should throw UnauthorizedException for invalid client", async () => {
      mockAuthService.validateOAuthClient.mockResolvedValue(false);

      await expect(
        controller.token({
          grant_type: GrantType.PASSWORD,
          username: validUser.username,
          password: validUser.password,
          client_id: "invalid",
          client_secret: "invalid",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw BadRequestException when password grant missing credentials", async () => {
      mockAuthService.validateOAuthClient.mockResolvedValue(true);

      await expect(
        controller.token({
          grant_type: GrantType.PASSWORD,
          client_id: "test-client",
          client_secret: "test-secret",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should return tokens for refresh_token grant type", async () => {
      mockAuthService.validateOAuthClient.mockResolvedValue(true);
      mockAuthService.refreshTokens.mockResolvedValue(mockTokenPair);

      const result = await controller.token({
        grant_type: GrantType.REFRESH_TOKEN,
        refresh_token: "valid-refresh-token",
        client_id: "test-client",
        client_secret: "test-secret",
      });

      expect(result).toEqual(mockTokenPair);
    });

    it("should throw BadRequestException when refresh_token grant missing token", async () => {
      mockAuthService.validateOAuthClient.mockResolvedValue(true);

      await expect(
        controller.token({
          grant_type: GrantType.REFRESH_TOKEN,
          client_id: "test-client",
          client_secret: "test-secret",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("should return success message regardless of email existence", async () => {
      mockAuthService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword({
        email: "test@example.com",
      });

      expect(result.message).toBeDefined();
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(
        "test@example.com",
      );
    });
  });

  describe("POST /auth/reset-password", () => {
    it("should return success message on valid reset", async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: "valid-token",
        password: "NewSecure123!",
      });

      expect(result.message).toBeDefined();
    });
  });

  describe("POST /auth/logout", () => {
    it("should logout and return success message", async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(
        mockDbUser as any,
        "refresh-token",
      );

      expect(result.message).toBeDefined();
      expect(mockAuthService.logout).toHaveBeenCalledWith(
        mockDbUser.id,
        "refresh-token",
      );
    });
  });
});
