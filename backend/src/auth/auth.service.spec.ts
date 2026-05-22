import { Test, TestingModule } from "@nestjs/testing";
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { UsersService } from "../users/users.service";
import { MailService } from "../mail/mail.service";
import { AuthProvider } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockDbUser,
  validUser,
  oauthProfile42,
} from "../../test/fixtures/users.fixture";

vi.mock("argon2", () => ({
  hash: vi.fn().mockResolvedValue("$argon2id$hashed"),
  verify: vi.fn(),
}));

import * as argon2 from "argon2";

const mockPrismaService = {
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  passwordReset: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  emailVerification: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  oAuthClient: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn().mockReturnValue("mock.jwt.token"),
};

const mockConfigService = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      JWT_ACCESS_SECRET: "test-secret-min-32-characters-long",
      JWT_REFRESH_SECRET: "test-refresh-secret-min-32-chars",
      JWT_ACCESS_EXPIRY: "15m",
      FRONTEND_URL: "http://localhost:5173",
    };
    return config[key] ?? defaultValue;
  }),
};

const mockRedisService = {
  set: vi.fn(),
  get: vi.fn(),
};

const mockUsersService = {
  create: vi.fn(),
  findByUsername: vi.fn(),
  findByEmail: vi.fn(),
  findByProviderId: vi.fn(),
  findById: vi.fn(),
};

