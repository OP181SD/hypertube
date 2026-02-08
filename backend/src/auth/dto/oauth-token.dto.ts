import { IsEnum, IsOptional, IsString } from "class-validator";

export enum GrantType {
  PASSWORD = "password",
  AUTHORIZATION_CODE = "authorization_code",
  REFRESH_TOKEN = "refresh_token",
}

export class OAuthTokenDto {
  @IsEnum(GrantType)
  grant_type!: GrantType;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  refresh_token?: string;

  @IsString()
  client_id!: string;

  @IsString()
  client_secret!: string;
}
