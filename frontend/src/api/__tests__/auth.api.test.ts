import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../client";
import {
  register,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  logout,
} from "../auth.api";

vi.mock("../client", () => ({
  default: { post: vi.fn() },
}));

const mockPost = vi.mocked(client.post);
const MSG = { message: "ok" };

describe("auth.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("should POST /auth/register with correct payload", async () => {
      mockPost.mockResolvedValueOnce({ data: MSG });

      const payload = {
        email: "test@test.com",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        password: "Password1",
      };
      const result = await register(payload);

      expect(mockPost).toHaveBeenCalledWith("/auth/register", payload);
      expect(result).toEqual(MSG);
    });
  });

  describe("login", () => {
    it("should POST /auth/login with credentials", async () => {
      mockPost.mockResolvedValueOnce({ data: MSG });

      const result = await login({ username: "testuser", password: "Password1" });

      expect(mockPost).toHaveBeenCalledWith("/auth/login", {
        username: "testuser",
        password: "Password1",
      });
      expect(result).toEqual(MSG);
    });
  });

  describe("refresh", () => {
    it("should POST /auth/refresh with no body", async () => {
      mockPost.mockResolvedValueOnce({ data: MSG });

      const result = await refresh();

      expect(mockPost).toHaveBeenCalledWith("/auth/refresh");
      expect(result).toEqual(MSG);
    });
  });

  describe("forgotPassword", () => {
    it("should POST /auth/forgot-password with email", async () => {
      mockPost.mockResolvedValueOnce({ data: MSG });

      const result = await forgotPassword("test@test.com");

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", {
        email: "test@test.com",
      });
      expect(result).toEqual(MSG);
    });
  });

  describe("resetPassword", () => {
    it("should POST /auth/reset-password with token and password", async () => {
      mockPost.mockResolvedValueOnce({ data: MSG });

      const result = await resetPassword("tok123", "NewPass1");

      expect(mockPost).toHaveBeenCalledWith("/auth/reset-password", {
        token: "tok123",
        password: "NewPass1",
      });
      expect(result).toEqual(MSG);
    });
  });

  describe("logout", () => {
    it("should POST /auth/logout with no body", async () => {
      mockPost.mockResolvedValueOnce({ data: MSG });

      const result = await logout();

      expect(mockPost).toHaveBeenCalledWith("/auth/logout");
      expect(result).toEqual(MSG);
    });
  });
});
