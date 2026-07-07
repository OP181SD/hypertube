import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestApp } from "../../test/helpers/app.helper";
import { cleanDatabase, prisma } from "../../test/helpers/prisma.helper";
import { registerUser } from "../../test/helpers/auth.helper";

describe("Comments E2E", () => {
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

  async function seedMovie() {
    return prisma.movie.create({
      data: {
        imdbId: "tt0133093",
        title: "The Matrix",
        year: 1999,
        imdbRating: 8.7,
      },
    });
  }

  describe("POST /comments", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { movieId: "550e8400-e29b-41d4-a716-446655440099", content: "test" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should create a comment", async () => {
      const { tokens } = await registerUser(app);
      const movie = await seedMovie();

      const response = await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { movieId: movie.id, content: "Great movie!" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.content).toBe("Great movie!");
      expect(body.movieId).toBe(movie.id);
      expect(body.author).toHaveProperty("id");
      expect(body.author).toHaveProperty("username", "testuser");
    });

    it("should reject comment on nonexistent movie", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: {
          movieId: "550e8400-e29b-41d4-a716-446655440099",
          content: "test",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should reject empty content", async () => {
      const { tokens } = await registerUser(app);
      const movie = await seedMovie();

      const response = await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { movieId: movie.id, content: "" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /movies/:movie_id/comments", () => {
    it("should create a comment on a movie", async () => {
      const { tokens } = await registerUser(app);
      const movie = await seedMovie();

      const response = await app.inject({
        method: "POST",
        url: `/movies/${movie.id}/comments`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { content: "Awesome!" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.content).toBe("Awesome!");
      expect(body.movieId).toBe(movie.id);
    });
  });

  describe("GET /comments", () => {
    it("should return all comments", async () => {
      const { tokens } = await registerUser(app);
      const movie = await seedMovie();

      await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { movieId: movie.id, content: "Great!" },
      });

      const response = await app.inject({
        method: "GET",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].content).toBe("Great!");
      expect(body[0].author.username).toBe("testuser");
    });

    it("should filter by movieId", async () => {
      const { tokens } = await registerUser(app);
      const movie1 = await seedMovie();
      const movie2 = await prisma.movie.create({
        data: { imdbId: "tt9999999", title: "Other Movie" },
      });

      await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { movieId: movie1.id, content: "Comment 1" },
      });
      await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { movieId: movie2.id, content: "Comment 2" },
      });

      const response = await app.inject({
        method: "GET",
        url: `/comments?movieId=${movie1.id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
      expect(body[0].content).toBe("Comment 1");
    });
  });

  describe("GET /comments/:id", () => {
    it("should return a single comment", async () => {
      const { tokens } = await registerUser(app);
      const movie = await seedMovie();

      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { movieId: movie.id, content: "Nice!" },
      });
      const created = JSON.parse(createRes.body);

      const response = await app.inject({
        method: "GET",
        url: `/comments/${created.id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.content).toBe("Nice!");
    });

    it("should return 404 for nonexistent comment", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/comments/550e8400-e29b-41d4-a716-446655440099",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /comments/:id", () => {
    it("should update own comment", async () => {
      const { tokens } = await registerUser(app);
      const movie = await seedMovie();

      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { movieId: movie.id, content: "Original" },
      });
      const created = JSON.parse(createRes.body);

      const response = await app.inject({
        method: "PATCH",
        url: `/comments/${created.id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { content: "Updated!" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.content).toBe("Updated!");
    });

    it("should reject updating another user's comment", async () => {
      const { tokens: tokens1 } = await registerUser(app);
      const { tokens: tokens2 } = await registerUser(app, {
        email: "other@example.com",
        username: "otheruser",
      });
      const movie = await seedMovie();

      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens1.access_token}` },
        payload: { movieId: movie.id, content: "My comment" },
      });
      const created = JSON.parse(createRes.body);

      const response = await app.inject({
        method: "PATCH",
        url: `/comments/${created.id}`,
        headers: { authorization: `Bearer ${tokens2.access_token}` },
        payload: { content: "Hacked!" },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /comments/:id", () => {
    it("should delete own comment", async () => {
      const { tokens } = await registerUser(app);
      const movie = await seedMovie();

      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens.access_token}` },
        payload: { movieId: movie.id, content: "To delete" },
      });
      const created = JSON.parse(createRes.body);

      const response = await app.inject({
        method: "DELETE",
        url: `/comments/${created.id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(204);

      const getRes = await app.inject({
        method: "GET",
        url: `/comments/${created.id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it("should reject deleting another user's comment", async () => {
      const { tokens: tokens1 } = await registerUser(app);
      const { tokens: tokens2 } = await registerUser(app, {
        email: "other@example.com",
        username: "otheruser",
      });
      const movie = await seedMovie();

      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        headers: { authorization: `Bearer ${tokens1.access_token}` },
        payload: { movieId: movie.id, content: "Protected" },
      });
      const created = JSON.parse(createRes.body);

      const response = await app.inject({
        method: "DELETE",
        url: `/comments/${created.id}`,
        headers: { authorization: `Bearer ${tokens2.access_token}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
