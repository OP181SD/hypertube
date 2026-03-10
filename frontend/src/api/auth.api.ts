import client from "./client";
import type { RegisterRequest, MessageResponse } from "@/types/api";

export async function register(data: RegisterRequest): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/register", data);
  return res.data;
}

export async function login(credentials: {
  username: string;
  password: string;
}): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/login", {
    username: credentials.username,
    password: credentials.password,
  });
  return res.data;
}

export async function refresh(): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/refresh");
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

export async function logout(): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/logout");
  return res.data;
}
