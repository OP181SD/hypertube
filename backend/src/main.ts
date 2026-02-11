import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { join } from "path";
import { mkdirSync } from "fs";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET,
  });

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
      files: 1,
    },
  });

  const uploadPath = process.env.UPLOAD_PATH || "./data/uploads";
  mkdirSync(join(uploadPath, "avatars"), { recursive: true });

  await app.register(fastifyStatic, {
    root: join(process.cwd(), uploadPath),
    prefix: "/uploads/",
    decorateReply: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    // On récupère l'URL du front, avec un fallback sur localhost
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Range', // Crucial pour le streaming
      'X-Requested-With',
      'Accept'
    ],
    exposedHeaders: [
      'Content-Range', // Crucial pour que le lecteur sache où il en est
      'Accept-Ranges', // Indique au navigateur qu'il peut "scrubber" (avancer/reculer)
      'Content-Length'
    ],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");
}

bootstrap();
