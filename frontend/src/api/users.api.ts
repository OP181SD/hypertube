import client from "./client";
import type { UserPublic } from "@/types/api";

export async function getUser(id: string): Promise<UserPublic> {
  const res = await client.get<UserPublic>(`/users/${id}`);
  return res.data;
}

export async function updateUser(
  id: string,
  data: Partial<Pick<UserPublic, "username" | "email" | "firstName" | "lastName" | "language">>,
): Promise<UserPublic> {
  const res = await client.patch<UserPublic>(`/users/${id}`, data);
  return res.data;
}

export async function uploadProfilePicture(
  id: string,
  file: File,
): Promise<UserPublic> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await client.patch<UserPublic>(`/users/${id}/profile-picture`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
