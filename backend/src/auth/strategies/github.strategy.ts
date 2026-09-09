import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService, OAuthProfile } from "../auth.service";
import { AuthProvider } from "@prisma/client";
import { Strategy, StrategyOptions } from "passport-github2";

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const opts: StrategyOptions = {
      clientID: configService.get<string>("GITHUB_CLIENT_ID")!,
      clientSecret: configService.get<string>("GITHUB_CLIENT_SECRET")!,
      callbackURL: configService.get<string>("GITHUB_CALLBACK_URL")!,
      scope: ["user:email"],
    };
    super(opts);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Record<string, unknown>,
  ) {
    const emails = profile.emails as Array<{ value: string }>;
    const displayName = profile.displayName as string;
    const username = profile.username as string;
    const photos = profile.photos as Array<{ value: string }>;

    const nameParts = (displayName || "").split(" ");

    const oauthProfile: OAuthProfile = {
      id: String(profile.id),
      username: username || `github_${profile.id}`,
      email: emails?.[0]?.value || "",
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      profilePictureUrl: photos?.[0]?.value,
    };

    return this.authService.validateOAuthUser(
      oauthProfile,
      AuthProvider.GITHUB,
    );
  }
}
