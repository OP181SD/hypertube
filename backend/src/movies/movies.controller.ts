import { Controller, Get, Query, Param, ParseUUIDPipe } from "@nestjs/common";
import { User } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { MoviesService } from "./services/movies.service";
import { PopularMoviesDto, SearchMoviesDto } from "./dto/search-movies.dto";
import type { PaginatedMovies, MovieDetail, HeroMovie, FrontpageMovie } from "./interfaces";

@Controller("movies")
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Public()
  @Get()
  async getFrontpage(): Promise<FrontpageMovie[]> {
    return this.toFrontpage(await this.moviesService.getFrontpageTop(5));
  }

  @Get("search")
  async searchMovies(
    @Query() dto: SearchMoviesDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedMovies> {
    return this.moviesService.search(dto, user.id);
  }

  @Get("popular")
  async getPopular(@Query() dto: PopularMoviesDto): Promise<HeroMovie[]> {
    return dto.mediaType === "series"
      ? this.moviesService.getPopularSeries()
      : this.moviesService.getPopular();
  }

  @Get(":id")
  async getMovie(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<MovieDetail> {
    return this.moviesService.findById(id, user.id);
  }

  private toFrontpage(movies: HeroMovie[]): FrontpageMovie[] {
    return movies.map((m) => ({ ...m, name: m.title }));
  }
}
