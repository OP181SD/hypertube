import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  Validate,
} from "class-validator";
import { Transform } from "class-transformer";
import { EMAIL_MAX, IsStrictEmailConstraint } from "../../common/validation/email";
import {
  FIRST_NAME_MESSAGE,
  LAST_NAME_MESSAGE,
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_PATTERN,
  PASSWORD_MIN,
  PERSON_NAME_MAX,
  PERSON_NAME_MIN,
  PERSON_NAME_PATTERN,
  USERNAME_MAX,
  USERNAME_MESSAGE,
  USERNAME_MIN,
  USERNAME_PATTERN,
} from "../../common/validation/user-fields";

export class RegisterDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(EMAIL_MAX)
  @Validate(IsStrictEmailConstraint)
  email!: string;

  @IsString()
  @MinLength(USERNAME_MIN)
  @MaxLength(USERNAME_MAX)
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username!: string;

  @IsString()
  @MinLength(PERSON_NAME_MIN)
  @MaxLength(PERSON_NAME_MAX)
  @Matches(PERSON_NAME_PATTERN, { message: FIRST_NAME_MESSAGE })
  firstName!: string;

  @IsString()
  @MinLength(PERSON_NAME_MIN)
  @MaxLength(PERSON_NAME_MAX)
  @Matches(PERSON_NAME_PATTERN, { message: LAST_NAME_MESSAGE })
  lastName!: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @Matches(PASSWORD_COMPLEXITY_PATTERN, {
    message: PASSWORD_COMPLEXITY_MESSAGE,
  })
  password!: string;
}
