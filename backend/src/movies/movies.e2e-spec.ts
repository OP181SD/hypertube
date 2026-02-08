import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestApp } from "../../test/helpers/app.helper";
import { cleanDatabase, prisma } from "../../test/helpers/prisma.helper";
import { registerUser } from "../../test/helpers/auth.helper";

describe("Movies E2E", () => {
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

  describe("GET /movies", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/movies",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return paginated response structure", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/movies?query=matrix&limit=5",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("page");
      expect(body).toHaveProperty("limit");
      expect(body).toHaveProperty("total");
      expect(body).toHaveProperty("totalPages");
      expect(body).toHaveProperty("hasMore");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should return movies with correct fields", async () => {
      const { tokens } = await registerUser(app);

      // Seed a movie directly
      await prisma.movie.create({
        data: {
          imdbId: "tt0133093",
          title: "The Matrix",
          year: 1999,
          imdbRating: 8.7,
          posterUrl: "https://example.com/poster.jpg",
          genres: ["Action", "Sci-Fi"],
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/movies?query=matrix",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      const movie = body.data.find(
        (m: { imdbRating: number }) => m.imdbRating === 8.7,
      );
      if (movie) {
        expect(movie).toHaveProperty("id");
        expect(movie).toHaveProperty("title", "The Matrix");
        expect(movie).toHaveProperty("year", 1999);
        expect(movie).toHaveProperty("imdbRating", 8.7);
        expect(movie).toHaveProperty("posterUrl");
        expect(movie).toHaveProperty("genres");
        expect(movie).toHaveProperty("watched", false);
      }
    });

    it("should validate query parameters", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/movies?limit=0",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid sortBy value", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/movies?sortBy=invalid",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should filter by genre from seeded data", async () => {
      const { tokens } = await registerUser(app);

      await prisma.movie.createMany({
        data: [
          {
            imdbId: "tt0001111",
            title: "Action Movie",
            year: 2020,
            genres: ["Action"],
          },
          {
            imdbId: "tt0002222",
            title: "Comedy Movie",
            year: 2020,
            genres: ["Comedy"],
          },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: "/movies?genre=Comedy",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // At minimum, DB-seeded Comedy movie should appear
      const comedyMovies = body.data.filter(
        (m: { title: string }) => m.title === "Comedy Movie",
      );
      expect(comedyMovies.length).toBe(1);
    });
  });

  describe("GET /movies/:id", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/movies/550e8400-e29b-41d4-a716-446655440099",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for nonexistent movie", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/movies/550e8400-e29b-41d4-a716-446655440099",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return movie detail with torrents and comment count", async () => {
      const { tokens } = await registerUser(app);

      const movie = await prisma.movie.create({
        data: {
          imdbId: "tt0133093",
          title: "The Matrix",
          year: 1999,
          imdbRating: 8.7,
          runtime: 136,
          summary: "A computer hacker learns about reality.",
          posterUrl: "https://example.com/poster.jpg",
          genres: ["Action", "Sci-Fi"],
          director: "Lana Wachowski",
          cast: ["Keanu Reeves", "Laurence Fishburne"],
          tmdbId: 603,
          torrents: {
            create: {
              hash: "TESTHASH123456789ABCDEF012345678",
              quality: "1080p",
              source: "YTS",
              seeds: 150,
              peers: 25,
              sizeBytes: BigInt(2684354560),
              magnetUrl: "magnet:?xt=urn:btih:TESTHASH123",
            },
          },
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/movies/${movie.id}`,
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("The Matrix");
      expect(body.imdbId).toBe("tt0133093");
      expect(body.year).toBe(1999);
      expect(body.imdbRating).toBe(8.7);
      expect(body.runtime).toBe(136);
      expect(body.summary).toBe("A computer hacker learns about reality.");
      expect(body.director).toBe("Lana Wachowski");
      expect(body.cast).toEqual(["Keanu Reeves", "Laurence Fishburne"]);
      expect(body.torrents).toHaveLength(1);
      expect(body.torrents[0].quality).toBe("1080p");
      expect(body.torrents[0].seeds).toBe(150);
      expect(body.commentsCount).toBe(0);
      expect(body.watched).toBe(false);
    });

    it("should return 400 for invalid UUID", async () => {
      const { tokens } = await registerUser(app);

      const response = await app.inject({
        method: "GET",
        url: "/movies/not-a-uuid",
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
