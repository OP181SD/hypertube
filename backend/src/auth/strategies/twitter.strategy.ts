import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService, OAuthProfile } from "../auth.service";
import { AuthProvider } from "@prisma/client";
// On change l'import ici
import { Strategy } from "passport-twitter-oauth2";

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, "twitter") {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>("X_CLIENT_ID")!,
      clientSecret: configService.get<string>("X_CLIENT_SECRET")!,
      callbackURL: configService.get<string>("X_CALLBACK_URL")!,
      scope: ['users.read', 'tweet.read', 'offline.access'],
      state: false,
      // --- AJOUTE CES DEUX LIGNES ---
      authorizationURL: 'https://twitter.com/i/oauth2/authorize',
      tokenURL: 'https://api.twitter.com/2/oauth2/token',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any, // Le format du profil change légèrement en v2
    done: (err: unknown, user?: unknown) => void,
  ) {
    // Twitter OAuth 2.0 (API v2) renvoie souvent le profil dans profile._json.data
    const data = profile._json?.data || profile._json || {};
    
    const oauthProfile: OAuthProfile = {
      id: String(profile.id || data.id),
      username: profile.username || data.username || `twitter_${profile.id}`,
      // Attention: Twitter v2 ne renvoie pas l'email par défaut sauf autorisation spéciale
      email: profile.emails?.[0]?.value || "", 
      firstName: profile.displayName?.split(" ")[0] || "",
      lastName: profile.displayName?.split(" ").slice(1).join(" ") || "",
      profilePictureUrl: profile.photos?.[0]?.value || data.profile_image_url,
    };

    const user = await this.authService.validateOAuthUser(
      oauthProfile,
      AuthProvider.TWITTER,
    );

    done(null, user);
  }
}