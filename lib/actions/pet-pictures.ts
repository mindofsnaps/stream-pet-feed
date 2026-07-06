"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getOrCreateAnonId } from "@/lib/anon";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildPetPicturePath,
  getPetPictureSignedUploadUrl,
  getPetPicturePublicUrl,
  isValidPetPicturePath,
} from "@/lib/petfeed/storage";
import { getPetFeedConfig, getLoginMode } from "@/lib/petfeed/config";
import { countRecentForPet } from "@/lib/petfeed/db";
import { SPEND_KINDS, type SpendKind, type SubmitterPlatform } from "@/lib/petfeed/types";

/**
 * Viewer-facing actions for the Pet Picture Feed (the submit side).
 *
 * Two steps, using a signed upload so big phone photos skip the serverless body
 * limit:
 *   1. startPetPictureUpload — mint a signed PUT URL; the browser PUTs the file
 *      straight to the public bucket.
 *   2. submitPetPictureAction — record the pending row, enforcing one pic per
 *      submission and <= N of the same pet / 30 days.
 *
 * Behavior depends on PETFEED_LOGIN_MODE:
 *   - "twitch": require a signed-in viewer; capture their Twitch identity; they
 *     declare which currency they spent (you confirm in the queue).
 *   - "none": no login; identity is an anonymous browser-cookie id, name is an
 *     optional field, and there's no spend declaration.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB — photos, not video.

export type PetActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ok = <T>(data: T): PetActionResult<T> => ({ ok: true, data });
const err = (error: string): PetActionResult<never> => ({ ok: false, error });

const missingTable = (m: string | undefined): string | null =>
  /relation .* does not exist|could not find the table|schema cache/i.test(m ?? "")
    ? "the pet-feed table isn't set up yet — the streamer needs to run the migration."
    : null;

export type StartUploadResult = {
  ok: boolean;
  error?: string;
  signedUrl?: string;
  path?: string;
};

/** Resolve who is submitting, per login mode. Null = not allowed to submit. */
async function resolveSubmitter(): Promise<
  { id: string; platform: SubmitterPlatform; name: string } | null
> {
  if (getLoginMode() === "twitch") {
    const session = await getSession();
    if (!session?.userId) return null;
    return { id: session.userId, platform: "twitch", name: session.username ?? "a viewer" };
  }
  // no-login mode: anonymous cookie id; name comes from the form.
  const id = await getOrCreateAnonId();
  return { id, platform: "anon", name: "anonymous" };
}

/** Mint a signed upload URL. Gated on a signed-in viewer in twitch mode. */
export async function startPetPictureUpload(input: {
  fileName: string;
  fileSize: number;
  fileMime: string;
}): Promise<StartUploadResult> {
  const submitter = await resolveSubmitter();
  if (!submitter) return { ok: false, error: "sign in with twitch first" };

  if (!input.fileName) return { ok: false, error: "missing file name" };
  if (!input.fileMime.startsWith("image/")) {
    return { ok: false, error: "only image files (jpg, png, gif, webp)" };
  }
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    return { ok: false, error: "missing file size" };
  }
  if (input.fileSize > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `that image is ${Math.round(input.fileSize / 1024 / 1024)}MB — keep it under 10MB`,
    };
  }

  try {
    const path = buildPetPicturePath(input.fileName);
    const signed = await getPetPictureSignedUploadUrl(path);
    return { ok: true, signedUrl: signed.signedUrl, path: signed.path };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[pet-pictures] startUpload failed:", message);
    return { ok: false, error: "couldn't start the upload — try again" };
  }
}

/** Record a pending submission after the image has been uploaded. */
export async function submitPetPictureAction(input: {
  imagePath: string;
  petName: string;
  spendKind?: SpendKind | null;
  submitterName?: string | null;
  onBehalfOf?: string | null;
  caption?: string | null;
}): Promise<PetActionResult<{ remaining: number }>> {
  const mode = getLoginMode();
  const submitter = await resolveSubmitter();
  if (!submitter) return err("sign in with twitch first");

  // Validate the image path is one WE minted (don't trust a client-supplied url).
  if (!isValidPetPicturePath(input.imagePath)) {
    return err("that image didn't upload right — pick it again");
  }
  const imageUrl = getPetPicturePublicUrl(input.imagePath);

  const petName = (input.petName ?? "").trim().slice(0, 60);
  if (!petName) return err("what's your pet's name?");

  // Spend declaration: required in twitch mode, ignored in none mode.
  let spendKind: SpendKind | null = null;
  if (mode === "twitch") {
    if (!input.spendKind || !SPEND_KINDS.includes(input.spendKind)) {
      return err("pick how you unlocked this submission");
    }
    spendKind = input.spendKind;
  }

  // Submitter name: from the session in twitch mode, from the form in none mode.
  const submitterName =
    mode === "twitch"
      ? submitter.name
      : (input.submitterName ?? "").trim().slice(0, 60) || "anonymous";

  const onBehalfOf = (input.onBehalfOf ?? "").trim().slice(0, 60) || null;
  const caption = (input.caption ?? "").trim().slice(0, 140) || null;

  const cfg = getPetFeedConfig();
  const used = await countRecentForPet(submitter.id, submitter.platform, petName);
  if (used >= cfg.maxPerPet30d) {
    return err(
      `you've already submitted ${cfg.maxPerPet30d} pics of ${petName} in the last 30 days — try a different pet or check back later.`,
    );
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.from("pet_pictures").insert({
    submitter_id: submitter.id,
    submitter_platform: submitter.platform,
    submitter_name: submitterName,
    pet_name: petName,
    on_behalf_of: onBehalfOf,
    caption,
    image_path: input.imagePath,
    image_url: imageUrl,
    spend_kind: spendKind,
    status: "pending",
  });
  if (error) {
    return err(missingTable(error.message) ?? `couldn't save your pic: ${error.message}`);
  }

  revalidatePath("/admin/pet-pictures");
  return ok({ remaining: Math.max(0, cfg.maxPerPet30d - used - 1) });
}
