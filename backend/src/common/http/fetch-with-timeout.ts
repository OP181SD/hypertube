/**
 * fetch() wrapper that aborts after `timeoutMs` (default 10 s).
 *
 * Centralises the AbortController + setTimeout/clearTimeout boilerplate that
 * every external API call needs. Callers keep their own response.ok handling,
 * JSON parsing and error logging, since those differ per provider.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
