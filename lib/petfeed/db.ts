import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PetFeedItem, PetPicture, SubmitterPlatform } from "./types";

/**
 * Read helpers for the Pet Picture Feed. Every read goes through service_role
 * (RLS-bypassing): admin reads behind the admin gate, and the public feed read
 * is intentionally public (approved pics are meant to be shown on stream and
 * only expose the image URL + pet name + caption).
 *
 * All selects degrade gracefully if the migration hasn't run yet: a missing
 * table returns empty rather than throwing, so the admin page renders a friendly
 * "run the migration" empty state and the overlay just shows nothing.
 */

const COLS =
  "id, submitter_id, submitter_platform, submitter_name, pet_name, on_behalf_of, " +
  "caption, image_path, image_url, spend_kind, spend_verified, status, " +
  "submitted_at, reviewed_at, reviewer_notes, approved_by, approved_at, " +
  "created_at, updated_at";

function isMissingTable(message: string | undefined): boolean {
  return /relation .* does not exist|could not find the table|schema cache/i.test(
    message ?? "",
  );
}

const asPic = (r: Record<string, unknown>): PetPicture => r as unknown as PetPicture;

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

/** Pending submissions awaiting review (newest first). */
export async function getPendingPetPictures(): Promise<PetPicture[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("pet_pictures")
    .select(COLS)
    .eq("status", "pending")
    .order("submitted_at", { ascending: false });
  if (error) {
    if (isMissingTable(error.message)) return [];
    throw new Error(`pet_pictures pending read failed: ${error.message}`);
  }
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(asPic);
}

/** Live + hidden pics (everything that's been reviewed in, for the admin list). */
export async function getModeratedPetPictures(): Promise<PetPicture[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("pet_pictures")
    .select(COLS)
    .in("status", ["approved", "hidden"])
    .order("approved_at", { ascending: false });
  if (error) {
    if (isMissingTable(error.message)) return [];
    throw new Error(`pet_pictures moderated read failed: ${error.message}`);
  }
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(asPic);
}

// ---------------------------------------------------------------------------
// Public reads (overlay + gallery)
// ---------------------------------------------------------------------------

/**
 * Approved pics for the rotating feed — public-safe subset only.
 *
 * Fully fault-tolerant on purpose: this read backs the public gallery (which is
 * statically generated / ISR) and the overlay. If the table is missing, the env
 * isn't configured yet (e.g. a first build before Supabase is wired up), or the
 * query errors, we return an empty feed rather than throwing — an empty wall is
 * a fine fallback, and it keeps `next build` from failing before the project is
 * fully configured.
 */
export async function getApprovedFeed(limit = 500): Promise<PetFeedItem[]> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("pet_pictures")
      .select("id, image_url, pet_name, caption")
      .eq("status", "approved")
      .order("approved_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingTable(error.message)) return [];
      throw new Error(`pet_pictures feed read failed: ${error.message}`);
    }
    return ((data as unknown as Record<string, unknown>[]) ?? []).map((r) => ({
      id: r.id as number,
      url: r.image_url as string,
      pet_name: (r.pet_name as string) ?? "",
      caption: (r.caption as string | null) ?? null,
    }));
  } catch (e) {
    console.error("[pet-feed] approved feed read failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Submission limit
// ---------------------------------------------------------------------------

/**
 * How many times this submitter has submitted THIS pet in the last 30 days.
 * Counts everything except rejected (a rejection shouldn't burn a slot).
 * Used to enforce "up to N submissions of the same pet per 30 days".
 */
export async function countRecentForPet(
  submitterId: string,
  platform: SubmitterPlatform,
  petName: string,
): Promise<number> {
  const supabase = createServerSupabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("pet_pictures")
    .select("id", { count: "exact", head: true })
    .eq("submitter_platform", platform)
    .eq("submitter_id", submitterId)
    .ilike("pet_name", petName.trim())
    .in("status", ["pending", "approved", "hidden"])
    .gte("submitted_at", since);
  if (error) {
    if (isMissingTable(error.message)) return 0;
    throw new Error(`pet_pictures count read failed: ${error.message}`);
  }
  return count ?? 0;
}
