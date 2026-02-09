import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService, OAuthProfile } from "../auth.service";
import { AuthProvider } from "@prisma/client";
import { Strategy, StrategyOptions } from "passport-facebook";

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, "facebook") {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const opts: StrategyOptions = {
      clientID: configService.get<string>("FACEBOOK_CLIENT_ID")!,
      clientSecret: configService.get<string>("FACEBOOK_CLIENT_SECRET")!,
      callbackURL: configService.get<string>("FACEBOOK_CALLBACK_URL")!,
      profileFields: ["id", "emails", "name", "displayName", "photos"],
      scope: ["email"],
    };
    super(opts);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Record<string, unknown>,
    done: (err: unknown, user?: unknown) => void,
  ) {
    const emails = profile.emails as Array<{ value: string }> | undefined;
    const name = profile.name as
      | { givenName: string; familyName: string }
      | undefined;
    const photos = profile.photos as Array<{ value: string }> | undefined;
    const displayName = profile.displayName as string;

    const oauthProfile: OAuthProfile = {
      id: String(profile.id),
      username:
        displayName?.replace(/\s+/g, "_").toLowerCase() ||
        `facebook_${profile.id}`,
      email: emails?.[0]?.value || "",
      firstName: name?.givenName || "",
      lastName: name?.familyName || "",
      profilePictureUrl: photos?.[0]?.value,
    };

    const user = await this.authService.validateOAuthUser(
      oauthProfile,
      AuthProvider.FACEBOOK,
    );

    done(null, user);
  }
}
