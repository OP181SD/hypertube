import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { WatchlistService } from "./watchlist.service";
import type { MovieListItem } from "../movies/interfaces";

@Controller("watchlist")
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  async getWatchlist(@CurrentUser() user: User): Promise<MovieListItem[]> {
    return this.watchlistService.getUserWatchlist(user.id);
  }

  @Post(":movieId")
  async addToWatchlist(
    @Param("movieId", ParseUUIDPipe) movieId: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    return this.watchlistService.add(user.id, movieId);
  }

  @Delete(":movieId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromWatchlist(
    @Param("movieId", ParseUUIDPipe) movieId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.watchlistService.remove(user.id, movieId);
  }
}
