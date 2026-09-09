import client from "./client";
import type { UserPublic } from "@/types/api";

export async function getMe(): Promise<UserPublic> {
  const res = await client.get<UserPublic>("/users/me");
  return res.data;
}

export async function getUser(id: string): Promise<UserPublic> {
  const res = await client.get<UserPublic>(`/users/${id}`);
  return res.data;
}

export type UpdateUserPayload = Partial<
  Pick<UserPublic, "username" | "email" | "firstName" | "lastName" | "language">
> & { password?: string };

export async function updateUser(
  id: string,
  data: UpdateUserPayload,
): Promise<UserPublic> {
  const res = await client.patch<UserPublic>(`/users/${id}`, data);
  return res.data;
}

export async function uploadProfilePicture(
  id: string,
  file: File,
): Promise<{ profilePictureUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await client.post<{ profilePictureUrl: string }>(
    `/users/${id}/avatar`,
    formData,
  );
  return res.data;
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`);
}
