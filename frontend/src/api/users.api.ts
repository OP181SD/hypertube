import client from "./client";
import type { UserPublic } from "@/types/api";

export async function getUser(id: string): Promise<UserPublic> {
  const res = await client.get<UserPublic>(`/users/${id}`);
  return res.data;
}
