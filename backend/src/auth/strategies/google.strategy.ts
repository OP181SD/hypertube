import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService, OAuthProfile } from "../auth.service";
import { AuthProvider } from "@prisma/client";
import {
  Strategy,
  StrategyOptions,
  VerifyCallback,
} from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const opts: StrategyOptions = {
      clientID: configService.get<string>("GOOGLE_CLIENT_ID")!,
      clientSecret: configService.get<string>("GOOGLE_CLIENT_SECRET")!,
      callbackURL: configService.get<string>("GOOGLE_CALLBACK_URL")!,
      scope: ["email", "profile"],
    };
    super(opts);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Record<string, unknown>,
    done: VerifyCallback,
  ) {
    const emails = profile.emails as Array<{ value: string }>;
    const name = profile.name as { givenName: string; familyName: string };
    const photos = profile.photos as Array<{ value: string }>;
    const displayName = profile.displayName as string;

    const oauthProfile: OAuthProfile = {
      id: String(profile.id),
      username:
        displayName?.replace(/\s+/g, "_").toLowerCase() ||
        `google_${profile.id}`,
      email: emails?.[0]?.value || "",
      firstName: name?.givenName || "",
      lastName: name?.familyName || "",
      profilePictureUrl: photos?.[0]?.value,
    };

    const user = await this.authService.validateOAuthUser(
      oauthProfile,
      AuthProvider.GOOGLE,
    );

    done(null, user);
  }
}
