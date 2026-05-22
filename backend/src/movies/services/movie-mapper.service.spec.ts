import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, beforeEach } from "vitest";
import { MovieMapperService } from "./movie-mapper.service";

const baseMovie = {
  id: "m1",
  title: "The Matrix",
  imdbId: "tt0133093",
  year: 1999,
  imdbRating: 8.7,
  runtime: 136,
  summary: "A hacker discovers the true nature of reality.",
  posterUrl: "poster.jpg",
  backdropUrl: "backdrop.jpg",
  genres: ["Action", "Sci-Fi"],
  director: "The Wachowskis",
  producer: "Joel Silver",
  cast: ["Keanu Reeves", "Carrie-Anne Moss"],
};

describe("MovieMapperService", () => {
  let service: MovieMapperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MovieMapperService],
    }).compile();

    service = module.get<MovieMapperService>(MovieMapperService);
  });

  describe("toListItem", () => {
    it("maps a movie to a list item", () => {
      const item = service.toListItem(baseMovie as never, new Set(), new Set());

      expect(item).toEqual({
        id: "m1",
        title: "The Matrix",
        year: 1999,
        imdbRating: 8.7,
        posterUrl: "poster.jpg",
        backdropUrl: "backdrop.jpg",
        genres: ["Action", "Sci-Fi"],
        watched: false,
        inWatchlist: false,
      });
    });

    it("flags a movie present in the watched and watchlist sets", () => {
      const item = service.toListItem(
        baseMovie as never,
        new Set(["m1"]),
        new Set(["m1"]),
      );

      expect(item.watched).toBe(true);
      expect(item.inWatchlist).toBe(true);
    });

    it("does not flag a movie absent from the sets", () => {
      const item = service.toListItem(
        baseMovie as never,
        new Set(["other"]),
        new Set(["other"]),
      );

      expect(item.watched).toBe(false);
      expect(item.inWatchlist).toBe(false);
    });
  });

  describe("toDetail", () => {
    it("maps a movie with torrents to a detail object", () => {
      const movie = {
        ...baseMovie,
        torrents: [
          {
            id: "t1",
            quality: "1080p",
            seeds: 120,
            peers: 30,
            sizeBytes: 1_500_000_000n,
            magnetUrl: "magnet:?xt=urn:btih:abc",
          },
        ],
      };

      const detail = service.toDetail(movie as never, 5, true, false);

      expect(detail.id).toBe("m1");
      expect(detail.commentsCount).toBe(5);
      expect(detail.watched).toBe(true);
      expect(detail.inWatchlist).toBe(false);
      expect(detail.torrents).toEqual([
        {
          id: "t1",
          quality: "1080p",
          seeds: 120,
          peers: 30,
          sizeBytes: "1500000000",
          magnetUrl: "magnet:?xt=urn:btih:abc",
        },
      ]);
      expect(detail.subtitles).toEqual([]);
    });

    it("stringifies the torrent sizeBytes (BigInt) for JSON safety", () => {
      const movie = {
        ...baseMovie,
        torrents: [
          {
            id: "t1",
            quality: "720p",
            seeds: 1,
            peers: 0,
            sizeBytes: 800_000_000n,
            magnetUrl: "m",
          },
        ],
      };

      const detail = service.toDetail(movie as never, 0, false, false);

      expect(typeof detail.torrents[0].sizeBytes).toBe("string");
      expect(detail.torrents[0].sizeBytes).toBe("800000000");
    });

    it("includes the provided subtitles", () => {
      const movie = { ...baseMovie, torrents: [] };
      const subtitles = [{ lang: "en", label: "English" }];

      const detail = service.toDetail(movie as never, 0, false, false, subtitles);

      expect(detail.subtitles).toEqual(subtitles);
    });

    it("defaults to an empty subtitle list when none are given", () => {
      const movie = { ...baseMovie, torrents: [] };

      const detail = service.toDetail(movie as never, 2, false, true);

      expect(detail.subtitles).toEqual([]);
      expect(detail.inWatchlist).toBe(true);
    });
  });
});
