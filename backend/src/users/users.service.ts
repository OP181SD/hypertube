import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ERROR_MESSAGES } from "../common/constants/error-messages";
import { fetchWithTimeout } from "../common/http/fetch-with-timeout";
import { AuthProvider, Language, User } from "@prisma/client";
import { MultipartFile } from "@fastify/multipart";
import { access, copyFile, mkdir, unlink, writeFile } from "fs/promises";
import { basename, join } from "path";
import { randomUUID } from "crypto";
import * as argon2 from "argon2";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Served from UPLOAD_PATH; assigned whenever a user has no custom avatar. */
export const DEFAULT_AVATAR_URL = "/uploads/avatars/default.svg";

const IMAGE_SIGNATURES: { ext: string; matches: (b: Buffer) => boolean }[] = [
  { ext: ".jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: ".png",
    matches: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { ext: ".gif", matches: (b) => /^GIF8[79]a$/.test(b.subarray(0, 6).toString("ascii")) },
  {
    ext: ".webp",
    matches: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export interface CreateUserData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password?: string;
  authProvider?: AuthProvider;
  providerId?: string;
  profilePictureUrl?: string;
  emailVerified?: boolean;
}

export interface UpdateUserData {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  language?: Language;
  profilePictureUrl?: string;
}

/**
 * Shape returned by `GET /users/:id`. `email` and `authProvider` are only
 * filled for the owner of the profile or for an external API client.
 */
export interface UserProfileResponse {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  language: Language;
  email?: string;
  authProvider?: AuthProvider;
}

/** Shape returned for the authenticated user's own profile. */
export function toOwnUserPublic(user: User) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePictureUrl: user.profilePictureUrl,
    language: user.language,
    email: user.email,
    authProvider: user.authProvider,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly uploadPath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadPath = this.config.get<string>("UPLOAD_PATH", "./data/uploads");
    void this.ensureDefaultAvatarFile();
  }

  isRemoteProfilePictureUrl(url: string | null | undefined): boolean {
    return !!url && /^https?:\/\//i.test(url);
  }

  isLocalProfilePictureUrl(url: string | null | undefined): boolean {
    return !!url && url.startsWith("/uploads/");
  }

  isDefaultAvatarUrl(url: string | null | undefined): boolean {
    return url === DEFAULT_AVATAR_URL;
  }

  /**
   * Copy the bundled default avatar into the uploads tree so `/uploads/avatars/default.svg`
   * is always available, even on a fresh deploy with an empty data directory.
   */
  async ensureDefaultAvatarFile(): Promise<void> {
    const dest = join(this.uploadPath, "avatars", "default.svg");
    try {
      await access(dest);
      return;
    } catch {
      // Missing — fall through and copy from the packaged asset.
    }
    const source = join(__dirname, "..", "assets", "default-avatar.svg");
    await mkdir(join(this.uploadPath, "avatars"), { recursive: true });
    try {
      await copyFile(source, dest);
    } catch (error) {
      this.logger.warn(
        `Could not install default avatar from ${source}: ${(error as Error).message}`,
      );
    }
  }

  async findAll(): Promise<Pick<User, "id" | "username">[]> {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByProviderId(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        authProvider: provider,
        providerId,
      },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    const existingEmail = await this.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictException(ERROR_MESSAGES.EMAIL_EXISTS);
    }

    const existingUsername = await this.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictException(ERROR_MESSAGES.USERNAME_EXISTS);
    }

    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await argon2.hash(data.password);
    }

    await this.ensureDefaultAvatarFile();

    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        authProvider: data.authProvider || AuthProvider.LOCAL,
        providerId: data.providerId || null,
        profilePictureUrl: data.profilePictureUrl || DEFAULT_AVATAR_URL,
        emailVerified: data.emailVerified || false,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      return;
    }

    await this.deleteCustomAvatarFileIfUnreferenced(user.profilePictureUrl, id);
    await this.prisma.user.delete({ where: { id } });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const updateData: Record<string, unknown> = {};

    if (data.email !== undefined) {
      const existing = await this.prisma.user.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(ERROR_MESSAGES.EMAIL_EXISTS);
      }
      updateData.email = data.email;
    }

    if (data.username !== undefined) {
      const existing = await this.prisma.user.findFirst({
        where: { username: data.username, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(ERROR_MESSAGES.USERNAME_EXISTS);
      }
      updateData.username = data.username;
    }

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.language !== undefined) updateData.language = data.language;

    if (data.password) {
      const existing = await this.findById(id);
      if (existing && existing.authProvider !== AuthProvider.LOCAL) {
        throw new BadRequestException(ERROR_MESSAGES.PASSWORD_OAUTH_FORBIDDEN);
      }
      updateData.passwordHash = await argon2.hash(data.password);
    }

    if (data.profilePictureUrl !== undefined) {
      if (this.isLocalProfilePictureUrl(data.profilePictureUrl)) {
        await this.assertLocalAvatarFile(data.profilePictureUrl);
      }
      const existing = await this.findById(id);
      if (existing?.profilePictureUrl !== data.profilePictureUrl) {
        await this.deleteCustomAvatarFileIfUnreferenced(
          existing?.profilePictureUrl,
          id,
        );
      }
      updateData.profilePictureUrl = data.profilePictureUrl;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async saveAvatar(userId: string, file: MultipartFile): Promise<string> {
    const buffer = await file.toBuffer();
    return this.persistAvatarBuffer(userId, buffer);
  }

  /** Used by auth.register when the signup form already holds the file bytes. */
  async persistAvatarBufferPublic(userId: string, buffer: Buffer): Promise<string> {
    return this.persistAvatarBuffer(userId, buffer);
  }

  /**
   * Download a remote OAuth avatar once and store it under /uploads/avatars.
   * Returns null on failure so login is never blocked by avatar issues.
   */
  async saveAvatarFromUrl(userId: string, url: string): Promise<string | null> {
    if (!this.isRemoteProfilePictureUrl(url)) {
      return null;
    }

    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            Accept: "image/*",
            "User-Agent": "Hypertube/1.0",
          },
          redirect: "follow",
        },
        10_000,
      );

      if (!response.ok) {
        this.logger.warn(
          `Avatar download failed for user ${userId}: HTTP ${response.status}`,
        );
        return null;
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && Number(contentLength) > MAX_AVATAR_BYTES) {
        this.logger.warn(`Avatar too large for user ${userId}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (
        arrayBuffer.byteLength === 0 ||
        arrayBuffer.byteLength > MAX_AVATAR_BYTES
      ) {
        this.logger.warn(`Avatar payload invalid for user ${userId}`);
        return null;
      }

      return await this.persistAvatarBuffer(userId, Buffer.from(arrayBuffer));
    } catch (error) {
      this.logger.warn(
        `Avatar download failed for user ${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async ensureLocalAvatar(
    user: User,
    remoteUrl?: string | null,
  ): Promise<User> {
    if (
      this.isLocalProfilePictureUrl(user.profilePictureUrl) &&
      !this.isDefaultAvatarUrl(user.profilePictureUrl)
    ) {
      return user;
    }

    if (this.isRemoteProfilePictureUrl(remoteUrl)) {
      const localUrl = await this.saveAvatarFromUrl(user.id, remoteUrl!);
      if (localUrl) {
        return { ...user, profilePictureUrl: localUrl };
      }
    }

    if (this.isDefaultAvatarUrl(user.profilePictureUrl)) {
      await this.ensureDefaultAvatarFile();
      return user;
    }

    await this.ensureDefaultAvatarFile();
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { profilePictureUrl: DEFAULT_AVATAR_URL },
    });
    return updated;
  }

  private async deleteCustomAvatarFileIfUnreferenced(
    url: string | null | undefined,
    exceptUserId: string,
  ): Promise<void> {
    if (!url) return;
    const others = await this.prisma.user.count({
      where: { profilePictureUrl: url, NOT: { id: exceptUserId } },
    });
    if (others > 0) return;
    await this.deleteCustomAvatarFile(url);
  }

  private async assertLocalAvatarFile(url: string): Promise<void> {
    const filename = basename(url);
    if (!filename) {
      throw new BadRequestException(ERROR_MESSAGES.AVATAR_FILE_NOT_FOUND);
    }
    if (this.isDefaultAvatarUrl(url)) {
      await this.ensureDefaultAvatarFile();
      return;
    }
    try {
      await access(join(this.uploadPath, "avatars", filename));
    } catch {
      throw new BadRequestException(ERROR_MESSAGES.AVATAR_FILE_NOT_FOUND);
    }
  }

  /** Remove a user-uploaded avatar; never touch the shared default.svg. */
  private async deleteCustomAvatarFile(
    url: string | null | undefined,
  ): Promise<void> {
    if (
      !this.isLocalProfilePictureUrl(url) ||
      this.isDefaultAvatarUrl(url)
    ) {
      return;
    }

    const filename = basename(url!);
    if (!filename || filename === "default.svg") {
      return;
    }

    try {
      await unlink(join(this.uploadPath, "avatars", filename));
    } catch {
      // Missing file is fine — account delete must still succeed.
    }
  }

  private async persistAvatarBuffer(
    userId: string,
    buffer: Buffer,
  ): Promise<string> {
    const signature = IMAGE_SIGNATURES.find((s) => s.matches(buffer));
    if (!signature) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_IMAGE_FILE);
    }

    const filename = `${randomUUID()}${signature.ext}`;
    const avatarsDir = join(this.uploadPath, "avatars");
    await mkdir(avatarsDir, { recursive: true });
    await writeFile(join(avatarsDir, filename), buffer);

    const profilePictureUrl = `/uploads/avatars/${filename}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl },
    });

    return profilePictureUrl;
  }
}
