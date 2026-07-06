/**
 * OAuth `state` helpers — login-CSRF protection for the Twitch round-trip.
 *
 * On signin we generate a random nonce, stash it in a short-lived cookie, and
 * also pack it (with the post-login returnTo path) into the `state` query param.
 * On callback we compare the cookie nonce to the one echoed back in `state`; a
 * mismatch means the round-trip was forged and we reject it.
 */

export const OAUTH_STATE_COOKIE = "petfeed_oauth_state";

/** Only allow same-origin relative paths as returnTo (open-redirect guard). */
export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (value && /^\/(?!\/)/.test(value)) return value;
  return fallback;
}

/** Pack nonce + returnTo into the opaque `state` param (base64url JSON). */
export function encodeOAuthState(nonce: string, returnTo: string): string {
  const json = JSON.stringify({ n: nonce, r: returnTo });
  return Buffer.from(json, "utf8").toString("base64url");
}

/** Unpack `state`; tolerant of garbage (returns empty fields). */
export function decodeOAuthState(state: string | null): {
  nonce: string | null;
  returnTo: string | null;
} {
  if (!state) return { nonce: null, returnTo: null };
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const obj = JSON.parse(json) as { n?: string; r?: string };
    return { nonce: obj.n ?? null, returnTo: obj.r ?? null };
  } catch {
    return { nonce: null, returnTo: null };
  }
}
