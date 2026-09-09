import { IsString, MaxLength, Validate } from "class-validator";
import { Transform } from "class-transformer";
import { EMAIL_MAX, IsStrictEmailConstraint } from "../../common/validation/email";

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(EMAIL_MAX)
  @Validate(IsStrictEmailConstraint)
  email!: string;
}
