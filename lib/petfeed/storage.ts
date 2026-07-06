import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Supabase Storage helpers for the PUBLIC `pet-pictures` bucket.
 *
 * The browser uploads via a one-time signed PUT URL (so files skip the 4.5MB
 * serverless body limit — phone photos are routinely bigger), and reads use a
 * permanent public CDN URL (stable to store on the row + safe to hand straight
 * to an OBS browser source). The pictures live in Supabase, NOT on the
 * streamer's PC — exactly the point of the feature.
 */

export const PET_PICTURE_BUCKET = "pet-pictures";

/** Sanitize a user-supplied filename for use as part of an object key. */
function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || name;
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

/** Build a unique storage path under the bucket. */
export function buildPetPicturePath(fileName: string): string {
  const safe = sanitizeFileName(fileName);
  const id = crypto.randomUUID();
  return `pets/${id}-${safe}`;
}

/** Only object keys we minted are allowed to cross into a DB row. */
export function isValidPetPicturePath(path: string): boolean {
  return typeof path === "string" && /^pets\/[a-f0-9-]{36}-/.test(path);
}

/** Generate a one-time signed PUT URL the browser can upload to directly. */
export async function getPetPictureSignedUploadUrl(path: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
}> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.storage
    .from(PET_PICTURE_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`createSignedUploadUrl failed: ${error?.message ?? "unknown"}`);
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

/** Permanent public CDN URL for a stored object (bucket is public-read). */
export function getPetPicturePublicUrl(path: string): string {
  const supabase = createServerSupabase();
  const { data } = supabase.storage.from(PET_PICTURE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort cleanup of a stored object (used when purging a row). */
export async function deletePetPictureObject(path: string): Promise<void> {
  if (!isValidPetPicturePath(path)) return;
  const supabase = createServerSupabase();
  await supabase.storage.from(PET_PICTURE_BUCKET).remove([path]);
}
