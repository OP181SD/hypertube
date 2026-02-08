import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import Joi from "joi";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validationSchema: Joi.object({
        // Server
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid("development", "production", "test")
          .default("development"),
        FRONTEND_URL: Joi.string().uri().required(),

        // Database
        DATABASE_URL: Joi.string().required(),

        // Redis
        REDIS_HOST: Joi.string().default("localhost"),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow("").default(""),

        // JWT
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRY: Joi.string().default("15m"),
        JWT_REFRESH_EXPIRY: Joi.string().default("7d"),

        // Cookie
        COOKIE_SECRET: Joi.string().min(32).required(),

        // OAuth - 42
        FT_CLIENT_ID: Joi.string().required(),
        FT_CLIENT_SECRET: Joi.string().required(),
        FT_CALLBACK_URL: Joi.string().uri().required(),

        // OAuth - Google
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().uri().required(),

        // SMTP
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().required(),
        SMTP_PASS: Joi.string().required(),
        MAIL_FROM: Joi.string().required(),

        // External APIs
        TMDB_API_KEY: Joi.string().required(),
        TMDB_BASE_URL: Joi.string()
          .uri()
          .default("https://api.themoviedb.org/3"),
        YTS_BASE_URL: Joi.string()
          .uri()
          .default("https://yts.mx/api/v2"),
        EZTV_BASE_URL: Joi.string()
          .uri()
          .default("https://eztv.re/api"),

        // Uploads
        UPLOAD_PATH: Joi.string().default("./data/uploads"),

        // Streaming
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
