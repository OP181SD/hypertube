import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommentsSection } from "../comments/CommentsSection";
import type { Comment } from "@/types/api";

vi.mock("@/api/comments.api");
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", username: "alice" },
    isAuthenticated: true,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockComments: Comment[] = [
  {
    id: "c-1",
    content: "Great movie!",
    movieId: "movie-1",
    author: { id: "user-1", username: "alice" },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "c-2",
    content: "Not bad.",
    movieId: "movie-1",
    author: { id: "user-2", username: "bob" },
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

describe("CommentsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders comments list", () => {
    render(<CommentsSection movieId="movie-1" comments={mockComments} onCommentChange={vi.fn()} />);

    expect(screen.getByText("Great movie!")).toBeInTheDocument();
    expect(screen.getByText("Not bad.")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("submits a new comment", async () => {
    const { createComment } = await import("@/api/comments.api");
    const newComment: Comment = {
      id: "c-3",
      content: "Nice!",
      movieId: "movie-1",
      author: { id: "user-1", username: "alice" },
      createdAt: "2024-01-03T00:00:00Z",
      updatedAt: "2024-01-03T00:00:00Z",
    };
    vi.mocked(createComment).mockResolvedValue(newComment);
    const onCommentChange = vi.fn();

    render(<CommentsSection movieId="movie-1" comments={mockComments} onCommentChange={onCommentChange} />);

    const input = screen.getByPlaceholderText("add_comment");
    await userEvent.type(input, "Nice!");
    await userEvent.click(screen.getByRole("button", { name: "submit_comment" }));

    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith("movie-1", "Nice!");
    });
    expect(onCommentChange).toHaveBeenCalled();
  });

  it("shows edit/delete buttons only for own comments", () => {
    render(<CommentsSection movieId="movie-1" comments={mockComments} onCommentChange={vi.fn()} />);

    // alice's comment (user-1 = current user) should have edit/delete
    const aliceComment = screen.getByText("Great movie!").closest("[data-comment-id]")!;
    expect(aliceComment.querySelector("[aria-label='edit_comment']")).toBeInTheDocument();
    expect(aliceComment.querySelector("[aria-label='delete_comment']")).toBeInTheDocument();

    // bob's comment should NOT have edit/delete
    const bobComment = screen.getByText("Not bad.").closest("[data-comment-id]")!;
    expect(bobComment.querySelector("[aria-label='edit_comment']")).toBeNull();
    expect(bobComment.querySelector("[aria-label='delete_comment']")).toBeNull();
  });

  it("deletes own comment", async () => {
    const { deleteComment } = await import("@/api/comments.api");
    vi.mocked(deleteComment).mockResolvedValue();
    const onCommentChange = vi.fn();

    render(<CommentsSection movieId="movie-1" comments={mockComments} onCommentChange={onCommentChange} />);

    const aliceComment = screen.getByText("Great movie!").closest("[data-comment-id]")!;
    await userEvent.click(aliceComment.querySelector("[aria-label='delete_comment']")!);

    await waitFor(() => {
      expect(deleteComment).toHaveBeenCalledWith("c-1");
    });
    expect(onCommentChange).toHaveBeenCalled();
  });
});
