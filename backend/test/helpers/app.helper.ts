import { Test, TestingModule } from "@nestjs/testing";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import fastifyCookie from "@fastify/cookie";
import { AppModule } from "../../src/app.module";
import { AllExceptionsFilter } from "../../src/common/filters/http-exception.filter";

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Rate limiting must not interfere with E2E tests (registerUser logs in
    // on every call). Replace the throttler with a pass-through guard.
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie, {
    secret: "test-cookie-secret-min-32-characters",
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
