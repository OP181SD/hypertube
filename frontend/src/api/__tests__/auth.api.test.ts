import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../client";
import {
  register,
  login,
  refreshTokens,
  forgotPassword,
  resetPassword,
  logout,
} from "../auth.api";

vi.mock("../client", () => ({
  default: { post: vi.fn() },
}));

const mockPost = vi.mocked(client.post);

const TOKEN_PAIR = {
  access_token: "at",
  refresh_token: "rt",
  token_type: "Bearer",
  expires_in: 900,
};

describe("auth.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("should POST /auth/register with correct payload", async () => {
      mockPost.mockResolvedValueOnce({ data: TOKEN_PAIR });

      const payload = {
        email: "test@test.com",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        password: "Password1",
      };
      const result = await register(payload);

      expect(mockPost).toHaveBeenCalledWith("/auth/register", payload);
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe("login", () => {
    it("should POST /oauth/token with password grant type", async () => {
      mockPost.mockResolvedValueOnce({ data: TOKEN_PAIR });

      const result = await login({ username: "testuser", password: "Password1" });

      expect(mockPost).toHaveBeenCalledWith(
        "/oauth/token",
        expect.objectContaining({
          grant_type: "password",
          username: "testuser",
          password: "Password1",
          client_id: expect.any(String),
          client_secret: expect.any(String),
        }),
      );
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe("refreshTokens", () => {
    it("should POST /oauth/token with refresh_token grant type", async () => {
      mockPost.mockResolvedValueOnce({ data: TOKEN_PAIR });

      const result = await refreshTokens("old-rt");

      expect(mockPost).toHaveBeenCalledWith(
        "/oauth/token",
        expect.objectContaining({
          grant_type: "refresh_token",
          refresh_token: "old-rt",
          client_id: expect.any(String),
          client_secret: expect.any(String),
        }),
      );
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe("forgotPassword", () => {
    it("should POST /auth/forgot-password with email", async () => {
      const msg = { message: "If the email exists, a reset link has been sent" };
      mockPost.mockResolvedValueOnce({ data: msg });

      const result = await forgotPassword("test@test.com");

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", {
        email: "test@test.com",
      });
      expect(result).toEqual(msg);
    });
  });

  describe("resetPassword", () => {
    it("should POST /auth/reset-password with token and password", async () => {
      const msg = { message: "Password has been reset successfully" };
      mockPost.mockResolvedValueOnce({ data: msg });

      const result = await resetPassword("tok123", "NewPass1");

      expect(mockPost).toHaveBeenCalledWith("/auth/reset-password", {
        token: "tok123",
        password: "NewPass1",
      });
      expect(result).toEqual(msg);
    });
  });

  describe("logout", () => {
    it("should POST /auth/logout with optional refresh_token", async () => {
      const msg = { message: "Logged out successfully" };
      mockPost.mockResolvedValueOnce({ data: msg });

      const result = await logout("rt");

      expect(mockPost).toHaveBeenCalledWith("/auth/logout", {
        refresh_token: "rt",
      });
      expect(result).toEqual(msg);
    });

    it("should POST /auth/logout without refresh_token", async () => {
      const msg = { message: "Logged out successfully" };
      mockPost.mockResolvedValueOnce({ data: msg });

      const result = await logout();

      expect(mockPost).toHaveBeenCalledWith("/auth/logout", {});
      expect(result).toEqual(msg);
    });
  });
});
