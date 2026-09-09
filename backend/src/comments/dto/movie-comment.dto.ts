import { Expose, Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** `content` or `comment`. */
export class MovieCommentDto {
  @Expose()
  @Transform(({ obj }) => obj.content ?? obj.comment)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  comment?: string;
}
