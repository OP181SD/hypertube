import { Expose, Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

/** `movieId`/`content` or `movie_id`/`comment`. */
export class CreateCommentDto {
  @Expose()
  @Transform(({ obj }) => obj.movieId ?? obj.movie_id)
  @IsUUID()
  movieId!: string;

  /** Alias of `movieId`. */
  @IsOptional()
  @IsUUID()
  movie_id?: string;

  @Expose()
  @Transform(({ obj }) => obj.content ?? obj.comment)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  /** Alias of `content`. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  comment?: string;
}
