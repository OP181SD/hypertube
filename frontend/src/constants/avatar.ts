import { resolveMediaUrl } from "@/constants/media";

/** Backend-served default; also mirrored in `public/default-avatar.svg` for offline preview. */
export const DEFAULT_AVATAR_PATH = "/uploads/avatars/default.svg";

export function getDefaultAvatarUrl(): string {
  return resolveMediaUrl(DEFAULT_AVATAR_PATH) ?? "/default-avatar.svg";
}

/** Fallback when a profile has no picture URL (should be rare after default assignment). */
export function getAvatarUrl(_seed?: string): string {
  return getDefaultAvatarUrl();
}
