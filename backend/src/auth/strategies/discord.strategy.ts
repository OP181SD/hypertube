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
    profile: any, // Change en 'any' pour faciliter l'accès aux props dynamiques
  ) {
    const { username, discriminator, id, avatar, email } = profile;

    // 1. Sécurité : Discord ne renvoie pas toujours l'email (si non vérifié)
    if (!email) {
      throw new Error("No email provided from Discord. Please verify your email on Discord.");
    }

    const avatarUrl = avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
      : null; // Null est mieux que undefined pour Prisma

    // 2. Gestion des nouveaux pseudos Discord (discriminator "0")
    // Si pas de discriminator, on met un nom par défaut pour ne pas crash la DB
    const safeLastName = (discriminator && discriminator !== "0") 
      ? `#${discriminator}` 
      : "Discord"; 

    const oauthProfile: OAuthProfile = {
      id,
      username: username,
      email: email,
      firstName: username, // On utilise le pseudo comme prénom
      lastName: safeLastName, // "Discord" ou "#1234"
      profilePictureUrl: avatarUrl || undefined,
    };

    return this.authService.validateOAuthUser(
      oauthProfile,
      AuthProvider.DISCORD,
    );
  }
}
