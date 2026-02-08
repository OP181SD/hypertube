import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthProvider, Language, User } from "@prisma/client";
import * as argon2 from "argon2";

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
  constructor(private readonly prisma: PrismaService) {}

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
}
