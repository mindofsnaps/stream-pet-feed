"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { PetPicture } from "@/lib/petfeed/types";

/**
 * Admin moderation actions backing /admin/pet-pictures.
 *
 * Called DIRECTLY from the client, RETURNing a result object (not redirecting)
 * so the queue renders optimistically and reconciles against the rows we return,
 * with undo toasts on the reversible ones. The feed IS the approved rows, so
 * approve/hide/reject are all status flips on the one `pet_pictures` row.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const err = (error: string): ActionResult<never> => ({ ok: false, error });

const COLS =
  "id, submitter_id, submitter_platform, submitter_name, pet_name, on_behalf_of, " +
  "caption, image_path, image_url, spend_kind, spend_verified, status, " +
  "submitted_at, reviewed_at, reviewer_notes, approved_by, approved_at, " +
  "created_at, updated_at";

const asPic = (r: Record<string, unknown>): PetPicture => r as unknown as PetPicture;

// Full opaque row captured before a delete so undo can re-insert it verbatim.
export type FullPetRow = Record<string, unknown> & { id: number };

const missingTable = (m: string | undefined): string | null =>
  /relation .* does not exist|could not find the table|schema cache/i.test(m ?? "")
    ? "the pet_pictures table isn't in the database yet — run the migration in Supabase, then try again."
    : null;

function bust() {
  revalidatePath("/admin/pet-pictures");
  revalidatePath("/pet-feed");
}

// ===========================================================================
// APPROVE / REJECT (the pending queue)
// ===========================================================================

/** Approve pending pics -> they enter the rotating feed. */
export async function approvePetPicturesAction(
  ids: number[],
): Promise<ActionResult<PetPicture[]>> {
  const session = await requireAdmin();
  if (!session) return err("unauthorized");
  if (ids.length === 0) return ok([]);

  const supabase = createServerSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("pet_pictures")
    .update({
      status: "approved",
      reviewed_at: now,
      approved_at: now,
      approved_by: session.username,
    })
    .in("id", ids)
    .eq("status", "pending")
    .select(COLS);
  if (error) return err(missingTable(error.message) ?? `approve failed: ${error.message}`);
  bust();
  return ok(((data as unknown as Record<string, unknown>[]) ?? []).map(asPic));
}

/** Reject pending pics (kept in the table, out of the queue + feed). */
export async function rejectPetPicturesAction(
  ids: number[],
  notes?: string | null,
): Promise<ActionResult<PetPicture[]>> {
  const session = await requireAdmin();
  if (!session) return err("unauthorized");
  if (ids.length === 0) return ok([]);

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("pet_pictures")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes?.trim() || null,
    })
    .in("id", ids)
    .eq("status", "pending")
    .select(COLS);
  if (error) return err(missingTable(error.message) ?? `reject failed: ${error.message}`);
  return ok(((data as unknown as Record<string, unknown>[]) ?? []).map(asPic));
}

/** Undo helper: flip rejected pics back to pending so they reappear in the queue. */
export async function rependPetPicturesAction(
  ids: number[],
): Promise<ActionResult<PetPicture[]>> {
  const session = await requireAdmin();
  if (!session) return err("unauthorized");
  if (ids.length === 0) return ok([]);

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("pet_pictures")
    .update({ status: "pending", reviewed_at: null, reviewer_notes: null })
    .in("id", ids)
    .select(COLS);
  if (error) return err(missingTable(error.message) ?? `undo failed: ${error.message}`);
  bust();
  return ok(((data as unknown as Record<string, unknown>[]) ?? []).map(asPic));
}

// ===========================================================================
// HIDE / SHOW (the live feed)
// ===========================================================================

/** Pull an approved pic from rotation (hidden) or put it back (approved). */
export async function setPetPictureStatusAction(
  ids: number[],
  status: "approved" | "hidden",
): Promise<ActionResult<PetPicture[]>> {
  const session = await requireAdmin();
  if (!session) return err("unauthorized");
  if (ids.length === 0) return ok([]);

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("pet_pictures")
    .update({ status })
    .in("id", ids)
    .in("status", ["approved", "hidden"]) // never un-reject / un-pend through here
    .select(COLS);
  if (error) return err(missingTable(error.message) ?? `update failed: ${error.message}`);
  bust();
  return ok(((data as unknown as Record<string, unknown>[]) ?? []).map(asPic));
}

// ===========================================================================
// DELETE / RESTORE (hard remove, with undo)
// ===========================================================================

/**
 * Hard-delete rows, capturing them first so undo can re-insert verbatim. The
 * storage object is intentionally LEFT in place so an undo within the toast
 * window still has a working image url; orphaned blobs (unguessable UUID paths)
 * are negligible and can be swept later.
 */
export async function deletePetPicturesAction(
  ids: number[],
): Promise<ActionResult<FullPetRow[]>> {
  const session = await requireAdmin();
  if (!session) return err("unauthorized");
  if (ids.length === 0) return ok([]);

  const supabase = createServerSupabase();
  const { data: rows } = await supabase.from("pet_pictures").select("*").in("id", ids);
  const { error } = await supabase.from("pet_pictures").delete().in("id", ids);
  if (error) return err(missingTable(error.message) ?? `delete failed: ${error.message}`);
  bust();
  return ok((rows as FullPetRow[]) ?? []);
}

/** Undo of delete: re-insert the captured rows verbatim. */
export async function restorePetPicturesAction(
  rows: FullPetRow[],
): Promise<ActionResult<undefined>> {
  const session = await requireAdmin();
  if (!session) return err("unauthorized");
  if (rows.length === 0) return ok(undefined);

  const supabase = createServerSupabase();
  const { error } = await supabase.from("pet_pictures").insert(rows);
  if (error) return err(missingTable(error.message) ?? `restore failed: ${error.message}`);
  bust();
  return ok(undefined);
}
