import { Module } from "@nestjs/common";
import { MoviesController } from "./movies.controller";
import { MoviesService } from "./services/movies.service";
import { YtsService } from "./services/yts.service";
import { EztvService } from "./services/eztv.service";
import { TmdbService } from "./services/tmdb.service";
import { SubtitleService } from "../streaming/services/subtitle.service";

@Module({
  controllers: [MoviesController],
  providers: [MoviesService, YtsService, EztvService, TmdbService, SubtitleService],
  exports: [MoviesService],
})
export class MoviesModule {}
