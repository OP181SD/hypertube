import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDbUser, mockDbUser2 } from "../../test/fixtures/users.fixture";

const mockUsersService = {
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
};

describe("UsersController", () => {
  let controller: UsersController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe("GET /users", () => {
    it("should return list of users with id and username", async () => {
      const expected = [
        { id: mockDbUser.id, username: mockDbUser.username },
        { id: mockDbUser2.id, username: mockDbUser2.username },
      ];
      mockUsersService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(result).toEqual(expected);
    });
  });

  describe("GET /users/:id", () => {
    it("should return user profile with email when viewing own profile", async () => {
      mockUsersService.findById.mockResolvedValue(mockDbUser);

      const result = await controller.findOne(mockDbUser.id, mockDbUser as any);

      expect(result.email).toBe(mockDbUser.email);
      expect(result.username).toBe(mockDbUser.username);
    });

    it("should return user profile without email when viewing other profile", async () => {
      mockUsersService.findById.mockResolvedValue(mockDbUser);

      const result = await controller.findOne(mockDbUser.id, mockDbUser2 as any);

      expect(result.email).toBeUndefined();
      expect(result.username).toBe(mockDbUser.username);
      expect(result.firstName).toBe(mockDbUser.firstName);
      expect(result.lastName).toBe(mockDbUser.lastName);
    });

    it("should throw NotFoundException if user not found", async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        controller.findOne("nonexistent", mockDbUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("PATCH /users/:id", () => {
    it("should update own profile", async () => {
      const updatedUser = { ...mockDbUser, firstName: "Updated" };
      mockUsersService.findById.mockResolvedValue(mockDbUser);
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update(
        mockDbUser.id,
        { firstName: "Updated" },
        mockDbUser as any,
      );

      expect(result.firstName).toBe("Updated");
    });

    it("should throw ForbiddenException when updating another user's profile", async () => {
      await expect(
        controller.update(
          mockDbUser.id,
          { firstName: "Hacker" },
          mockDbUser2 as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if user not found", async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        controller.update(
          mockDbUser.id,
          { firstName: "Updated" },
          mockDbUser as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
