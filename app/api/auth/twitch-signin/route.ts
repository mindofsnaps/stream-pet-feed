import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  encodeOAuthState,
  safeReturnTo,
} from "@/lib/auth/oauth-state";

/**
 * GET /api/auth/twitch-signin — kick off Twitch OAuth (twitch login mode only).
 *
 * Redirects to Twitch's consent screen; Twitch sends the user back to
 * /api/auth/twitch-callback. A random nonce is stashed in a short-lived cookie
 * and echoed through `state` so the callback can confirm the round-trip wasn't
 * forged (login CSRF).
 */

export async function GET(req: Request) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const appUrl = process.env.APP_PUBLIC_URL;
  if (!clientId || !appUrl) {
    return NextResponse.json(
      { error: "Twitch login is not configured (set TWITCH_CLIENT_ID and APP_PUBLIC_URL)." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const nonce = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/twitch-callback`,
    response_type: "code",
    // Minimal scope — we only need the user's identity to attribute submissions.
    scope: "",
    state: encodeOAuthState(nonce, returnTo),
  });

  const res = NextResponse.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
  res.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete the consent screen
  });
  return res;
}
