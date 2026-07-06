/**
 * Shared types for the Pet Picture Feed.
 *
 * One table (`pet_pictures`) backs the whole loop: a viewer-submitted row lands
 * as `pending`, the admin queue flips it to `approved` (→ enters the OBS feed),
 * `rejected`, or `hidden` (approved-but-pulled-from-rotation). The overlay reads
 * only the public-safe subset (`PetFeedItem`).
 */

/** The three ways a viewer can unlock a submission in Twitch mode. */
export const SPEND_KINDS = ["gifted_sub", "bits", "points"] as const;
export type SpendKind = (typeof SPEND_KINDS)[number];

/** A spend option as shown in the form — label is config-driven (thresholds). */
export interface SpendOption {
  value: SpendKind;
  /** Full label, e.g. "2,500 bits". */
  label: string;
  /** One-word tag for the admin queue, e.g. "bits". */
  short: string;
}

export type PetPictureStatus = "pending" | "approved" | "rejected" | "hidden";

/**
 * Where a submitter came from.
 *  - "twitch": signed in via Twitch OAuth (twitch login mode).
 *  - "anon": no-login mode; submitter_id is an anonymous browser-cookie id.
 */
export type SubmitterPlatform = "twitch" | "anon";

/** Full row as stored. */
export interface PetPicture {
  id: number;
  /** Twitch user id, or an anonymous cookie id in no-login mode. */
  submitter_id: string;
  submitter_platform: SubmitterPlatform;
  /** Display-name snapshot at submit time. */
  submitter_name: string;
  pet_name: string;
  /** Optional: submitting on behalf of a fellow community member (their name). */
  on_behalf_of: string | null;
  /** Optional short caption shown under the photo on the overlay. */
  caption: string | null;
  image_path: string;
  image_url: string;
  /** Which currency the viewer DECLARED they spent (twitch mode; null in none). */
  spend_kind: SpendKind | null;
  /** Forward hook for future Twitch EventSub auto-verification. */
  spend_verified: boolean;
  status: PetPictureStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Public-safe item the overlay + public gallery render. */
export interface PetFeedItem {
  id: number;
  url: string;
  pet_name: string;
  caption: string | null;
}
