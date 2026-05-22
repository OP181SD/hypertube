import { Test, TestingModule } from "@nestjs/testing";
import {
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ThrottlerGuard } from "@nestjs/throttler";
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

const mockConfigService = {
  get: vi.fn((key: string) => {
    const config: Record<string, unknown> = {
      NODE_ENV: "test",
      FRONTEND_URL: "http://localhost:5173",
    };
    return config[key];
  }),
};

const mockAuthService = {
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  validateLocalUser: vi.fn(),
  generateTokens: vi.fn(),
  refreshTokens: vi.fn(),
  validateOAuthClient: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  blacklistAccessToken: vi.fn(),
};

const mockRes = {
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
};

const mockReq = {
  cookies: { refresh_token: "mock-refresh-token" },
};

describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      // ThrottlerGuard needs ThrottlerModule's providers — not relevant to
      // controller unit tests, so replace it with a pass-through.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe("POST /auth/register", () => {
    it("should register and return a confirmation message", async () => {
      mockAuthService.register.mockResolvedValue(undefined);

      const result = await controller.register({
        email: validUser.email,
        username: validUser.username,
        firstName: validUser.firstName,
        lastName: validUser.lastName,
        password: validUser.password,
      });

      expect(result.message).toBeDefined();
      expect(mockAuthService.register).toHaveBeenCalledWith(
        expect.objectContaining({ email: validUser.email }),
      );
    });
  });

  describe("POST /auth/verify-email", () => {
    it("should verify email, set cookies and return success message", async () => {
      mockAuthService.verifyEmail.mockResolvedValue(mockTokenPair);

      const result = await controller.verifyEmail(
        { token: "valid-token" },
        mockRes as any,
      );

      expect(result.message).toBeDefined();
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith("valid-token");
      expect(mockRes.setCookie).toHaveBeenCalled();
    });
  });

  describe("POST /auth/resend-verification", () => {
    it("should return a generic success message", async () => {
      mockAuthService.resendVerification.mockResolvedValue(undefined);

      const result = await controller.resendVerification({ email: "test@example.com" });

      expect(result.message).toBeDefined();
      expect(mockAuthService.resendVerification).toHaveBeenCalledWith("test@example.com");
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

      const result = await controller.forgotPassword({ email: "test@example.com" });

      expect(result.message).toBeDefined();
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith("test@example.com");
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
        mockReq as any,
        mockRes as any,
      );

      expect(result.message).toBeDefined();
      expect(mockAuthService.logout).toHaveBeenCalledWith(
        mockDbUser.id,
        "mock-refresh-token",
      );
    });
  });

  describe("POST /auth/login", () => {
    it("validates credentials, sets cookies and returns a message", async () => {
      mockAuthService.validateLocalUser.mockResolvedValue(mockDbUser);
      mockAuthService.generateTokens.mockResolvedValue(mockTokenPair);

      const result = await controller.login(
        { username: validUser.username, password: validUser.password },
        mockRes as any,
      );

      expect(result.message).toBeDefined();
      expect(mockAuthService.validateLocalUser).toHaveBeenCalledWith(
        validUser.username,
        validUser.password,
      );
      expect(mockRes.setCookie).toHaveBeenCalled();
    });
  });

  describe("POST /auth/refresh", () => {
    it("refreshes tokens and sets cookies when the refresh cookie is present", async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockTokenPair);

      const result = await controller.refresh(mockReq as any, mockRes as any);

      expect(result.message).toBeDefined();
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
        "mock-refresh-token",
      );
      expect(mockRes.setCookie).toHaveBeenCalled();
    });

    it("throws UnauthorizedException when no refresh cookie is present", async () => {
      await expect(
        controller.refresh({ cookies: {} } as any, mockRes as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("POST /oauth/token — unsupported grant", () => {
    it("throws BadRequestException for an unknown grant type", async () => {
      mockAuthService.validateOAuthClient.mockResolvedValue(true);

      await expect(
        controller.token({
          grant_type: "client_credentials" as GrantType,
          client_id: "test-client",
          client_secret: "test-secret",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("OAuth callbacks", () => {
    function makeOAuthRes() {
      const redirect = vi.fn();
      const send = vi.fn();
      const status = vi.fn().mockReturnValue({ redirect, send });
      return { setCookie: vi.fn(), status, redirect, send };
    }

    it("sets cookies and redirects to the frontend callback on success", async () => {
      mockAuthService.generateTokens.mockResolvedValue(mockTokenPair);
      const res = makeOAuthRes();

      await controller.ft42Callback({ user: mockDbUser } as any, res as any);

      expect(res.setCookie).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(302);
      expect(res.redirect).toHaveBeenCalledWith(
        "http://localhost:5173/auth/callback",
      );
    });

    it("redirects to the login page with an error when no user is resolved", async () => {
      const res = makeOAuthRes();

      await controller.ft42Callback({ user: undefined } as any, res as any);

      expect(res.status).toHaveBeenCalledWith(302);
      expect(res.redirect).toHaveBeenCalledWith(
        "http://localhost:5173/login?error=auth_failed",
      );
    });

    it("responds 500 when token generation fails", async () => {
      mockAuthService.generateTokens.mockRejectedValue(new Error("boom"));
      const res = makeOAuthRes();

      await controller.ft42Callback({ user: mockDbUser } as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalled();
    });

    it("uses the same redirect flow for Google, GitHub and Discord callbacks", async () => {
      mockAuthService.generateTokens.mockResolvedValue(mockTokenPair);

      for (const cb of [
        controller.googleCallback,
        controller.githubCallback,
        controller.discordCallback,
      ]) {
        const res = makeOAuthRes();
        await cb.call(controller, { user: mockDbUser } as any, res as any);
        expect(res.redirect).toHaveBeenCalledWith(
          "http://localhost:5173/auth/callback",
        );
      }
    });
  });
});
