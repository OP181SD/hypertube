import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { prisma } from "./prisma.helper";

export async function loginUser(
  app: NestFastifyApplication,
  username: string,
  password: string,
) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username, password },
  });

  return {
    access_token: response.cookies.find((c) => c.name === "access_token")
      ?.value,
    refresh_token: response.cookies.find((c) => c.name === "refresh_token")
      ?.value,
  };
}

export async function registerUser(
  app: NestFastifyApplication,
  overrides: Record<string, string> = {},
) {
  const userData = {
    email: "test@example.com",
    username: "testuser",
    firstName: "Test",
    lastName: "User",
    password: "SecurePass123!",
    ...overrides,
  };

  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: userData,
  });

  await prisma.user.update({
    where: { email: userData.email },
    data: { emailVerified: true },
  });

  const tokens = await loginUser(app, userData.username, userData.password);

  return { user: userData, response, tokens };
}
