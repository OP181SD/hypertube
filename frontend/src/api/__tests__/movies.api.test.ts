import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../client";
import { searchMovies, getMovie } from "../movies.api";
import type { PaginatedMovies, MovieDetail } from "@/types/api";

vi.mock("../client", () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(client.get);

describe("movies.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchMovies", () => {
    it("should GET /movies with query params", async () => {
      const response: PaginatedMovies = {
        data: [
          {
            id: "1",
            title: "Batman",
            year: 2022,
            imdbRating: 8.0,
            posterUrl: "url",
            genres: ["Action"],
            watched: false,
          },
        ],
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasMore: true,
      };
      mockGet.mockResolvedValueOnce({ data: response });

      const result = await searchMovies({ query: "batman", page: 1 });

      expect(mockGet).toHaveBeenCalledWith("/movies", {
        params: { query: "batman", page: 1 },
      });
      expect(result).toEqual(response);
    });

    it("should pass all filter params", async () => {
      const response: PaginatedMovies = {
        data: [],
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasMore: false,
      };
      mockGet.mockResolvedValueOnce({ data: response });

      await searchMovies({
        genre: "Action",
        sortBy: "rating",
        order: "desc",
        minRating: 7,
        page: 2,
        limit: 10,
      });

      expect(mockGet).toHaveBeenCalledWith("/movies", {
        params: {
          genre: "Action",
          sortBy: "rating",
          order: "desc",
          minRating: 7,
          page: 2,
          limit: 10,
        },
      });
    });
  });

  describe("getMovie", () => {
    it("should GET /movies/:id and return MovieDetail", async () => {
      const movie: MovieDetail = {
        id: "uuid-1",
        title: "Batman Begins",
        imdbId: "tt0372784",
        year: 2005,
        imdbRating: 8.2,
        runtime: 140,
        summary: "A great movie",
        posterUrl: "https://poster.jpg",
        genres: ["Action"],
        producer: "Emma Thomas",
        director: "Christopher Nolan",
        cast: ["Christian Bale"],
        torrents: [],
        subtitles: [],
        commentsCount: 3,
        watched: false,
      };
      mockGet.mockResolvedValueOnce({ data: movie });

      const result = await getMovie("uuid-1");

      expect(mockGet).toHaveBeenCalledWith("/movies/uuid-1");
      expect(result).toEqual(movie);
    });
  });
});
