/**
 * Centralised error messages.
 *
 * Keeping every user-facing error string in one place avoids duplication,
 * guarantees consistent wording, and provides a single source of truth to
 * plug into i18n later. Group constants by domain.
 */
export const ERROR_MESSAGES = {
  // Auth
  INVALID_CLIENT_CREDENTIALS: "Invalid client credentials",
  PASSWORD_GRANT_FIELDS_REQUIRED:
    "username and password are required for password grant",
  REFRESH_GRANT_FIELD_REQUIRED:
    "refresh_token is required for refresh_token grant",
  UNSUPPORTED_GRANT_TYPE: "Unsupported grant type",
  NO_REFRESH_TOKEN: "No refresh token",
  INVALID_VERIFICATION_TOKEN: "Invalid verification token",
  VERIFICATION_TOKEN_USED: "Verification token already used",
  VERIFICATION_TOKEN_EXPIRED: "Verification token expired",
  INVALID_CREDENTIALS: "Invalid credentials",
  EMAIL_NOT_VERIFIED: "Please verify your email before logging in",
  INVALID_REFRESH_TOKEN: "Invalid refresh token",
  INVALID_RESET_TOKEN: "Invalid reset token",
  RESET_TOKEN_USED: "Reset token already used",
  RESET_TOKEN_EXPIRED: "Reset token expired",
  TOKEN_REVOKED: "Token has been revoked",

  // Users
  USER_NOT_FOUND: "User not found",
  EMAIL_EXISTS: "Email already exists",
  USERNAME_EXISTS: "Username already exists",
  PROFILE_FORBIDDEN: "You can only update your own profile",
  NO_FILE_UPLOADED: "No file uploaded",
  INVALID_FILE_TYPE: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP",
  INVALID_IMAGE_FILE: "Invalid image file. Allowed: JPEG, PNG, GIF, WebP",

  // Movies
  MOVIE_NOT_FOUND: "Movie not found",

  // Comments
  COMMENT_NOT_FOUND: "Comment not found",
  COMMENT_EDIT_FORBIDDEN: "You can only edit your own comments",
  COMMENT_DELETE_FORBIDDEN: "You can only delete your own comments",

  // Streaming
  TORRENT_NOT_FOUND: "Torrent not found",
  VIDEO_NOT_READY: "Video file not available yet",
  SUBTITLE_NOT_FOUND: (lang: string) => `Subtitle '${lang}' not found`,

  // Watchlist
  NOT_IN_WATCHLIST: "Not in watchlist",
} as const;
