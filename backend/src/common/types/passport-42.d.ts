declare module "passport-42" {
  import { Strategy as PassportStrategy } from "passport";

  interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    profileFields?: Record<string, string>;
  }

  type VerifyCallback = (
    accessToken: string,
    refreshToken: string,
    profile: Record<string, unknown>,
    done: (error: Error | null, user?: unknown) => void,
  ) => void;

  class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyCallback);
  }
}
