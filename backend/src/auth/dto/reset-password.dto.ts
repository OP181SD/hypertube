import { IsString, MinLength, Matches } from "class-validator";
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_PATTERN,
  PASSWORD_MIN,
} from "../../common/validation/user-fields";

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @Matches(PASSWORD_COMPLEXITY_PATTERN, {
    message: PASSWORD_COMPLEXITY_MESSAGE,
  })
  password!: string;
}
