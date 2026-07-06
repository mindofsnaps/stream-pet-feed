import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getSecret } from "@/lib/secret";

/**
 * Admin auth — a simple password gate that works in BOTH login modes.
 *
 * You set ADMIN_PASSWORD in your environment. The admin login page posts it; if
 * it matches (compared in constant time), we mint a signed, httpOnly admin
 * cookie. Every moderation action and the admin page call requireAdmin(), which
 * verifies that cookie. No Twitch broadcaster-id wiring required.
 *
 * This is deliberately not tied to the viewer login: the person moderating is
 * you, the streamer, regardless of whether viewers sign in with Twitch or not.
 */

const COOKIE = "petfeed_admin";
const DURATION_S = 30 * 24 * 60 * 60; // 30 days
const EXPIRY = "30d";

export interface AdminSession {
  admin: true;
  /** Display name stamped onto approvals; defaults to "admin". */
  username: string;
}

/** Constant-time string compare (avoids leaking the password via timing). */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/** True if `password` matches ADMIN_PASSWORD. */
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not set — set it in your environment to enable the admin login.");
  }
  return timingSafeEqual(password, expected);
}

/** Mint the admin cookie (call only AFTER checkAdminPassword passed). */
export async function createAdminSession(): Promise<void> {
  const username = process.env.ADMIN_NAME || "admin";
  const token = await new SignJWT({ admin: true, username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DURATION_S,
    path: "/",
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/**
 * Returns the admin session if the request carries a valid admin cookie, else
 * null. Use in admin pages (redirect on null) and at the top of every
 * moderation action.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (payload.admin !== true) return null;
    return {
      admin: true,
      username: typeof payload.username === "string" ? payload.username : "admin",
    };
  } catch {
    return null;
  }
}
