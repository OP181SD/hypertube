import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import type { TokenPair } from "./auth.service";
import { ConfigService } from "@nestjs/config";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { ERROR_MESSAGES } from "../common/constants/error-messages";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { OAuthTokenDto, GrantType } from "./dto/oauth-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { FtAuthGuard } from "./guards/ft-auth.guard";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { GithubAuthGuard } from "./guards/github-auth.guard";
import { DiscordAuthGuard } from "./guards/discord-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "@prisma/client";

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setCookies(res: FastifyReply, tokens: TokenPair): void {
    const isProd = this.configService.get<string>("NODE_ENV") === "production";
    res.setCookie("access_token", tokens.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    });
    res.setCookie("refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });
    // Readable from JS to avoid a blind /users/me call when not logged in
    res.setCookie("has_session", "1", {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("auth/login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const user = await this.authService.validateLocalUser(dto.username, dto.password);
    const tokens = await this.authService.generateTokens(user.id);
    this.setCookies(res, tokens);
    return { message: "Logged in successfully" };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("oauth/token")
  @HttpCode(HttpStatus.OK)
  async token(@Body() dto: OAuthTokenDto) {
    const isValidClient = await this.authService.validateOAuthClient(
      dto.client_id,
      dto.client_secret,
    );

    if (!isValidClient) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CLIENT_CREDENTIALS);
    }

    switch (dto.grant_type) {
      case GrantType.PASSWORD: {
        if (!dto.username || !dto.password) {
          throw new BadRequestException(
            ERROR_MESSAGES.PASSWORD_GRANT_FIELDS_REQUIRED,
          );
        }
        const user = await this.authService.validateLocalUser(
          dto.username,
          dto.password,
        );
        return this.authService.generateTokens(user.id);
      }

      case GrantType.REFRESH_TOKEN: {
        if (!dto.refresh_token) {
          throw new BadRequestException(
            ERROR_MESSAGES.REFRESH_GRANT_FIELD_REQUIRED,
          );
        }
        return this.authService.refreshTokens(dto.refresh_token);
      }

      default:
        throw new BadRequestException(ERROR_MESSAGES.UNSUPPORTED_GRANT_TYPE);
    }
  }

  @Public()
  @Post("auth/register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    await this.authService.register(dto);
    return { message: "Registration successful. Please check your email to verify your account." };
  }

  @Public()
  @Post("auth/verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const tokens = await this.authService.verifyEmail(dto.token);
    this.setCookies(res, tokens);
    return { message: "Email verified successfully" };
  }

  @Public()
  @Post("auth/resend-verification")
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto.email);
    return { message: "If the email exists and is unverified, a new verification link has been sent" };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Post("auth/forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: "If the email exists, a reset link has been sent" };
  }

  @Public()
  @Post("auth/reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: "Password has been reset successfully" };
  }

  @Public()
  @Post("auth/refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const rt = (req.cookies as Record<string, string>)?.refresh_token;
    if (!rt) {
      throw new UnauthorizedException(ERROR_MESSAGES.NO_REFRESH_TOKEN);
    }
    const tokens = await this.authService.refreshTokens(rt);
    this.setCookies(res, tokens);
    return { message: "Tokens refreshed" };
  }

  @Post("auth/logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const rt = (req.cookies as Record<string, string>)?.refresh_token;
    await this.authService.logout(user.id, rt);
    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/" });
    res.clearCookie("has_session", { path: "/" });
    return { message: "Logged out successfully" };
  }

  // --- HELPER REDIRECTION ---
  private async handleOAuthRedirect(req: FastifyRequest, res: FastifyReply) {
    const user = req.user as User;
    const frontendUrl = this.configService.get<string>("FRONTEND_URL")!;

    if (!user) {
      return res.status(302).redirect(`${frontendUrl}/login?error=auth_failed`);
    }

    try {
      const tokens = await this.authService.generateTokens(user.id);
      this.setCookies(res, tokens);
      return res.status(302).redirect(`${frontendUrl}/auth/callback`);
    } catch (err) {
      this.logger.error(`OAuth redirect failed for user ${user.id}: ${err}`);
      return res.status(500).send({ message: "Internal server error during redirection" });
    }
  }

  // OAuth - 42
  @Public()
  @UseGuards(FtAuthGuard)
  @Get("auth/42")
  async ft42Login() {}

  @Public()
  @UseGuards(FtAuthGuard)
  @Get("auth/42/callback")
  async ft42Callback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return this.handleOAuthRedirect(req, res);
  }

  // OAuth - Google
  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get("auth/google")
  async googleLogin() {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get("auth/google/callback")
  async googleCallback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return this.handleOAuthRedirect(req, res);
  }

  // OAuth - GitHub
  @Public()
  @UseGuards(GithubAuthGuard)
  @Get("auth/github")
  async githubLogin() {}

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get("auth/github/callback")
  async githubCallback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return this.handleOAuthRedirect(req, res);
  }

  // OAuth - Discord
  @Public()
  @UseGuards(DiscordAuthGuard)
  @Get("auth/discord")
  async discordLogin() {}

  @Public()
  @UseGuards(DiscordAuthGuard)
  @Get("auth/discord/callback")
  async discordCallback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return this.handleOAuthRedirect(req, res);
  }
}