/**
 * Client-side image downscale for pet submissions.
 *
 * Pet photos go straight from the browser to Supabase via a signed PUT URL (so
 * they skip Vercel's 4.5MB body limit), which means the streamer's PC was loading
 * full-res phone photos into the OBS overlay — an 8MB+ JPEG per pet. This shrinks
 * the longest side to 1920px (the overlay is 1920×1080) and re-encodes before the
 * upload, turning ~8MB originals into a few hundred KB with no visible loss on
 * stream.
 *
 * Lives in lib/petfeed/* (not a shared util) on purpose — the whole feature is
 * built to be lifted into a standalone template (see PET-PICTURE-FEED.md), so its
 * helpers stay self-contained. Pure browser code: it's bundled into the "use
 * client" submit form. NEVER add "server-only" here.
 *
 * Robustness rules:
 *  - Animated GIFs are passed through untouched (canvas would flatten them to a
 *    single frame and kill the animation).
 *  - Images already within the target are returned as-is (no needless re-encode).
 *  - PNG/WebP keep their format so transparency survives; everything else lands as
 *    JPEG q0.82.
 *  - EXIF orientation is honored, so portrait phone photos aren't sideways.
 *  - ANY failure (decode, canvas, encode) falls back to the original file — a
 *    resize hiccup must never block a submission.
 */

const MAX_DIM = 1920; // longest side; the OBS overlay is 1920×1080
const JPEG_QUALITY = 0.82;

export async function downscaleImage(file: File, maxDim = MAX_DIM): Promise<File> {
  // Animated GIFs: a canvas redraw collapses them to one frame — never touch them.
  if (file.type === "image/gif") return file;
  if (!file.type.startsWith("image/")) return file;

  try {
    const src = await loadImage(file);
    const width = "naturalWidth" in src ? src.naturalWidth : src.width;
    const height = "naturalHeight" in src ? src.naturalHeight : src.height;
    const longest = Math.max(width, height);

    if (!longest || longest <= maxDim) {
      release(src);
      return file; // already small enough — leave the original untouched
    }

    const scale = maxDim / longest;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      release(src);
      return file;
    }
    ctx.drawImage(src, 0, 0, w, h);
    release(src);

    // Keep PNG/WebP (transparency); everything else becomes a compact JPEG.
    const outType =
      file.type === "image/png" || file.type === "image/webp"
        ? file.type
        : "image/jpeg";
    const quality = outType === "image/jpeg" ? JPEG_QUALITY : undefined;

    const blob = await canvasToBlob(canvas, outType, quality);
    if (!blob || blob.size >= file.size) return file; // no win — keep the original

    return new File([blob], renameForType(file.name, outType), {
      type: outType,
      lastModified: file.lastModified,
    });
  } catch {
    return file; // a resize failure must never block the submission
  }
}

/** Decode the file, preferring createImageBitmap (honors EXIF orientation). */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the <img> path.
    }
  }
  return await loadHtmlImage(file);
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

function release(src: ImageBitmap | HTMLImageElement): void {
  if ("close" in src) src.close();
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renameForType(name: string, type: string): string {
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "pet"}.${ext}`;
}
