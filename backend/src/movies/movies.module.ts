import { Module } from "@nestjs/common";
import { MoviesController } from "./movies.controller";
import { MoviesService } from "./services/movies.service";
import { YtsService } from "./services/yts.service";
import { EztvService } from "./services/eztv.service";
import { TmdbService } from "./services/tmdb.service";
import { MovieCacheService } from "./services/movie-cache.service";
import { MovieMapperService } from "./services/movie-mapper.service";
import { MovieQueryService } from "./services/movie-query.service";
import { SubtitleService } from "../streaming/services/subtitle.service";

@Module({
  controllers: [MoviesController],
  providers: [
    MoviesService,
    YtsService,
    EztvService,
    TmdbService,
    MovieCacheService,
    MovieMapperService,
    MovieQueryService,
    SubtitleService,
  ],
  exports: [MoviesService],
})
export class MoviesModule {}
