"use client";

import { useRef, useState } from "react";
import {
  startPetPictureUpload,
  submitPetPictureAction,
} from "@/lib/actions/pet-pictures";
import { downscaleImage } from "@/lib/petfeed/downscale";
import type { SpendOption } from "@/lib/petfeed/types";
import type { LoginMode } from "@/lib/petfeed/config";

/**
 * Pet Picture Feed submit form.
 *
 * Two-step upload: startPetPictureUpload mints a signed PUT URL, the browser
 * PUTs the file straight to Supabase (so big phone photos skip the serverless
 * body limit), then submitPetPictureAction records the pending row.
 *
 * Mode-aware: in "twitch" mode the viewer declares which currency they spent;
 * in "none" mode they get an optional name field instead.
 */

const LBL: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--ink-muted)",
  marginBottom: 4,
};
const SUB: React.CSSProperties = {
  fontFamily: "var(--font-display-alt)",
  fontStyle: "italic",
  fontSize: 12,
  color: "var(--ink-muted)",
  marginBottom: 8,
};
const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  background: "var(--surface-1)",
  color: "var(--ink)",
  border: "1px solid var(--earth-300)",
  borderRadius: "var(--r-input)",
  outline: "none",
};
const Star = () => <span style={{ color: "var(--accent)" }}>*</span>;

function uploadWithProgress(
  signedUrl: string,
  f: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("Content-Type", f.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error("upload network error — check your connection"));
    xhr.send(f);
  });
}

