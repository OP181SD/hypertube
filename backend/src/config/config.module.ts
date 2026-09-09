import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import Joi from "joi";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validationSchema: Joi.object({

        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid("development", "production")
          .default("development"),
        FRONTEND_URL: Joi.string().uri().required(),

        DATABASE_URL: Joi.string().required(),

        REDIS_HOST: Joi.string().default("localhost"),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow("").default(""),

        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRY: Joi.string().default("15m"),
        JWT_REFRESH_EXPIRY: Joi.string().default("7d"),

        COOKIE_SECRET: Joi.string().min(32).required(),

        // Credentials the RESTful API clients present to POST /oauth/token.
        OAUTH_CLIENT_ID: Joi.string().default("hypertube-web"),
        OAUTH_CLIENT_SECRET: Joi.string().min(16).required(),

        FT_CLIENT_ID: Joi.string().required(),
        FT_CLIENT_SECRET: Joi.string().required(),
        FT_CALLBACK_URL: Joi.string().uri().required(),

        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().uri().required(),

        GITHUB_CLIENT_ID: Joi.string().required(),
        GITHUB_CLIENT_SECRET: Joi.string().required(),
        GITHUB_CALLBACK_URL: Joi.string().uri().required(),

        DISCORD_CLIENT_ID: Joi.string().required(),
        DISCORD_CLIENT_SECRET: Joi.string().required(),
        DISCORD_CALLBACK_URL: Joi.string().uri().required(),

        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().allow("").default(""),
        SMTP_PASS: Joi.string().allow("").default(""),
        MAIL_FROM: Joi.string().required(),

        TMDB_API_KEY: Joi.string().required(),
        TMDB_BASE_URL: Joi.string()
          .uri()
          .default("https://api.themoviedb.org/3"),
        YTS_BASE_URL: Joi.string()
          .uri()
          .default("https://movies-api.accel.li/api/v2"),
        EZTV_BASE_URL: Joi.string()
          .uri()
          .default("https://eztv1.xyz/api"),
        OPENSUBTITLES_BASE_URL: Joi.string()
          .uri()
          .default("https://api.opensubtitles.com/api/v1"),

        UPLOAD_PATH: Joi.string().default("./data/uploads"),

        STORAGE_PATH: Joi.string().default("./data/videos"),
        FFMPEG_PATH: Joi.string().allow("").default(""),
        OPENSUBTITLES_API_KEY: Joi.string().allow("").default(""),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),
  ],
})
export class ConfigModule {}
