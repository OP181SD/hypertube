import { describe, it, expect, vi } from "vitest";

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: class MockPrismaClient {
      $connect = vi.fn();
      $disconnect = vi.fn();
    },
  };
});

vi.mock("pg", () => ({
  Pool: class MockPool {},
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class MockPrismaPg {},
}));

import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("should be defined", () => {
    const service = new PrismaService();
    expect(service).toBeDefined();
  });

  it("should have onModuleInit method", () => {
    const service = new PrismaService();
    expect(typeof service.onModuleInit).toBe("function");
  });

  it("should have onModuleDestroy method", () => {
    const service = new PrismaService();
    expect(typeof service.onModuleDestroy).toBe("function");
  });

  it("should call $connect on onModuleInit", async () => {
    const service = new PrismaService();
    await service.onModuleInit();
    expect(service.$connect).toHaveBeenCalled();
  });

  it("should call $disconnect on onModuleDestroy", async () => {
    const service = new PrismaService();
    await service.onModuleDestroy();
    expect(service.$disconnect).toHaveBeenCalled();
  });
});
