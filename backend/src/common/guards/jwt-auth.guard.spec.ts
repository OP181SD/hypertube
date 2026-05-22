import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";

function mockContext(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

// super.canActivate() lives on the AuthGuard("jwt") prototype that JwtAuthGuard extends.
const parentCanActivate = vi.spyOn(
  Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: unknown },
  "canActivate",
);

describe("JwtAuthGuard", () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    reflector = { getAllAndOverride: vi.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it("allows a public route even when authentication fails", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    parentCanActivate.mockRejectedValue(new Error("no token"));

    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });

  it("allows a public route when authentication succeeds", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    parentCanActivate.mockResolvedValue(true);

    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
    expect(parentCanActivate).toHaveBeenCalled();
  });

  it("delegates to passport for a protected route", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    parentCanActivate.mockResolvedValue(true);

    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
    expect(parentCanActivate).toHaveBeenCalled();
  });

  it("rejects a protected route when passport authentication fails", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    parentCanActivate.mockRejectedValue(new Error("Unauthorized"));

    await expect(guard.canActivate(mockContext())).rejects.toThrow(
      "Unauthorized",
    );
  });
});
