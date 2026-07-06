"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approvePetPicturesAction,
  rejectPetPicturesAction,
  rependPetPicturesAction,
  setPetPictureStatusAction,
  deletePetPicturesAction,
  restorePetPicturesAction,
  type FullPetRow,
} from "@/lib/actions/pet-pictures-admin";
import type { PetPicture, SpendKind } from "@/lib/petfeed/types";

/**
 * Admin client for the Pet Picture Feed: optimistic local state reconciled
 * against the {ok,data|error} server actions, a floating batch bar, and undo
 * toasts, with photo thumbnails.
 */

const SPEND_LABEL: Record<SpendKind, string> = {
  gifted_sub: "gifted sub",
  bits: "bits",
  points: "points",
};

const IcCheck = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcDash = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 12h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

type CbxState = boolean | "mixed";
function Checkbox({ state, onClick, label }: { state: CbxState; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={"am-cbx" + (state === true ? " on" : state === "mixed" ? " mixed" : "")}
      onClick={onClick}
      role="checkbox"
      aria-checked={state === true}
      aria-label={label}
    >
      {state === true && <IcCheck />}
      {state === "mixed" && <IcDash />}
    </button>
  );
}

let _tid = 0;
const toastId = () => `t${++_tid}`;
type Toast = { id: string; msg: string; tone: "ok" | "err"; undo?: () => void };
type Section = "pend" | "live";
type Selection = { section: Section | null; ids: Set<number> };

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Thumb({ pic, size = 84 }: { pic: PetPicture; size?: number }) {
  return (
    <a
      href={pic.image_url}
      target="_blank"
      rel="noreferrer"
      title="open full size"
      style={{ flex: "none", display: "block", width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pic.image_url}
        alt={pic.pet_name}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius: 8,
          border: "1px solid var(--earth-300)",
          background: "var(--earth-200, #d8cdb8)",
        }}
      />
    </a>
  );
}

