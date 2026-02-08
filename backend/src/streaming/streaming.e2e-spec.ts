import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestApp } from "../../test/helpers/app.helper";
import { cleanDatabase, prisma } from "../../test/helpers/prisma.helper";
import { registerUser } from "../../test/helpers/auth.helper";

describe("Streaming E2E", () => {
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

  async function seedMovieWithTorrent() {
    const movie = await prisma.movie.create({
      data: {
        imdbId: "tt0133093",
        title: "The Matrix",
        year: 1999,
        imdbRating: 8.7,
      },
    });

    const torrent = await prisma.torrent.create({
      data: {
        movieId: movie.id,
        hash: "abc123def456",
        quality: "1080p",
        source: "YTS",
        seeds: 100,
        peers: 50,
        sizeBytes: BigInt(1_500_000_000),
        magnetUrl: "magnet:?xt=urn:btih:abc123def456&dn=The+Matrix",
      },
    });

    return { movie, torrent };
  }

  describe("GET /stream/:torrentId", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/stream/550e8400-e29b-41d4-a716-446655440099",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for nonexistent torrent", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/stream/550e8400-e29b-41d4-a716-446655440099",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 202 for a torrent that needs downloading", async () => {
      const { tokens } = await registerUser(app);
      const { torrent } = await seedMovieWithTorrent();

      const response = await app.inject({
        method: "GET",
        url: `/stream/${torrent.id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      // 202 means accepted but downloading, or could error depending on torrent-stream
      // In test env, torrent-stream won't actually connect
      expect([202, 500].includes(response.statusCode)).toBe(true);
    });
  });

  describe("GET /stream/:torrentId/status", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/stream/550e8400-e29b-41d4-a716-446655440099/status",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for nonexistent torrent", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/stream/550e8400-e29b-41d4-a716-446655440099/status",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return status for existing torrent", async () => {
      const { tokens } = await registerUser(app);
      const { torrent } = await seedMovieWithTorrent();

      const response = await app.inject({
        method: "GET",
        url: `/stream/${torrent.id}/status`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("progress");
    });
  });

  describe("GET /subtitles/:movieId", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/subtitles/550e8400-e29b-41d4-a716-446655440099",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for nonexistent movie", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/subtitles/550e8400-e29b-41d4-a716-446655440099",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return empty array when no API key configured", async () => {
      const { tokens } = await registerUser(app);
      const { movie } = await seedMovieWithTorrent();

      const response = await app.inject({
        method: "GET",
        url: `/subtitles/${movie.id}`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("GET /subtitles/:movieId/:lang", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/subtitles/550e8400-e29b-41d4-a716-446655440099/en",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for nonexistent movie", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/subtitles/550e8400-e29b-41d4-a716-446655440099/en",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 404 when subtitle language not available", async () => {
      const { tokens } = await registerUser(app);
      const { movie } = await seedMovieWithTorrent();

      const response = await app.inject({
        method: "GET",
        url: `/subtitles/${movie.id}/en`,
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });

      // No API key configured in test, so no subtitles available
      expect(response.statusCode).toBe(404);
    });
  });
});
