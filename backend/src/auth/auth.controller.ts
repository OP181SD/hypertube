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
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { OAuthTokenDto, GrantType } from "./dto/oauth-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { FtAuthGuard } from "./guards/ft-auth.guard";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { GithubAuthGuard } from "./guards/github-auth.guard";
import { FacebookAuthGuard } from "./guards/facebook-auth.guard";
import { TwitterAuthGuard } from "./guards/twitter-auth.guard";
import { DiscordAuthGuard } from "./guards/discord-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "@prisma/client";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("oauth/token")
  @HttpCode(HttpStatus.OK)
  async token(@Body() dto: OAuthTokenDto) {
    const isValidClient = await this.authService.validateOAuthClient(
      dto.client_id,
      dto.client_secret,
    );

    if (!isValidClient) {
      throw new UnauthorizedException("Invalid client credentials");
    }

    switch (dto.grant_type) {
      case GrantType.PASSWORD: {
        if (!dto.username || !dto.password) {
          throw new BadRequestException(
            "username and password are required for password grant",
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
            "refresh_token is required for refresh_token grant",
          );
        }
        return this.authService.refreshTokens(dto.refresh_token);
      }

      default:
        throw new BadRequestException("Unsupported grant type");
    }
  }

  @Public()
  @Post("auth/register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
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

  @Post("auth/logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Body("refresh_token") refreshToken?: string,
  ) {
    await this.authService.logout(user.id, refreshToken);
    return { message: "Logged out successfully" };
  }

  // --- HELPER REDIRECTION ---
  private async handleOAuthRedirect(req: FastifyRequest, res: FastifyReply, provider: string) {
    const user = req.user as User;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (!user) {
      console.error(`--- 🚀 [AuthController] --- Erreur ${provider}: Pas d'utilisateur`);
      return res.status(302).redirect(`${frontendUrl}/login?error=auth_failed`);
    }

    try {
      const tokens = await this.authService.generateTokens(user.id);
      const redirectUrl = `${frontendUrl}/auth/callback?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`;
      
      console.log(`--- 🚀 [AuthController] --- Redirection ${provider} vers:`, redirectUrl);
      return res.status(302).redirect(redirectUrl);
    } catch (error) {
      console.error(`--- 🚀 [AuthController] --- Erreur tokens ${provider}:`, error);
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
    return this.handleOAuthRedirect(req, res, "42");
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
    return this.handleOAuthRedirect(req, res, "Google");
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
    return this.handleOAuthRedirect(req, res, "GitHub");
  }

  // OAuth - Facebook
  @Public()
  @UseGuards(FacebookAuthGuard)
  @Get("auth/facebook")
  async facebookLogin() {}

  @Public()
  @UseGuards(FacebookAuthGuard)
  @Get("auth/facebook/callback")
  async facebookCallback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return this.handleOAuthRedirect(req, res, "Facebook");
  }

  // OAuth - Twitter/X
  @Public()
  @UseGuards(TwitterAuthGuard)
  @Get("auth/twitter")
  async twitterLogin() {}

  @Public()
  @UseGuards(TwitterAuthGuard)
  @Get("auth/twitter/callback")
  async twitterCallback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return this.handleOAuthRedirect(req, res, "Twitter");
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
    return this.handleOAuthRedirect(req, res, "Discord");
  }
}