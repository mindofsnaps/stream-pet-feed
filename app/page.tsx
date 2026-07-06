import Link from "next/link";
import { getPetFeedConfig } from "@/lib/petfeed/config";

/**
 * Landing page. A short intro + the two links people actually want: submit a
 * pet, and (for the streamer) the admin queue. The public gallery + overlay
 * live under /pet-feed.
 */

export default function Home() {
  const cfg = getPetFeedConfig();

  return (
    <main style={wrap}>
      <p className="lbl">pet picture feed</p>
      <h1 style={title}>send {cfg.channelName} a pet.</h1>
      <p style={intro}>
        viewers submit pet photos, {cfg.channelName} approves them, and approved
        pets rotate through an overlay on stream during breaks.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <Link className="btn btn--cyan" href="/pet-feed/submit">
          submit a pet →
        </Link>
        <Link className="btn btn--ghost" href="/pet-feed">
          see the pet wall
        </Link>
      </div>
      <p style={{ ...intro, marginTop: 40, fontSize: 13 }}>
        streamer?{" "}
        <Link href="/admin/pet-pictures" style={{ color: "var(--accent)" }}>
          open the moderation queue →
        </Link>
      </p>
    </main>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "96px 32px",
};
const title: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  marginTop: 6,
};
const intro: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "1.05rem",
  lineHeight: 1.7,
  color: "var(--ink-muted)",
  marginTop: 20,
  maxWidth: "56ch",
};
