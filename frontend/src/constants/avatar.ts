const DICEBEAR_BASE = "https://api.dicebear.com/7.x/avataaars/svg";

export function getAvatarUrl(seed: string): string {
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(seed)}`;
}