export function PetPicturesClient({
  pending: pending0,
  live: live0,
}: {
  pending: PetPicture[];
  live: PetPicture[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(pending0);
  const [live, setLive] = useState(live0);
  const [sel, setSel] = useState<Selection>({ section: null, ids: new Set() });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  // ── toasts ──────────────────────────────────────────────────────────────
  const pushToast = (msg: string, undo?: () => void, tone: "ok" | "err" = "ok") => {
    const id = toastId();
    setToasts((t) => [...t, { id, msg, undo, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  };
  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const fail = (msg: string) => {
    pushToast(msg, undefined, "err");
    router.refresh();
  };

  // ── selection ─────────────────────────────────────────────────────────
  const clearSel = () => { setSel({ section: null, ids: new Set() }); setBatchConfirm(false); };
  const isSel = (section: Section, id: number) => sel.section === section && sel.ids.has(id);
  const toggleSel = (section: Section, id: number) => {
    setBatchConfirm(false);
    setSel((prev) => {
      const base = prev.section === section ? prev.ids : new Set<number>();
      const ids = new Set(base);
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      return { section, ids };
    });
  };
  const selState = (section: Section, ids: number[]): CbxState => {
    if (sel.section !== section || sel.ids.size === 0) return false;
    const all = ids.every((i) => sel.ids.has(i));
    const some = ids.some((i) => sel.ids.has(i));
    return all ? true : some ? "mixed" : false;
  };
  const toggleAll = (section: Section, ids: number[]) => {
    setBatchConfirm(false);
    setSel((prev) => {
      const cur = prev.section === section ? prev.ids : new Set<number>();
      const allOn = ids.length > 0 && ids.every((i) => cur.has(i));
      return { section, ids: allOn ? new Set() : new Set(ids) };
    });
  };

  // ── approve / reject ──────────────────────────────────────────────────
  const approve = async (ids: number[]) => {
    const moving = pending.filter((p) => ids.includes(p.id));
    setPending((l) => l.filter((x) => !ids.includes(x.id)));
    clearSel();
    const res = await approvePetPicturesAction(ids);
    if (!res.ok) { setPending((l) => [...moving, ...l]); fail(res.error); return; }
    const approved = res.data;
    const freshIds = new Set(approved.map((a) => a.id));
    setLive((l) => [...approved, ...l.filter((x) => !freshIds.has(x.id))]);
    pushToast(`approved ${approved.length} pic${approved.length === 1 ? "" : "s"} → on stream`);
  };

  const reject = async (ids: number[], withConfirm = false) => {
    if (withConfirm && !batchConfirm) { setBatchConfirm(true); return; }
    const removed = pending.filter((p) => ids.includes(p.id));
    setPending((l) => l.filter((x) => !ids.includes(x.id)));
    clearSel();
    pushToast(`rejected ${ids.length} pic${ids.length === 1 ? "" : "s"}`, () => undoReject(removed));
    const noteVal = ids.length === 1 ? notes[ids[0]] : undefined;
    const res = await rejectPetPicturesAction(ids, noteVal);
    if (!res.ok) { setPending((l) => [...removed, ...l]); fail(res.error); }
  };

  const undoReject = (pics: PetPicture[]) => {
    setPending((l) => [...pics, ...l.filter((x) => !pics.some((p) => p.id === x.id))]);
    rependPetPicturesAction(pics.map((p) => p.id)).then((r) => { if (!r.ok) fail(r.error); });
  };

  // ── hide / show (live feed) ───────────────────────────────────────────
  const setStatus = async (ids: number[], status: "approved" | "hidden") => {
    const prev = live;
    setLive((arr) => arr.map((x) => (ids.includes(x.id) ? { ...x, status } : x)));
    clearSel();
    const res = await setPetPictureStatusAction(ids, status);
    if (!res.ok) { setLive(prev); fail(res.error); return; }
    pushToast(`${status === "hidden" ? "hid" : "restored"} ${ids.length} pic${ids.length === 1 ? "" : "s"}`);
  };

  // ── remove (+ undo) ───────────────────────────────────────────────────
  const remove = async (ids: number[], withConfirm = false) => {
    if (withConfirm && !batchConfirm) { setBatchConfirm(true); return; }
    const removed = live.filter((x) => ids.includes(x.id));
    setLive((arr) => arr.filter((x) => !ids.includes(x.id)));
    clearSel();
    setConfirmDel(null);
    const res = await deletePetPicturesAction(ids);
    if (!res.ok) { setLive((arr) => [...removed, ...arr]); fail(res.error); return; }
    pushToast(
      `removed ${ids.length} pic${ids.length === 1 ? "" : "s"}`,
      () => undoRemove(res.data, removed),
    );
  };

  const undoRemove = (rows: FullPetRow[], optimistic: PetPicture[]) => {
    setLive((arr) => [...optimistic, ...arr.filter((x) => !optimistic.some((o) => o.id === x.id))]);
    restorePetPicturesAction(rows).then((r) => { if (!r.ok) fail(r.error); });
  };

  const pendingIds = useMemo(() => pending.map((p) => p.id), [pending]);
  const liveIds = useMemo(() => live.map((l) => l.id), [live]);
  const showBatch = sel.ids.size > 0;

  return (
    <div>
      {/* ── pending queue ─────────────────────────────────────────────── */}
      <section style={{ marginTop: 28 }}>
        <div style={sectionHead}>
          <h2 style={h2Style}>
            pending review{pending.length > 0 ? <span style={{ color: "var(--ink-muted)", fontSize: "0.7em" }}> ({pending.length})</span> : null}
          </h2>
          {pending.length > 0 && (
            <button type="button" className="am-mini ghost" onClick={() => toggleAll("pend", pendingIds)}>
              {selState("pend", pendingIds) === true ? "deselect all" : "select all"}
            </button>
          )}
        </div>
        {pending.length === 0 ? (
          <p style={emptyStyle}>nothing waiting — the queue is clear.</p>
        ) : (
          pending.map((s) => (
            <div key={s.id} className="am-row" style={{ alignItems: "flex-start", gap: 14 }}>
              <Checkbox state={isSel("pend", s.id)} onClick={() => toggleSel("pend", s.id)} label={`select ${s.pet_name}`} />
              <Thumb pic={s} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span className="am-name">{s.pet_name}</span>
                  {s.spend_kind && <span style={spendPill}>{SPEND_LABEL[s.spend_kind]}</span>}
                  <span style={metaStyle}>
                    by {s.submitter_name}
                    {s.submitter_platform === "twitch" ? " · twitch" : ""}
                    {s.on_behalf_of ? ` · for ${s.on_behalf_of}` : ""}
                    {` · ${fmtDate(s.submitted_at)}`}
                  </span>
                </div>
                {s.caption && <p style={bodyStyle}>“{s.caption}”</p>}
                <input
                  className="cr-note"
                  placeholder="optional notes (kept on the submission)"
                  value={notes[s.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" className="cr-go" onClick={() => approve([s.id])}>approve → on stream</button>
                  <button type="button" className="cr-ghost" onClick={() => reject([s.id])}>reject</button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── live feed ─────────────────────────────────────────────────── */}
      <section style={{ marginTop: 40 }}>
        <div style={sectionHead}>
          <h2 style={h2Style}>
            in the feed <span style={{ color: "var(--ink-muted)", fontSize: "0.7em" }}>({live.length})</span>
          </h2>
          {live.length > 0 && (
            <button type="button" className="am-mini ghost" onClick={() => toggleAll("live", liveIds)}>
              {selState("live", liveIds) === true ? "deselect all" : "select all"}
            </button>
          )}
        </div>
        {live.length === 0 ? (
          <p style={emptyStyle}>no approved pics yet.</p>
        ) : (
          <div style={liveGrid}>
            {live.map((l) => (
              <div key={l.id} style={{ ...liveCard, opacity: l.status === "hidden" ? 0.5 : 1 }}>
                <div style={{ position: "relative" }}>
                  <Thumb pic={l} size={150} />
                  <div style={{ position: "absolute", top: 6, left: 6 }}>
                    <Checkbox state={isSel("live", l.id)} onClick={() => toggleSel("live", l.id)} label={`select ${l.pet_name}`} />
                  </div>
                  {l.status === "hidden" && <span style={{ ...statusPill, position: "absolute", top: 6, right: 6 }}>hidden</span>}
                </div>
                <div style={{ marginTop: 6 }}>
                  <div className="am-name" style={{ fontSize: 14 }}>{l.pet_name}</div>
                  <div style={{ ...metaStyle, marginTop: 2 }}>by {l.submitter_name}</div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <button type="button" className="am-iconbtn" onClick={() => setStatus([l.id], l.status === "hidden" ? "approved" : "hidden")}>
                    {l.status === "hidden" ? "show" : "hide"}
                  </button>
                  {confirmDel === l.id ? (
                    <button type="button" className="am-iconbtn danger" onClick={() => remove([l.id])}>really?</button>
                  ) : (
                    <button type="button" className="am-iconbtn danger" onClick={() => setConfirmDel(l.id)}>remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── batch bar ─────────────────────────────────────────────────── */}
      {showBatch && (
        <div className="am-batch">
          <span className="cnt"><b>{sel.ids.size}</b> selected</span>
          <span className="div" />
          {sel.section === "pend" ? (
            <>
              <button type="button" className="am-bbtn go" onClick={() => approve([...sel.ids])}>approve → on stream</button>
              <button type="button" className="am-bbtn danger" onClick={() => reject([...sel.ids], true)}>
                {batchConfirm ? `really reject ${sel.ids.size}?` : "reject"}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="am-bbtn" onClick={() => setStatus([...sel.ids], "hidden")}>hide</button>
              <button type="button" className="am-bbtn" onClick={() => setStatus([...sel.ids], "approved")}>show</button>
              <span className="div" />
              <button type="button" className="am-bbtn danger" onClick={() => remove([...sel.ids], true)}>
                {batchConfirm ? `really remove ${sel.ids.size}?` : "remove"}
              </button>
            </>
          )}
          <button type="button" className="x" title="clear selection" aria-label="clear selection" onClick={clearSel}>✕</button>
        </div>
      )}

      {/* ── toasts ────────────────────────────────────────────────────── */}
      <div className="am-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={"am-toast" + (t.tone === "err" ? " err" : "")}>
            <span>{t.msg}</span>
            {t.undo && (
              <button type="button" className="undo" onClick={() => { t.undo?.(); dismissToast(t.id); }}>undo</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── inline styles ───────────────────────────────────────────────────────────
const sectionHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 };
const h2Style: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "1.5rem", margin: 0 };
const emptyStyle: React.CSSProperties = { fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted)", fontStyle: "italic", padding: "12px 0" };
const metaStyle: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-muted)" };
const bodyStyle: React.CSSProperties = { fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink)", margin: "6px 0 0", lineHeight: 1.5, fontStyle: "italic" };
const spendPill: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderRadius: 999,
  padding: "1px 8px",
  color: "var(--accent)",
  border: "1px solid var(--accent)",
};
const statusPill: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderRadius: 999,
  padding: "1px 7px",
  color: "var(--cream-1, #f6efde)",
  background: "rgba(0,0,0,0.6)",
};
const liveGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 16,
};
const liveCard: React.CSSProperties = { display: "flex", flexDirection: "column" };
