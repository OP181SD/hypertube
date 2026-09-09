import { FC, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { createComment, updateComment, deleteComment } from "@/api/comments.api";
import type { Comment } from "@/types/api";

interface CommentsSectionProps {
  movieId: string;
  comments: Comment[];
  onCommentChange: () => void;
}

export const CommentsSection: FC<CommentsSectionProps> = ({
  movieId,
  comments,
  onCommentChange,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createComment(movieId, newComment.trim());
      setNewComment("");
      onCommentChange();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim() || submitting) return;
    setSubmitting(true);
    try {
      await updateComment(id, editContent.trim());
      setEditingId(null);
      onCommentChange();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteComment(id);
      onCommentChange();
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 px-3 sm:px-6 lg:px-12 pb-6">
      <h3 className="text-base sm:text-lg font-semibold text-white">{t("comments")}</h3>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <input
          type="text"
          name="comment"
          autoComplete="off"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t("add_comment")}
          className="flex-1 min-w-0 bg-white/10 text-white rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
        <button
          type="submit"
          aria-label={t("send")}
          disabled={submitting || !newComment.trim()}
          className="shrink-0 px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {t("send")}
        </button>
      </form>

      <div className="flex flex-col gap-2 sm:gap-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            data-comment-id={comment.id}
            className="bg-white/5 rounded-lg p-2.5 sm:p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Link
                  to={`/users/${comment.author.id}`}
                  className="text-xs sm:text-sm font-medium text-white hover:text-blue-400 transition-colors truncate"
                >
                  {comment.author.username}
                </Link>
                <span className="text-[10px] sm:text-xs text-white/40 shrink-0">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>

              {user?.id === comment.author.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label="Edit comment"
                    onClick={() => startEdit(comment)}
                    className="p-1 text-white/40 hover:text-white/70 transition-colors"
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-white/40 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {editingId === comment.id ? (
              <form
                className="flex gap-1.5 sm:gap-2 mt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleUpdate(comment.id);
                }}
              >
                <input
                  type="text"
                  name="comment"
                  autoComplete="off"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 min-w-0 bg-white/10 text-white rounded px-2 sm:px-3 py-1 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                />
                <button
                  type="submit"
                  className="shrink-0 px-2 sm:px-3 py-1 bg-blue-600 text-white text-[10px] sm:text-xs rounded hover:bg-blue-700"
                >
                  {t("save")}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="shrink-0 px-2 sm:px-3 py-1 bg-white/10 text-white text-[10px] sm:text-xs rounded hover:bg-white/20"
                >
                  {t("cancel")}
                </button>
              </form>
            ) : (
              <p className="text-xs sm:text-sm text-white/80 wrap-break-words">{comment.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};