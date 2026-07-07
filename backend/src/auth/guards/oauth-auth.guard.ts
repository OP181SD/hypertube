import { Injectable, ExecutionContext, mixin, Type } from "@nestjs/common";
import { AuthGuard, IAuthGuard } from "@nestjs/passport";

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
