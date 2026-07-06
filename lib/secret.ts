import "server-only";

/**
 * The HMAC secret that signs both the viewer session cookie and the admin
 * cookie. Set SESSION_SECRET (>= 32 chars) in your environment.
 *
 * In production we refuse to start without a real secret rather than fall back
 * to a public, in-repo dev string — that fallback would let anyone forge an
 * admin or viewer session. In dev we keep a deterministic fallback so local
 * testing works without configuration.
 */
export function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (raw && raw.length >= 32) return new TextEncoder().encode(raw);

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 chars — set it in your environment.",
    );
  }
  console.warn("[secret] SESSION_SECRET unset/short — using INSECURE dev fallback (dev only).");
  return new TextEncoder().encode("dev-secret-min-32-chars-long-xxxxxxx");
}
