import { IsString, MinLength, MaxLength } from "class-validator";

export class MovieCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
