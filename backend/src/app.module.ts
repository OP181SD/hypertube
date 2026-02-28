import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { MoviesModule } from "./movies/movies.module";
import { CommentsModule } from "./comments/comments.module";
import { StreamingModule } from "./streaming/streaming.module";
import { WatchlistModule } from "./watchlist/watchlist.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    MoviesModule,
    CommentsModule,
    StreamingModule,
    WatchlistModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
