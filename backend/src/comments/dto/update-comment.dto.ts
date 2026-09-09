import { Expose, Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** `content` or `comment`. `username` ignored. */
export class UpdateCommentDto {
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

  @IsOptional()
  @IsString()
  username?: string;
}