const mockMailService = {
  sendPasswordReset: vi.fn(),
  sendVerificationEmail: vi.fn(),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("register", () => {
    it("should create user and send verification email", async () => {
      mockUsersService.create.mockResolvedValue(mockDbUser);
      mockPrismaService.emailVerification.create.mockResolvedValue({});
      mockMailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.register({
        email: validUser.email,
        username: validUser.username,
        firstName: validUser.firstName,
        lastName: validUser.lastName,
        password: validUser.password,
      });

      expect(result).toBeUndefined();
      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: validUser.email,
        username: validUser.username,
        firstName: validUser.firstName,
        lastName: validUser.lastName,
        password: validUser.password,
      });
      expect(mockPrismaService.emailVerification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockDbUser.id,
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
      expect(mockMailService.sendVerificationEmail).toHaveBeenCalledWith(
        mockDbUser.email,
        mockDbUser.username,
        expect.stringContaining("http://localhost:5173/verify-email?token="),
      );
    });

    it("should propagate ConflictException from usersService", async () => {
      mockUsersService.create.mockRejectedValue(
        new ConflictException("Email already exists"),
      );

      await expect(
        service.register({
          email: validUser.email,
          username: validUser.username,
          firstName: validUser.firstName,
          lastName: validUser.lastName,
          password: validUser.password,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("verifyEmail", () => {
    it("should verify email and return token pair", async () => {
      const record = {
        id: "verif-id",
        token: "valid-token",
        userId: mockDbUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      };
      mockPrismaService.emailVerification.findUnique.mockResolvedValue(record);
      mockPrismaService.$transaction.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyEmail("valid-token");

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid token", async () => {
      mockPrismaService.emailVerification.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail("invalid-token")).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for already used token", async () => {
      mockPrismaService.emailVerification.findUnique.mockResolvedValue({
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(service.verifyEmail("used-token")).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for expired token", async () => {
      mockPrismaService.emailVerification.findUnique.mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() - 86400000),
      });

      await expect(service.verifyEmail("expired-token")).rejects.toThrow(BadRequestException);
    });
  });

  describe("resendVerification", () => {
    it("should send a new verification email for unverified local user", async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockDbUser);
      mockPrismaService.emailVerification.create.mockResolvedValue({});
      mockMailService.sendVerificationEmail.mockResolvedValue(undefined);

      await service.resendVerification(mockDbUser.email);

      expect(mockMailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it("should not throw for nonexistent email (security)", async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.resendVerification("nobody@example.com")).resolves.toBeUndefined();
      expect(mockMailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it("should not resend for already verified user", async () => {
      mockUsersService.findByEmail.mockResolvedValue({ ...mockDbUser, emailVerified: true });

      await service.resendVerification(mockDbUser.email);

      expect(mockMailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe("validateLocalUser", () => {
    it("should return user when credentials are valid", async () => {
      const verifiedUser = { ...mockDbUser, emailVerified: true };
      mockUsersService.findByUsername.mockResolvedValue(verifiedUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const result = await service.validateLocalUser(
        mockDbUser.username,
        "SecurePass123!",
      );

      expect(result).toEqual(verifiedUser);
    });

    it("should throw ForbiddenException when email is not verified", async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockDbUser); // emailVerified: false
      vi.mocked(argon2.verify).mockResolvedValue(true);

      await expect(
        service.validateLocalUser(mockDbUser.username, "SecurePass123!"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw UnauthorizedException when user not found", async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.validateLocalUser("nonexistent", "password"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when password is wrong", async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockDbUser);
      vi.mocked(argon2.verify).mockResolvedValue(false);

      await expect(
        service.validateLocalUser(mockDbUser.username, "wrongpassword"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for OAuth user without password", async () => {
      const oauthUser = { ...mockDbUser, passwordHash: null };
      mockUsersService.findByUsername.mockResolvedValue(oauthUser);

      await expect(
        service.validateLocalUser(oauthUser.username, "anypassword"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("generateTokens", () => {
    it("should return a token pair with access_token and refresh_token", async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.generateTokens(mockDbUser.id);

      expect(result.access_token).toBe("mock.jwt.token");
      expect(result.refresh_token).toBeDefined();
      expect(result.refresh_token.length).toBeGreaterThan(0);
      expect(result.token_type).toBe("Bearer");
      expect(result.expires_in).toBe(900);
    });

    it("should store refresh token in database", async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.generateTokens(mockDbUser.id);

      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockDbUser.id,
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it("should sign JWT with correct payload", async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.generateTokens(mockDbUser.id);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: mockDbUser.id },
        expect.objectContaining({
          secret: "test-secret-min-32-characters-long",
          expiresIn: 900,
        }),
      );
    });
  });

  describe("refreshTokens", () => {
    it("should rotate tokens when valid refresh token provided", async () => {
      const storedToken = {
        id: "token-id",
        token: "valid-refresh-token",
        userId: mockDbUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      };
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(storedToken);
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens("valid-refresh-token");

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      // Old token should be revoked
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "token-id" },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("should throw UnauthorizedException for invalid refresh token", async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshTokens("invalid-token"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for revoked refresh token", async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(
        service.refreshTokens("revoked-token"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for expired refresh token", async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400000), // expired yesterday
      });

      await expect(
        service.refreshTokens("expired-token"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("validateOAuthUser", () => {
    it("should return existing user when found by providerId", async () => {
      mockUsersService.findByProviderId.mockResolvedValue(mockDbUser);

      const result = await service.validateOAuthUser(
        oauthProfile42,
        AuthProvider.FORTY_TWO,
      );

      expect(result).toEqual(mockDbUser);
    });

    it("should link OAuth to existing account by email", async () => {
      mockUsersService.findByProviderId.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue(mockDbUser);
      const linkedUser = {
        ...mockDbUser,
        authProvider: AuthProvider.FORTY_TWO,
        providerId: "12345",
      };
      mockPrismaService.user.update.mockResolvedValue(linkedUser);

      const result = await service.validateOAuthUser(
        oauthProfile42,
        AuthProvider.FORTY_TWO,
      );

      expect(result.authProvider).toBe(AuthProvider.FORTY_TWO);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockDbUser.id },
        data: expect.objectContaining({
          authProvider: AuthProvider.FORTY_TWO,
          providerId: "12345",
        }),
      });
    });

    it("should create new user when no existing account found", async () => {
      mockUsersService.findByProviderId.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue(null);
      const newUser = {
        ...mockDbUser,
        username: oauthProfile42.username,
        email: oauthProfile42.email,
        authProvider: AuthProvider.FORTY_TWO,
      };
      mockUsersService.create.mockResolvedValue(newUser);

      const result = await service.validateOAuthUser(
        oauthProfile42,
        AuthProvider.FORTY_TWO,
      );

      expect(result.email).toBe(oauthProfile42.email);
      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: oauthProfile42.email,
          username: oauthProfile42.username,
          authProvider: AuthProvider.FORTY_TWO,
          providerId: oauthProfile42.id,
          emailVerified: true,
        }),
      );
    });
  });

  describe("validateOAuthClient", () => {
    it("should return true for valid client credentials", async () => {
      mockPrismaService.oAuthClient.findUnique.mockResolvedValue({
        clientId: "test-client",
        clientSecret: "test-secret",
      });

      const result = await service.validateOAuthClient(
        "test-client",
        "test-secret",
      );

      expect(result).toBe(true);
    });

    it("should return false for invalid client", async () => {
      mockPrismaService.oAuthClient.findUnique.mockResolvedValue(null);

      const result = await service.validateOAuthClient(
        "invalid-client",
        "secret",
      );

      expect(result).toBe(false);
    });

    it("should return false for wrong secret", async () => {
      mockPrismaService.oAuthClient.findUnique.mockResolvedValue({
        clientId: "test-client",
        clientSecret: "real-secret",
      });

      const result = await service.validateOAuthClient(
        "test-client",
        "wrong-secret",
      );

      expect(result).toBe(false);
    });
  });

  describe("forgotPassword", () => {
    it("should send reset email for existing local user", async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockDbUser);
      mockPrismaService.passwordReset.create.mockResolvedValue({});
      mockMailService.sendPasswordReset.mockResolvedValue(undefined);

      await service.forgotPassword(mockDbUser.email);

      expect(mockPrismaService.passwordReset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockDbUser.id,
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
      expect(mockMailService.sendPasswordReset).toHaveBeenCalledWith(
        mockDbUser.email,
        mockDbUser.username,
        expect.stringContaining("http://localhost:5173/reset-password?token="),
      );
    });

    it("should not throw for nonexistent email (security)", async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword("nonexistent@example.com"),
      ).resolves.toBeUndefined();

      expect(mockMailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it("should not send reset for OAuth user", async () => {
      const oauthUser = {
        ...mockDbUser,
        authProvider: AuthProvider.FORTY_TWO,
      };
      mockUsersService.findByEmail.mockResolvedValue(oauthUser);

      await service.forgotPassword(oauthUser.email);

      expect(mockMailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid token", async () => {
      const resetRecord = {
        id: "reset-id",
        token: "valid-token",
        userId: mockDbUser.id,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      };
      mockPrismaService.passwordReset.findUnique.mockResolvedValue(
        resetRecord,
      );
      mockPrismaService.$transaction.mockResolvedValue([]);

      await service.resetPassword("valid-token", "NewSecurePass123!");

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid token", async () => {
      mockPrismaService.passwordReset.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword("invalid-token", "NewPass123!"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for already used token", async () => {
      mockPrismaService.passwordReset.findUnique.mockResolvedValue({
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      await expect(
        service.resetPassword("used-token", "NewPass123!"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for expired token", async () => {
      mockPrismaService.passwordReset.findUnique.mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() - 3600000), // expired
      });

      await expect(
        service.resetPassword("expired-token", "NewPass123!"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("logout", () => {
    it("should revoke refresh token", async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.logout(mockDbUser.id, "some-refresh-token");

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: "some-refresh-token", userId: mockDbUser.id },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("should handle logout without refresh token", async () => {
      await service.logout(mockDbUser.id);

      expect(
        mockPrismaService.refreshToken.updateMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe("blacklistAccessToken", () => {
    it("should store token in Redis with TTL", async () => {
      await service.blacklistAccessToken("some.jwt.token", 900);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        "bl:some.jwt.token",
        "1",
        "EX",
        900,
      );
    });
  });

  describe("isAccessTokenBlacklisted", () => {
    it("should return true when token is blacklisted", async () => {
      mockRedisService.get.mockResolvedValue("1");

      const result = await service.isAccessTokenBlacklisted("some.jwt.token");

      expect(result).toBe(true);
    });

    it("should return false when token is not blacklisted", async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.isAccessTokenBlacklisted("valid.jwt.token");

      expect(result).toBe(false);
    });
  });
});
