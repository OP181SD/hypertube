import client from "./client";
import type { Comment } from "@/types/api";

export async function getComments(movieId: string): Promise<Comment[]> {
  const res = await client.get<Comment[]>("/comments", {
    params: { movieId },
  });
  return res.data;
}

export async function createComment(
  movieId: string,
  content: string,
): Promise<Comment> {
  const res = await client.post<Comment>(`/movies/${movieId}/comments`, {
    content,
  });
  return res.data;
}

export async function updateComment(
  id: string,
  content: string,
): Promise<Comment> {
  const res = await client.patch<Comment>(`/comments/${id}`, { content });
  return res.data;
}

export async function deleteComment(id: string): Promise<void> {
  await client.delete(`/comments/${id}`);
}
