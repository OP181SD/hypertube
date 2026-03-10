import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "@prisma/client";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get("me")
  async getMe(@CurrentUser() currentUser: User) {
    return {
      id: currentUser.id,
      username: currentUser.username,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      profilePictureUrl: currentUser.profilePictureUrl,
      language: currentUser.language,
      email: currentUser.email,
    };
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const isOwnProfile = currentUser.id === user.id;

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      language: user.language,
      ...(isOwnProfile ? { email: user.email } : {}),
    };
  }

  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.id !== id) {
      throw new ForbiddenException("You can only update your own profile");
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.usersService.update(id, updateUserDto);
  }

  @Post(":id/avatar")
  async uploadAvatar(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.id !== id) {
      throw new ForbiddenException("You can only update your own profile");
    }

    const file = await req.file();
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        "Invalid file type. Allowed: JPEG, PNG, GIF, WebP",
      );
    }

    const profilePictureUrl = await this.usersService.saveAvatar(id, file);

    return { profilePictureUrl };
  }
}
