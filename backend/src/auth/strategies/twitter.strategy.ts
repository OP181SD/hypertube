import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService, OAuthProfile } from "../auth.service";
import { AuthProvider } from "@prisma/client";
import { Strategy, IStrategyOption } from "passport-twitter";

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, "twitter") {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const opts: IStrategyOption = {
      consumerKey: configService.get<string>("TWITTER_CONSUMER_KEY")!,
      consumerSecret: configService.get<string>("TWITTER_CONSUMER_SECRET")!,
      callbackURL: configService.get<string>("TWITTER_CALLBACK_URL")!,
      includeEmail: true,
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
    const displayName = profile.displayName as string;
    const username = profile.username as string;
    const photos = profile.photos as Array<{ value: string }> | undefined;

    const nameParts = (displayName || "").split(" ");

    const oauthProfile: OAuthProfile = {
      id: String(profile.id),
      username: username || `twitter_${profile.id}`,
      email: emails?.[0]?.value || "",
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      profilePictureUrl: photos?.[0]?.value,
    };

    const user = await this.authService.validateOAuthUser(
      oauthProfile,
      AuthProvider.TWITTER,
    );

    done(null, user);
  }
}
