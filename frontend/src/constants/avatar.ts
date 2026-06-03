const DICEBEAR_BASE = "https://api.dicebear.com/7.x/avataaars/svg";

/** Deterministic fallback avatar generated from a seed (e.g. the username). */
export function getAvatarUrl(seed: string): string {
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(seed)}`;
}
