import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

/**
 * Viewer logout. Clears the session cookie and bounces back to a safe
 * same-origin path (or the submit page).
 */

const SAFE_PATH = /^\/(?!\/)/;

function safeReturnTo(req: Request, fallback = "/pet-feed/submit"): string {
  const { searchParams } = new URL(req.url);
  const explicit = searchParams.get("returnTo");
  if (explicit && SAFE_PATH.test(explicit)) return explicit;
  return fallback;
}

export async function GET(req: Request) {
  await clearSession();
  return NextResponse.redirect(new URL(safeReturnTo(req), req.url), { status: 303 });
}

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
