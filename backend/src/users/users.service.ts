import {
  Injectable,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuthProvider, Language, User } from "@prisma/client";
import { MultipartFile } from "@fastify/multipart";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import * as argon2 from "argon2";

// Real file-signature ("magic bytes") checks. The client-declared mime-type and
// filename are not trusted: a malicious upload could send a .php payload renamed
// to .png. We sniff the actual bytes and derive the stored extension ourselves.
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
  profilePictureUrl?: string;
  language?: Language;
}

@Injectable()
export class UsersService {
  private readonly uploadPath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadPath = this.config.get<string>("UPLOAD_PATH", "./data/uploads");
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
      throw new ConflictException("Email already exists");
    }

    const existingUsername = await this.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictException("Username already exists");
    }

    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await argon2.hash(data.password);
    }

    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        authProvider: data.authProvider || AuthProvider.LOCAL,
        providerId: data.providerId || null,
        profilePictureUrl: data.profilePictureUrl || null,
        emailVerified: data.emailVerified || false,
      },
    });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const updateData: Record<string, unknown> = {};

    if (data.email !== undefined) {
      const existing = await this.prisma.user.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("Email already exists");
      }
      updateData.email = data.email;
    }

    if (data.username !== undefined) {
      const existing = await this.prisma.user.findFirst({
        where: { username: data.username, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("Username already exists");
      }
      updateData.username = data.username;
    }

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.profilePictureUrl !== undefined)
      updateData.profilePictureUrl = data.profilePictureUrl;
    if (data.language !== undefined) updateData.language = data.language;

    if (data.password) {
      updateData.passwordHash = await argon2.hash(data.password);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async saveAvatar(userId: string, file: MultipartFile): Promise<string> {
    // Buffer the upload (capped to 5 MB by the multipart limit) and validate it
    // by its real signature before anything touches the disk.
    const buffer = await file.toBuffer();
    const signature = IMAGE_SIGNATURES.find((s) => s.matches(buffer));
    if (!signature) {
      throw new BadRequestException(
        "Invalid image file. Allowed: JPEG, PNG, GIF, WebP",
      );
    }

    const filename = `${randomUUID()}${signature.ext}`;
    const filePath = join(this.uploadPath, "avatars", filename);

    await writeFile(filePath, buffer);

    const profilePictureUrl = `/uploads/avatars/${filename}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl },
    });

    return profilePictureUrl;
  }
}