export function PetSubmitForm({
  loginMode,
  spendOptions,
  maxPerPet30d,
}: {
  loginMode: LoginMode;
  spendOptions: SpendOption[];
  maxPerPet30d: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [yourName, setYourName] = useState("");
  const [spendKind, setSpendKind] = useState<string>("");
  const [onBehalfOf, setOnBehalfOf] = useState("");
  const [caption, setCaption] = useState("");

  const [busy, setBusy] = useState(false);
  const [prepping, setPrepping] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ remaining: number } | null>(null);

  const twitch = loginMode === "twitch";

  function pickFile(f: File | null) {
    setError(null);
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  function reset() {
    pickFile(null);
    setPetName("");
    setYourName("");
    setSpendKind("");
    setOnBehalfOf("");
    setCaption("");
    setProgress(null);
    setDone(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("pick a photo of the pet first");
    if (!petName.trim()) return setError("what's the pet's name?");
    if (twitch && !spendKind) return setError("pick how you unlocked this submission");

    setBusy(true);
    try {
      // Shrink big phone photos before the upload — full-res is needless weight
      // for the 1920x1080 overlay. Falls back to the original on failure.
      setPrepping(true);
      const uploadFile = await downscaleImage(file);
      setPrepping(false);

      setProgress(0);
      const start = await startPetPictureUpload({
        fileName: uploadFile.name,
        fileSize: uploadFile.size,
        fileMime: uploadFile.type || "application/octet-stream",
      });
      if (!start.ok || !start.signedUrl || !start.path) {
        setError(start.error || "couldn't start the upload");
        return;
      }
      await uploadWithProgress(start.signedUrl, uploadFile, setProgress);
      setProgress(100);

      const res = await submitPetPictureAction({
        imagePath: start.path,
        petName,
        spendKind: twitch ? (spendKind as SpendOption["value"]) : null,
        submitterName: twitch ? null : yourName,
        onBehalfOf: onBehalfOf || null,
        caption: caption || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone({ remaining: res.data.remaining });
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong — try again");
    } finally {
      setBusy(false);
      setPrepping(false);
      setProgress(null);
    }
  }

  if (done) {
    return (
      <div
        style={{
          border: "1px solid var(--earth-300)",
          borderRadius: "var(--r-card, 12px)",
          padding: "28px 24px",
          background: "color-mix(in oklab, var(--accent) 6%, var(--surface-1))",
          textAlign: "center",
        }}
      >
        <p style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", margin: "0 0 8px", color: "var(--ink)" }}>
          sent — it&apos;s in the review queue.
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted)", margin: "0 0 18px", lineHeight: 1.6 }}>
          once it&apos;s approved, your pet shows up in the rotation on stream.
          {` you can submit ${done.remaining} more pic${done.remaining === 1 ? "" : "s"} of this pet in the next 30 days.`}
        </p>
        <button type="button" className="btn btn--cyan" onClick={reset}>
          submit another →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      {/* photo */}
      <div>
        <div style={LBL}>
          the photo <Star />
        </div>
        <div style={SUB}>one pet per submission · jpg, png, gif, or webp · up to 10MB</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {file ? "choose a different photo" : "choose a photo"}
          </button>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="your pet"
              style={{
                width: 96,
                height: 96,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid var(--earth-300)",
              }}
            />
          )}
        </div>
      </div>

      <label>
        <div style={LBL}>
          pet&apos;s name <Star />
        </div>
        <input
          type="text"
          value={petName}
          maxLength={60}
          onChange={(e) => setPetName(e.target.value)}
          style={INPUT}
          placeholder="biscuit"
          disabled={busy}
        />
      </label>

      {/* spend declaration — twitch mode only */}
      {twitch && (
        <div>
          <div style={LBL}>
            how&apos;d you unlock it? <Star />
          </div>
          <div style={SUB}>
            you spent one of these — pick the one you used (the streamer confirms on their end)
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {spendOptions.map((o) => (
              <label
                key={o.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: `1px solid ${spendKind === o.value ? "var(--accent)" : "var(--earth-300)"}`,
                  borderRadius: "var(--r-input)",
                  background:
                    spendKind === o.value
                      ? "color-mix(in oklab, var(--accent) 8%, var(--surface-1))"
                      : "var(--surface-1)",
                  cursor: busy ? "default" : "pointer",
                }}
              >
                <input
                  type="radio"
                  name="spendKind"
                  value={o.value}
                  checked={spendKind === o.value}
                  onChange={() => setSpendKind(o.value)}
                  disabled={busy}
                  style={{ accentColor: "var(--accent)" }}
                />
                <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink)" }}>
                  {o.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* your name — none mode only (twitch mode takes it from the login) */}
      {!twitch && (
        <label>
          <div style={LBL}>your name</div>
          <div style={SUB}>optional — shown to the streamer in the queue</div>
          <input
            type="text"
            value={yourName}
            maxLength={60}
            onChange={(e) => setYourName(e.target.value)}
            style={INPUT}
            placeholder="leave blank to stay anonymous"
            disabled={busy}
          />
        </label>
      )}

      <label>
        <div style={LBL}>submitting for someone else?</div>
        <div style={SUB}>optional — a fellow community member&apos;s name, if this is their pet</div>
        <input
          type="text"
          value={onBehalfOf}
          maxLength={60}
          onChange={(e) => setOnBehalfOf(e.target.value)}
          style={INPUT}
          placeholder="leave blank if it's your own pet"
          disabled={busy}
        />
      </label>

      <label>
        <div style={LBL}>caption</div>
        <div style={SUB}>optional — a short line shown under the photo on stream</div>
        <input
          type="text"
          value={caption}
          maxLength={140}
          onChange={(e) => setCaption(e.target.value)}
          style={INPUT}
          placeholder="certified good boy"
          disabled={busy}
        />
      </label>

      <p style={{ ...SUB, marginBottom: 0 }}>
        one pet per submission · up to {maxPerPet30d} pics of the same pet every 30
        days · you can submit for yourself or a fellow community member.
      </p>

      {error && (
        <p className="mono" role="alert" style={{ fontSize: 11, color: "var(--electric-magenta, var(--terracotta))", margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "flex-end" }}>
        {prepping && (
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>
            optimizing photo…
          </span>
        )}
        {progress !== null && (
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>
            {progress < 100 ? `uploading… ${progress}%` : "saving…"}
          </span>
        )}
        <button type="submit" className="btn btn--cyan" disabled={busy}>
          {busy ? "sending…" : "send my pet →"}
        </button>
      </div>
    </form>
  );
}
