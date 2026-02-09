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
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-white">{t("comments")}</h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t("add_comment")}
          className="flex-1 bg-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button
          aria-label="submit_comment"
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {t("send")}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            data-comment-id={comment.id}
            className="bg-white/5 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Link
                  to={`/users/${comment.author.id}`}
                  className="text-sm font-medium text-white hover:text-blue-400 transition-colors"
                >
                  {comment.author.username}
                </Link>
                <span className="text-xs text-white/40">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>

              {user?.id === comment.author.id && (
                <div className="flex items-center gap-1">
                  <button
                    aria-label="edit_comment"
                    onClick={() => startEdit(comment)}
                    className="p-1 text-white/40 hover:text-white/70 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    aria-label="delete_comment"
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-white/40 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {editingId === comment.id ? (
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 bg-white/10 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                  onKeyDown={(e) => e.key === "Enter" && handleUpdate(comment.id)}
                />
                <button
                  onClick={() => handleUpdate(comment.id)}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  {t("save")}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20"
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <p className="text-sm text-white/80">{comment.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
