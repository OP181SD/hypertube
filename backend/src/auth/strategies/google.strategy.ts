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
    const googleId = configService.get<string>("GOOGLE_CLIENT_ID");
    const callback = configService.get<string>("GOOGLE_CALLBACK_URL");
    
    console.log("--- DEBUG [GoogleStrategy] --- ID:", googleId ? "OK" : "MISSING");
    console.log("--- DEBUG [GoogleStrategy] --- Callback URL:", callback);

    const opts: StrategyOptions = {
      clientID: googleId!,
      clientSecret: configService.get<string>("GOOGLE_CLIENT_SECRET")!,
      callbackURL: callback!,
      scope: ["email", "profile"],
    };
    super(opts);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any, // On met any temporairement pour le log complet
    done: VerifyCallback,
  ) {
    console.log("--- DEBUG [GoogleStrategy] --- profile reçu:", JSON.stringify(profile, null, 2));
    
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

    try {
      const user = await this.authService.validateOAuthUser(
        oauthProfile,
        AuthProvider.GOOGLE,
      );
      done(null, user);
    } catch (error) {
      console.error("--- ERROR [GoogleStrategy] ---", error);
      done(error, undefined);
    }
  }
}
