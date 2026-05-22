import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { AuthProvider } from "@prisma/client";
import { GoogleStrategy } from "./google.strategy";
import type { AuthService } from "../auth.service";

const mockConfig = {
  get: (key: string) =>
    key.includes("CALLBACK") ? "http://localhost:3000/cb" : "test-value",
} as unknown as ConfigService;

const mockAuthService = { validateOAuthUser: vi.fn() };

describe("GoogleStrategy", () => {
  let strategy: GoogleStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new GoogleStrategy(
      mockConfig,
      mockAuthService as unknown as AuthService,
    );
  });

  it("maps a Google profile and calls done with the resolved user", async () => {
    const user = { id: "u1" };
    mockAuthService.validateOAuthUser.mockResolvedValue(user);
    const done = vi.fn();

    await strategy.validate(
      "at",
      "rt",
      {
        id: "g-1",
        displayName: "John Doe",
        emails: [{ value: "john@gmail.com" }],
        name: { givenName: "John", familyName: "Doe" },
        photos: [{ value: "pic.jpg" }],
      },
      done,
    );

    expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith(
      {
        id: "g-1",
        username: "john_doe",
        email: "john@gmail.com",
        firstName: "John",
        lastName: "Doe",
        profilePictureUrl: "pic.jpg",
      },
      AuthProvider.GOOGLE,
    );
    expect(done).toHaveBeenCalledWith(null, user);
  });

  it("calls done with the error when validateOAuthUser rejects", async () => {
    const error = new Error("denied");
    mockAuthService.validateOAuthUser.mockRejectedValue(error);
    const done = vi.fn();

    await strategy.validate("at", "rt", { id: "g-2", displayName: "X" }, done);

    expect(done).toHaveBeenCalledWith(error, undefined);
  });

  it("generates a username fallback when displayName is absent", async () => {
    mockAuthService.validateOAuthUser.mockResolvedValue({ id: "u1" });
    const done = vi.fn();

    await strategy.validate("at", "rt", { id: "g-3" }, done);

    expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith(
      expect.objectContaining({ username: "google_g-3" }),
      AuthProvider.GOOGLE,
    );
  });
});
