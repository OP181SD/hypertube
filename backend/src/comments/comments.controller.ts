import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { MovieCommentDto } from "./dto/movie-comment.dto";

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get("comments")
  async findAll(@Query("movieId") movieId?: string) {
    return this.commentsService.findAll(movieId);
  }

  @Get("comments/:id")
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.commentsService.findById(id);
  }

  @Get("movies/:movie_id/comments")
  async findForMovie(@Param("movie_id", ParseUUIDPipe) movieId: string) {
    return this.commentsService.findAll(movieId);
  }

  @Post("comments")
  async create(
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.create(user.id, dto.movieId, dto.content);
  }

  @Post("movies/:movie_id/comments")
  async createForMovie(
    @Param("movie_id", ParseUUIDPipe) movieId: string,
    @Body() dto: MovieCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.create(user.id, movieId, dto.content);
  }

  @Patch("comments/:id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.update(id, user.id, dto.content);
  }

  @Delete("comments/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.commentsService.remove(id, user.id);
  }
}
