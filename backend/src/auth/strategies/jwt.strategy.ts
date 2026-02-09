import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";
import { AuthService } from "../auth.service";
import { FastifyRequest } from "fastify";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {
    const opts: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter("access_token"),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_ACCESS_SECRET")!,
      passReqToCallback: true,
    };
    super(opts);
  }

  async validate(req: FastifyRequest, payload: { sub: string }) {
    // Extract token from header or query param for blacklist check
    const authHeader = req.headers.authorization;
    const token = authHeader
      ? authHeader.replace("Bearer ", "")
      : (req.query as Record<string, string>)?.access_token;

    if (token) {
      const isBlacklisted = await this.authService.isAccessTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException("Token has been revoked");
      }
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }
}
