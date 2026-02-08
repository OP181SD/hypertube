import { Controller, Get, Query, Param, ParseUUIDPipe } from "@nestjs/common";
import { User } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { MoviesService } from "./services/movies.service";
import { SearchMoviesDto } from "./dto/search-movies.dto";
import type { PaginatedMovies, MovieDetail } from "./interfaces";

@Controller("movies")
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get()
  async searchMovies(
    @Query() dto: SearchMoviesDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedMovies> {
    return this.moviesService.search(dto, user.id);
  }

  @Get(":id")
  async getMovie(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<MovieDetail> {
    return this.moviesService.findById(id, user.id);
  }
}
