import { Injectable, ExecutionContext, mixin, Type } from "@nestjs/common";
import { AuthGuard, IAuthGuard } from "@nestjs/passport";

/**
 * Builds a Passport AuthGuard for the given strategy, with a Fastify shim:
 * Passport expects Express-style res.setHeader/res.end, so we bridge them to
 * Fastify's equivalents. All OAuth providers share the exact same behaviour,
 * so the named guards below are produced from this single factory.
 */
function createOAuthGuard(strategy: string): Type<IAuthGuard> {
  @Injectable()
  class OAuthGuard extends AuthGuard(strategy) {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const response = context.switchToHttp().getResponse();

      if (!response.setHeader) {
        response.setHeader = (key: string, value: unknown) =>
          response.header(key, value);
      }
      if (!response.end) {
        response.end = (chunk: unknown) => response.send(chunk);
      }

      return (await super.canActivate(context)) as boolean;
    }
  }

  return mixin(OAuthGuard);
}

export const FtAuthGuard = createOAuthGuard("42");
export const GoogleAuthGuard = createOAuthGuard("google");
export const GithubAuthGuard = createOAuthGuard("github");
export const DiscordAuthGuard = createOAuthGuard("discord");
