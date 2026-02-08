import { NestFastifyApplication } from "@nestjs/platform-fastify";

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

  return {
    user: userData,
    response,
    tokens: JSON.parse(response.body),
  };
}

export async function getAuthHeaders(
  app: NestFastifyApplication,
  overrides: Record<string, string> = {},
) {
  const { tokens } = await registerUser(app, overrides);
  return {
    authorization: `Bearer ${tokens.access_token}`,
  };
}
