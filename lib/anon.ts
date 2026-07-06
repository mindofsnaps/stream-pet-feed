import "server-only";
import { cookies } from "next/headers";

/**
 * Anonymous submitter id for no-login mode (PETFEED_LOGIN_MODE=none).
 *
 * Without a Twitch login there's no real identity, but we still want the
 * per-pet submission limit to mean something. We drop a long-lived random id in
 * a cookie the first time someone submits and key the limit on it. It's a soft
 * gate — clearing cookies resets it — which is fine: the approval queue is the
 * real gate in no-login mode.
 */

const COOKIE = "petfeed_anon";
const DURATION_S = 365 * 24 * 60 * 60; // 1 year

/** Read the anon id, minting + persisting one if absent. Call from an action. */
export async function getOrCreateAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;

  const id = crypto.randomUUID();
  store.set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DURATION_S,
    path: "/",
  });
  return id;
}
