import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { UsersService, CreateUserData } from "../users/users.service";
import { MailService } from "../mail/mail.service";
import { RegisterDto } from "./dto/register.dto";
import { AuthProvider, User } from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface OAuthProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: dto.password,
    });

    await this.sendEmailVerification(user.id, user.email, user.username);
  }

  private async sendEmailVerification(userId: string, email: string, username: string): Promise<void> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.emailVerification.create({
      data: { token, userId, expiresAt },
    });

    const frontendUrl = this.configService.get<string>("FRONTEND_URL");
    const verificationLink = `${frontendUrl}/verify-email?token=${token}`;
    await this.mailService.sendVerificationEmail(email, username, verificationLink);
  }

  async verifyEmail(token: string): Promise<TokenPair> {
    const record = await this.prisma.emailVerification.findUnique({ where: { token } });

    if (!record) {
      throw new BadRequestException("Invalid verification token");
    }
    if (record.usedAt) {
      throw new BadRequestException("Verification token already used");
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException("Verification token expired");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return this.generateTokens(record.userId);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Always return silently to avoid leaking info
    if (!user || user.authProvider !== AuthProvider.LOCAL) {
      return;
    }
    if (user.emailVerified) {
      return;
    }

    await this.sendEmailVerification(user.id, user.email, user.username);
  }

  async validateLocalUser(username: string, password: string): Promise<User> {
    const user = await this.usersService.findByUsername(username);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.emailVerified) {
      throw new ForbiddenException("Please verify your email before logging in");
    }

    return user;
  }

  async generateTokens(userId: string): Promise<TokenPair> {
    const payload = { sub: userId };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: 900,
    });

    const refreshToken = randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: 900,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(storedToken.userId);
  }

  async validateOAuthUser(profile: OAuthProfile, provider: AuthProvider): Promise<User> {
    let user = await this.usersService.findByProviderId(provider, profile.id);
    if (user) {
      return user;
    }

    user = await this.usersService.findByEmail(profile.email);
    if (user) {
      return await this.prisma.user.update({
        where: { id: user.id },
        data: {
          authProvider: provider,
          providerId: profile.id,
        },
      });
    }

    const createData: CreateUserData = {
      email: profile.email,
      username: profile.username || `user_${Date.now()}`,
      firstName: profile.firstName || "Prenom",
      lastName: profile.lastName || "Nom",
      authProvider: provider,
      providerId: profile.id,
      profilePictureUrl: profile.profilePictureUrl,
      emailVerified: true,
    };

    return await this.usersService.create(createData);
  }

  async validateOAuthClient(clientId: string, clientSecret: string): Promise<boolean> {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId },
    });

    if (!client) {
      return false;
    }

    try {
      return await argon2.verify(client.clientSecret, clientSecret);
    } catch {
      return false;
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Don't reveal if email exists - always return success
    if (!user) {
      return;
    }

    // Don't send reset for OAuth users without password
    if (user.authProvider !== AuthProvider.LOCAL) {
      return;
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>("FRONTEND_URL");
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    await this.mailService.sendPasswordReset(user.email, user.username, resetLink);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const passwordReset = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!passwordReset) {
      throw new BadRequestException("Invalid reset token");
    }

    if (passwordReset.usedAt) {
      throw new BadRequestException("Reset token already used");
    }

    if (passwordReset.expiresAt < new Date()) {
      throw new BadRequestException("Reset token expired");
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: passwordReset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all refresh tokens for security
      this.prisma.refreshToken.updateMany({
        where: { userId: passwordReset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { revokedAt: new Date() },
      });
    }
  }

  async blacklistAccessToken(token: string, expiresIn: number): Promise<void> {
    await this.redisService.set(`bl:${token}`, "1", "EX", expiresIn);
  }

  async isAccessTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redisService.get(`bl:${token}`);
    return result !== null;
  }
}
