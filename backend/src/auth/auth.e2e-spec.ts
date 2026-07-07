import { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { createTestApp } from "../../test/helpers/app.helper";
import {
  cleanDatabase,
  createOAuthClient,
} from "../../test/helpers/prisma.helper";
import { registerUser } from "../../test/helpers/auth.helper";

describe("Auth E2E", () => {
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

  describe("POST /auth/register", () => {
    it("should register a new user without opening a session", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "newuser@example.com",
          username: "newuser",
          firstName: "New",
          lastName: "User",
          password: "SecurePass123!",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.message).toBeDefined();
      expect(body.access_token).toBeUndefined();
    });

    it("should reject registration with duplicate email", async () => {

      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "dup@example.com",
          username: "user1",
          firstName: "Test",
          lastName: "User",
          password: "SecurePass123!",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "dup@example.com",
          username: "user2",
          firstName: "Test",
          lastName: "User",
          password: "SecurePass123!",
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it("should reject registration with duplicate username", async () => {

      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "first@example.com",
          username: "sameuser",
          firstName: "Test",
          lastName: "User",
          password: "SecurePass123!",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "second@example.com",
          username: "sameuser",
          firstName: "Test",
          lastName: "User",
          password: "SecurePass123!",
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it("should reject weak password", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "test@example.com",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          password: "weak",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "not-an-email",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          password: "SecurePass123!",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject extra/unexpected fields (whitelist)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "test@example.com",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          password: "SecurePass123!",
          isAdmin: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /oauth/token (password grant)", () => {
    it("should return tokens for valid credentials", async () => {
      await registerUser(app);
      await createOAuthClient();

      const response = await app.inject({
        method: "POST",
        url: "/oauth/token",
        payload: {
          grant_type: "password",
          username: "testuser",
          password: "SecurePass123!",
          client_id: "test-client",
          client_secret: "test-secret",
        },
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
    });

    it("should reject invalid credentials", async () => {
      await registerUser(app);
      await createOAuthClient();

      const response = await app.inject({
        method: "POST",
        url: "/oauth/token",
        payload: {
          grant_type: "password",
          username: "testuser",
          password: "WrongPassword123!",
          client_id: "test-client",
          client_secret: "test-secret",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject invalid client credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/oauth/token",
        payload: {
          grant_type: "password",
          username: "testuser",
          password: "SecurePass123!",
          client_id: "invalid",
          client_secret: "invalid",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /oauth/token (refresh_token grant)", () => {
    it("should return new tokens for valid refresh token", async () => {
      const { tokens } = await registerUser(app);
      await createOAuthClient();

      const response = await app.inject({
        method: "POST",
        url: "/oauth/token",
        payload: {
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: "test-client",
          client_secret: "test-secret",
        },
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).not.toBe(tokens.refresh_token);
    });

    it("should reject used (rotated) refresh token", async () => {
      const { tokens } = await registerUser(app);
      await createOAuthClient();

      await app.inject({
        method: "POST",
        url: "/oauth/token",
        payload: {
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: "test-client",
          client_secret: "test-secret",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/oauth/token",
        payload: {
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: "test-client",
          client_secret: "test-secret",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("should return 200 regardless of email existence", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: {
          email: "nonexistent@example.com",
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("POST /auth/logout", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/logout",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should logout authenticated user", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "POST",
        url: "/auth/logout",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
        payload: {
          refresh_token: tokens.refresh_token,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("Protected routes", () => {
    it("should reject unauthenticated requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/users",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should allow authenticated requests", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/users",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
