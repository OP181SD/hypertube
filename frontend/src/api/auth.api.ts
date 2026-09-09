import client from "./client";
import type { RegisterRequest, MessageResponse } from "@/types/api";

export async function register(
  data: RegisterRequest,
  avatar?: File,
): Promise<MessageResponse> {
  const form = new FormData();
  form.append("email", data.email);
  form.append("username", data.username);
  form.append("firstName", data.firstName);
  form.append("lastName", data.lastName);
  form.append("password", data.password);
  if (avatar) {
    form.append("avatar", avatar);
  }
  const res = await client.post<MessageResponse>("/auth/register", form);
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

export async function verifyEmail(token: string): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/verify-email", {
    token,
  });
  return res.data;
}

export async function resendVerification(
  email: string,
): Promise<MessageResponse> {
  const res = await client.post<MessageResponse>("/auth/resend-verification", {
    email,
  });
  return res.data;
}
