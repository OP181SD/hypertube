import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import {
  UsersService,
  toOwnUserPublic,
  type UserProfileResponse,
} from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { IsApiClient } from "../common/decorators/api-client.decorator";
import { ERROR_MESSAGES } from "../common/constants/error-messages";
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
    return toOwnUserPublic(currentUser);
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
    @IsApiClient() isApiClient: boolean,
  ): Promise<UserProfileResponse> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (currentUser.id === user.id) {
      return toOwnUserPublic(user);
    }

    const profile = {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      language: user.language,
    };

    return isApiClient ? { ...profile, email: user.email } : profile;
  }

  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
    @IsApiClient() isApiClient: boolean,
  ) {
    if (currentUser.id !== id && !isApiClient) {
      throw new ForbiddenException(ERROR_MESSAGES.PROFILE_FORBIDDEN);
    }

    const existing = await this.usersService.findById(id);
    if (!existing) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const user = await this.usersService.update(id, updateUserDto);
    return toOwnUserPublic(user);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.id !== id) {
      throw new ForbiddenException(ERROR_MESSAGES.PROFILE_FORBIDDEN);
    }

    const existing = await this.usersService.findById(id);
    if (!existing) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await this.usersService.remove(id);
  }

  @Post(":id/avatar")
  async uploadAvatar(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.id !== id) {
      throw new ForbiddenException(ERROR_MESSAGES.PROFILE_FORBIDDEN);
    }

    const file = await req.file();
    if (!file) {
      throw new BadRequestException(ERROR_MESSAGES.NO_FILE_UPLOADED);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        ERROR_MESSAGES.INVALID_FILE_TYPE,
      );
    }

    const profilePictureUrl = await this.usersService.saveAvatar(id, file);

    return { profilePictureUrl };
  }
}
