import client from "./client";
import type { TokenPair, RegisterRequest, MessageResponse } from "@/types/api";

export async function register(data: RegisterRequest): Promise<TokenPair> {
  const res = await client.post<TokenPair>("/auth/register", data);
  return res.data;
}

export async function login(credentials: {
  username: string;
  password: string;
}): Promise<TokenPair> {
  const res = await client.post<TokenPair>("/oauth/token", {
    grant_type: "password",
    username: credentials.username,
    password: credentials.password,
  });
  return res.data;
}

export async function refreshTokens(
  refreshToken: string,
): Promise<TokenPair> {
  const res = await client.post<TokenPair>("/oauth/token", {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return res.data;
}

export async function forgotPassword(
  email: string,
): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/forgot-password", {
    email,
  });
  return res.data;
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/reset-password", {
    token,
    password,
  });
  return res.data;
}

export async function logout(
  refreshToken?: string,
): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/logout", {
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  });
  return res.data;
}
