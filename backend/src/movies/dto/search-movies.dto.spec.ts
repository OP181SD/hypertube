import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { SearchMoviesDto } from "./search-movies.dto";

function validateDto(input: Record<string, unknown>) {
  return validate(plainToInstance(SearchMoviesDto, input));
}

describe("SearchMoviesDto", () => {
  it("accepts an empty payload — every field is optional", async () => {
    expect(await validateDto({})).toHaveLength(0);
  });

  it("accepts a fully valid payload (query-string values as strings)", async () => {
    const errors = await validateDto({
      query: "matrix",
      genre: "Action",
      sortBy: "rating",
      order: "desc",
      minRating: "8.5",
      minYear: "1990",
      maxYear: "2010",
      page: "2",
      limit: "20",
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects a query longer than 100 characters", async () => {
    const errors = await validateDto({ query: "x".repeat(101) });
    expect(errors[0]?.property).toBe("query");
  });

  it("rejects an unknown sortBy value", async () => {
    const errors = await validateDto({ sortBy: "popularity" });
    expect(errors[0]?.property).toBe("sortBy");
  });

  it("rejects an order other than asc/desc", async () => {
    const errors = await validateDto({ order: "sideways" });
    expect(errors[0]?.property).toBe("order");
  });

  it("rejects a minRating above 10", async () => {
    const errors = await validateDto({ minRating: "11" });
    expect(errors[0]?.property).toBe("minRating");
  });

  it("rejects a minRating below 0", async () => {
    const errors = await validateDto({ minRating: "-1" });
    expect(errors[0]?.property).toBe("minRating");
  });

  it("rejects a year before cinema existed (< 1888)", async () => {
    const errors = await validateDto({ minYear: "1800" });
    expect(errors[0]?.property).toBe("minYear");
  });

  it("rejects a page below 1", async () => {
    const errors = await validateDto({ page: "0" });
    expect(errors[0]?.property).toBe("page");
  });

  it("rejects a limit above 50", async () => {
    const errors = await validateDto({ limit: "100" });
    expect(errors[0]?.property).toBe("limit");
  });
});
