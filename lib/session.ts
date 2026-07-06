import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getSecret } from "@/lib/secret";

/**
 * Viewer session (Twitch login mode).
 *
 * A signed, httpOnly cookie holding just enough to know WHO submitted a pet:
 * their Twitch user id + login name. That identity lets us enforce the per-pet
 * submission limit and show you who sent each photo in the queue.
 *
 * In no-login mode (PETFEED_LOGIN_MODE=none) this is unused — see lib/anon.ts
 * for the anonymous-cookie path.
 *
 * SESSION_SECRET (>= 32 chars) signs the cookie. In production we refuse to
 * start without a real one rather than fall back to a public dev string (that
 * would let anyone forge a session). In dev we use a deterministic fallback so
 * local testing keeps working.
 */

const COOKIE = "viewer_session";
const DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const EXPIRY = "30d";

export interface ViewerSession {
  platform: "twitch";
  userId: string;
  username: string;
  expiresAt: number;
  [key: string]: unknown;
}

export async function createSession(session: ViewerSession): Promise<void> {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DURATION_MS / 1000,
    path: "/",
  });
}

export async function getSession(): Promise<ViewerSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload as unknown as ViewerSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
