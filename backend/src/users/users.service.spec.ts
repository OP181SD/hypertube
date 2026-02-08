import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthProvider, Language } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDbUser, mockDbUser2 } from "../../test/fixtures/users.fixture";

// Mock argon2
vi.mock("argon2", () => ({
  hash: vi.fn().mockResolvedValue("$argon2id$hashed"),
  verify: vi.fn().mockResolvedValue(true),
}));

const mockPrismaService = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe("findAll", () => {
    it("should return list of users with id and username only", async () => {
      const expected = [
        { id: mockDbUser.id, username: mockDbUser.username },
        { id: mockDbUser2.id, username: mockDbUser2.username },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(result).toEqual(expected);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        select: { id: true, username: true },
      });
    });
  });

  describe("findById", () => {
    it("should return a user by id", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockDbUser);

      const result = await service.findById(mockDbUser.id);

      expect(result).toEqual(mockDbUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockDbUser.id },
      });
    });

    it("should return null if user not found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUsername", () => {
    it("should return a user by username", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockDbUser);

      const result = await service.findByUsername(mockDbUser.username);

      expect(result).toEqual(mockDbUser);
    });
  });

  describe("findByEmail", () => {
    it("should return a user by email", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockDbUser);

      const result = await service.findByEmail(mockDbUser.email);

      expect(result).toEqual(mockDbUser);
    });
  });

  describe("findByProviderId", () => {
    it("should return a user by provider and providerId", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockDbUser);

      const result = await service.findByProviderId(
        AuthProvider.FORTY_TWO,
        "12345",
      );

      expect(result).toEqual(mockDbUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          authProvider: AuthProvider.FORTY_TWO,
          providerId: "12345",
        },
      });
    });
  });

  describe("create", () => {
    it("should create a user with hashed password", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockDbUser);

      const result = await service.create({
        email: "test@example.com",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        password: "SecurePass123!",
      });

      expect(result).toEqual(mockDbUser);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "test@example.com",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          passwordHash: "$argon2id$hashed",
          authProvider: AuthProvider.LOCAL,
        }),
      });
    });

    it("should throw ConflictException for duplicate email", async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockDbUser);

      await expect(
        service.create({
          email: "test@example.com",
          username: "newuser",
          firstName: "New",
          lastName: "User",
          password: "SecurePass123!",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException for duplicate username", async () => {
      // First call (findByEmail) returns null, second (findByUsername) returns existing
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(mockDbUser); // username check

      await expect(
        service.create({
          email: "new@example.com",
          username: "testuser",
          firstName: "New",
          lastName: "User",
          password: "SecurePass123!",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should create OAuth user without password", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const oauthUser = { ...mockDbUser, passwordHash: null };
      mockPrismaService.user.create.mockResolvedValue(oauthUser);

      const result = await service.create({
        email: "oauth@example.com",
        username: "oauthuser",
        firstName: "OAuth",
        lastName: "User",
        authProvider: AuthProvider.FORTY_TWO,
        providerId: "12345",
      });

      expect(result.passwordHash).toBeNull();
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          passwordHash: null,
          authProvider: AuthProvider.FORTY_TWO,
          providerId: "12345",
        }),
      });
    });
  });

  describe("update", () => {
    it("should update user fields", async () => {
      const updatedUser = { ...mockDbUser, firstName: "Updated" };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockDbUser.id, {
        firstName: "Updated",
      });

      expect(result.firstName).toBe("Updated");
    });

    it("should hash password when updating", async () => {
      mockPrismaService.user.update.mockResolvedValue(mockDbUser);

      await service.update(mockDbUser.id, {
        password: "NewSecurePass123!",
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockDbUser.id },
        data: expect.objectContaining({
          passwordHash: "$argon2id$hashed",
        }),
      });
    });

    it("should throw ConflictException if email is taken by another user", async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce(mockDbUser2);

      await expect(
        service.update(mockDbUser.id, {
          email: mockDbUser2.email,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException if username is taken by another user", async () => {
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(null) // email check passes
        .mockResolvedValueOnce(mockDbUser2); // username check fails

      await expect(
        service.update(mockDbUser.id, {
          email: "newemail@example.com",
          username: mockDbUser2.username,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should update language preference", async () => {
      const updatedUser = { ...mockDbUser, language: Language.FR };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockDbUser.id, {
        language: Language.FR,
      });

      expect(result.language).toBe(Language.FR);
    });
  });
});
