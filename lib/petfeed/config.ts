import type { SpendKind, SpendOption } from "./types";

/**
 * Pet Picture Feed configuration — ALL knobs live here, read from env with sane
 * defaults, so nothing about the feature is hard-coded to one channel. Set a few
 * env vars (see .env.example) and you're running.
 *
 * Reads process.env, so call it server-side (pages, route handlers, actions) and
 * pass the derived `spendOptions` down to the client form as a prop — the raw
 * env vars are intentionally server-only.
 */

function num(envVal: string | undefined, fallback: number): number {
  const n = Number(envVal);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * How viewers are gated when they submit:
 *  - "twitch": sign in with Twitch; they declare which currency they spent
 *    (gifted sub / bits / points) and you confirm it in the queue. Identity is
 *    captured, so the per-pet limit is enforceable per submitter.
 *  - "none": no login. Anyone can submit; the approval queue is the only gate.
 *    The per-pet limit is tracked best-effort via an anonymous browser cookie.
 */
export type LoginMode = "twitch" | "none";

export function getLoginMode(): LoginMode {
  return (process.env.PETFEED_LOGIN_MODE || "").toLowerCase() === "none"
    ? "none"
    : "twitch";
}

export interface PetFeedConfig {
  /** How submitters are gated. */
  loginMode: LoginMode;
  /** Gifted subs that unlock one submission (twitch mode copy). */
  giftedSubs: number;
  /** Bits that unlock one submission (twitch mode copy). */
  bits: number;
  /** Channel points that unlock one submission (twitch mode copy). */
  points: number;
  /** Max submissions of the SAME pet per rolling 30 days. */
  maxPerPet30d: number;
  /** Seconds each photo stays up on the overlay before advancing. */
  rotateSeconds: number;
  /** Crossfade duration between photos, ms. */
  crossfadeMs: number;
  /** Channel name for overlay/intro copy (generic default keeps it portable). */
  channelName: string;
  /** The spend choices the submit form offers (twitch mode only; [] in none). */
  spendOptions: SpendOption[];
}

export function getPetFeedConfig(): PetFeedConfig {
  const loginMode = getLoginMode();
  const giftedSubs = num(process.env.PETFEED_GIFTED_SUBS, 1);
  const bits = num(process.env.PETFEED_BITS, 2500);
  const points = num(process.env.PETFEED_POINTS, 250000);

  const spendOptions: SpendOption[] =
    loginMode === "twitch"
      ? [
          {
            value: "gifted_sub",
            label: giftedSubs === 1 ? "1 gifted sub" : `${giftedSubs} gifted subs`,
            short: "gifted sub",
          },
          { value: "bits", label: `${fmt(bits)} bits`, short: "bits" },
          { value: "points", label: `${fmt(points)} channel points`, short: "points" },
        ]
      : [];

  return {
    loginMode,
    giftedSubs,
    bits,
    points,
    maxPerPet30d: num(process.env.PETFEED_MAX_PER_PET_30D, 5),
    rotateSeconds: num(process.env.PETFEED_ROTATE_SECONDS, 8),
    crossfadeMs: num(process.env.PETFEED_CROSSFADE_MS, 1200),
    channelName: process.env.PETFEED_CHANNEL_NAME || "the stream",
    spendOptions,
  };
}

/** One-word tag for a spend kind (admin queue). */
export function spendShortLabel(kind: SpendKind): string {
  return getPetFeedConfig().spendOptions.find((o) => o.value === kind)?.short ?? kind;
}
