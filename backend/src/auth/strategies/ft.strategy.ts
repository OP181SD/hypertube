import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService, OAuthProfile } from "../auth.service";
import { AuthProvider } from "@prisma/client";
import { Strategy as FortyTwoStrategy } from "passport-42";

@Injectable()
export class FtStrategy extends PassportStrategy(FortyTwoStrategy, "42") {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>("FT_CLIENT_ID")!,
      clientSecret: configService.get<string>("FT_CLIENT_SECRET")!,
      callbackURL: configService.get<string>("FT_CALLBACK_URL")!,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Record<string, unknown>,
  ) {
    const emails = profile.emails as Array<{ value: string }>;
    const name = profile.name as { givenName: string; familyName: string };
    const photos = profile.photos as Array<{ value: string }>;
    const username = profile.username as string;

    const oauthProfile: OAuthProfile = {
      id: String(profile.id),
      username: username || `ft_${profile.id}`,
      email: emails?.[0]?.value || "",
      firstName: name?.givenName || "",
      lastName: name?.familyName || "",
      profilePictureUrl: photos?.[0]?.value,
    };

    return this.authService.validateOAuthUser(
      oauthProfile,
      AuthProvider.FORTY_TWO,
    );
  }
}
