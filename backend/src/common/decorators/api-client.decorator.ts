import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** `aud: hypertube-api` — set only on JWTs from `POST /oauth/token`. */
export const IsApiClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): boolean => {
    return ctx.switchToHttp().getRequest()?.isApiClient === true;
  },
);
