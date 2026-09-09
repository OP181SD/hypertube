import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

export class SearchMoviesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  genre?: string;

  @IsOptional()
  @IsEnum(["movie", "series"])
  mediaType?: "movie" | "series";

  @IsOptional()
  @IsEnum(["title", "year", "rating", "seeds"])
  sortBy?: "title" | "year" | "rating" | "seeds";

  @IsOptional()
  @IsEnum(["asc", "desc"])
  order?: "asc" | "desc";

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  @Type(() => Number)
  minRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1888)
  @Type(() => Number)
  minYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1888)
  @Type(() => Number)
  maxYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

export class PopularMoviesDto {
  @IsOptional()
  @IsEnum(["movie", "series"])
  mediaType?: "movie" | "series";
}
