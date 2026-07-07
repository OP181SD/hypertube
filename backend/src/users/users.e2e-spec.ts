import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestApp } from "../../test/helpers/app.helper";
import { cleanDatabase } from "../../test/helpers/prisma.helper";
import { registerUser } from "../../test/helpers/auth.helper";

describe("Users E2E", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("GET /users", () => {
    it("should return list of users with id and username only", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/users",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0]).toHaveProperty("id");
      expect(body[0]).toHaveProperty("username", "testuser");

      expect(body[0]).not.toHaveProperty("email");
      expect(body[0]).not.toHaveProperty("passwordHash");
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/users",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /users/:id", () => {
    it("should return own profile with email", async () => {
      const { tokens } = await registerUser(app);

      const listResponse = await app.inject({
        method: "GET",
        url: "/users",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      const users = JSON.parse(listResponse.body);

      const response = await app.inject({
        method: "GET",
        url: `/users/${users[0].id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe("test@example.com");
      expect(body.username).toBe("testuser");
      expect(body.firstName).toBe("Test");
      expect(body.lastName).toBe("User");
    });

    it("should return other user profile without email", async () => {

      await registerUser(app);
      const { tokens: tokens2 } = await registerUser(app, {
        email: "other@example.com",
        username: "otheruser",
      });

      const listResponse = await app.inject({
        method: "GET",
        url: "/users",
        headers: { authorization: `Bearer ${tokens2.access_token}` },
      });
      const users = JSON.parse(listResponse.body);
      const otherUser = users.find(
        (u: { username: string }) => u.username === "testuser",
      );

      const response = await app.inject({
        method: "GET",
        url: `/users/${otherUser.id}`,
        headers: { authorization: `Bearer ${tokens2.access_token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBeUndefined();
      expect(body.username).toBe("testuser");
    });

    it("should return 404 for nonexistent user", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/users/550e8400-e29b-41d4-a716-446655440099",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /users/:id", () => {
    it("should update own profile", async () => {
      const { tokens } = await registerUser(app);

      const listResponse = await app.inject({
        method: "GET",
        url: "/users",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      const users = JSON.parse(listResponse.body);

      const response = await app.inject({
        method: "PATCH",
        url: `/users/${users[0].id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: {
          firstName: "Updated",
          language: "FR",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.firstName).toBe("Updated");
      expect(body.language).toBe("FR");
    });

    it("should reject updating another user's profile", async () => {
      const { tokens: tokens1 } = await registerUser(app);
      await registerUser(app, {
        email: "other@example.com",
        username: "otheruser",
      });

      const listResponse = await app.inject({
        method: "GET",
        url: "/users",
        headers: { authorization: `Bearer ${tokens1.access_token}` },
      });
      const users = JSON.parse(listResponse.body);
      const otherUser = users.find(
        (u: { username: string }) => u.username === "otheruser",
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/users/${otherUser.id}`,
        headers: { authorization: `Bearer ${tokens1.access_token}` },
        payload: { firstName: "Hacked" },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject invalid update data", async () => {
      const { tokens } = await registerUser(app);

      const listResponse = await app.inject({
        method: "GET",
        url: "/users",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      const users = JSON.parse(listResponse.body);

      const response = await app.inject({
        method: "PATCH",
        url: `/users/${users[0].id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: {
          email: "not-valid-email",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
