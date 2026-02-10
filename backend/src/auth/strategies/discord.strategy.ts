import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService, OAuthProfile } from "../auth.service";
import { AuthProvider } from "@prisma/client";
import { Strategy, StrategyOptions } from "passport-discord";

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, "discord") {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const opts: StrategyOptions = {
      clientID: configService.get<string>("DISCORD_CLIENT_ID")!,
      clientSecret: configService.get<string>("DISCORD_CLIENT_SECRET")!,
      callbackURL: configService.get<string>("DISCORD_CALLBACK_URL")!,
      scope: ["identify", "email"],
    };
    super(opts);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Record<string, unknown>,
  ) {
    const email = profile.email as string | undefined;
    const username = profile.username as string;
    const discriminator = profile.discriminator as string;
    const avatar = profile.avatar as string | undefined;
    const id = String(profile.id);

    const avatarUrl = avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
      : undefined;

    const oauthProfile: OAuthProfile = {
      id,
      username: username || `discord_${id}`,
      email: email || "",
      firstName: username || "",
      lastName: discriminator !== "0" ? `#${discriminator}` : "",
      profilePictureUrl: avatarUrl,
    };

    return this.authService.validateOAuthUser(
      oauthProfile,
      AuthProvider.DISCORD,
    );
  }
}
