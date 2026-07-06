"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Click-to-copy for the OBS browser-source URL.
 *
 * Resolves the absolute URL from the current origin (so it works in prod and on
 * localhost for testing) and copies the whole thing to the clipboard — much
 * harder to paste wrong into OBS than a hand-built relative path.
 */

const OVERLAY_PATH = "/pet-feed/overlay";

const subscribe = () => () => {};
const clientUrl = () => window.location.origin + OVERLAY_PATH;
const serverUrl = () => OVERLAY_PATH;

export function ObsUrlCopy() {
  const url = useSyncExternalStore(subscribe, clientUrl, serverUrl);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={obsBox}>
      <span className="mono" style={hint}>
        OBS browser source url
      </span>
      <button type="button" onClick={copy} style={chip} title="click to copy the full url">
        <code style={code}>{url}</code>
        <span className="mono" style={badge}>{copied ? "copied ✓" : "copy"}</span>
      </button>
      <span className="mono" style={hint}>
        click to copy, then paste into OBS as a Browser Source (1920×1080).
      </span>
    </div>
  );
}

const obsBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 18,
  padding: "12px 16px",
  border: "1px solid var(--earth-300)",
  borderRadius: 10,
  background: "var(--surface-1)",
};
const hint: React.CSSProperties = { fontSize: 11, color: "var(--ink-muted)" };
const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "4px 6px 4px 8px",
  background: "var(--surface-2, var(--surface-1))",
  border: "1px solid var(--rule)",
  borderRadius: 6,
  cursor: "pointer",
  maxWidth: "100%",
};
const code: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  color: "var(--ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const badge: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: 999,
  padding: "1px 8px",
  flex: "none",
};
