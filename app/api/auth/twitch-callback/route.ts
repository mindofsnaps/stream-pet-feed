import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/session";
import {
  OAUTH_STATE_COOKIE,
  decodeOAuthState,
  safeReturnTo,
} from "@/lib/auth/oauth-state";

/**
 * GET /api/auth/twitch-callback — finish Twitch OAuth.
 *
 * Exchanges the auth code for a token, reads the user's id + login name, and
 * creates the viewer session cookie. We do NOT check subscription status: any
 * signed-in viewer may submit, and which currency they spent is declared on the
 * form (honor system) and confirmed by you in the queue.
 */

async function exchangeCodeForToken(code: string, appUrl: string): Promise<string> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/api/auth/twitch-callback`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function getUserInfo(accessToken: string): Promise<{ id: string; login: string }> {
  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-ID": process.env.TWITCH_CLIENT_ID!,
    },
  });
  if (!res.ok) throw new Error(`get user failed: ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ id: string; login: string }> };
  if (!data.data?.length) throw new Error("no user data returned");
  return data.data[0];
}

export async function GET(req: Request) {
  const appUrl = process.env.APP_PUBLIC_URL!;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const decoded = decodeOAuthState(state);
  const returnTo = safeReturnTo(decoded.returnTo);

  if (error) {
    return NextResponse.redirect(`${appUrl}${returnTo}?error=user_cancelled`);
  }
  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  // Verify the state nonce against the signin cookie — rejects forged round
  // trips (login CSRF). One-shot: cleared regardless of outcome.
  const store = await cookies();
  const expected = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);
  if (!expected || !decoded.nonce || decoded.nonce !== expected) {
    console.error("[twitch-callback] state nonce mismatch");
    return NextResponse.redirect(`${appUrl}/pet-feed/submit?error=state_mismatch`);
  }

  try {
    const accessToken = await exchangeCodeForToken(code, appUrl);
    const user = await getUserInfo(accessToken);
    await createSession({
      platform: "twitch",
      userId: user.id,
      username: user.login,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return NextResponse.redirect(`${appUrl}${returnTo}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[twitch-callback] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
