import Link from "next/link";
import { getApprovedFeed } from "@/lib/petfeed/db";
import { getPetFeedConfig } from "@/lib/petfeed/config";

/**
 * /pet-feed — the public face of the Pet Picture Feed.
 *
 * A short intro + a "submit a pet" CTA + a gallery of the pets that have been
 * approved into the rotation. The OBS overlay itself lives at /pet-feed/overlay
 * (a chrome-free document you paste into OBS — not linked here).
 */

export const metadata = {
  title: "pet picture feed",
  description: "the community pet wall — pets sent in by viewers and shown on stream during breaks.",
};

// ISR: the gallery refreshes within the minute as pics are approved.
export const revalidate = 60;

export default async function PetFeedPage() {
  const cfg = getPetFeedConfig();
  const pets = await getApprovedFeed(120);

  return (
    <main style={{ color: "var(--ink)" }}>
      <section style={{ borderBottom: "1px solid var(--rule)" }}>
        <div style={heroInner}>
          <p className="lbl">pet picture feed</p>
          <h1 style={titleStyle}>the pet wall.</h1>
          <p style={introStyle}>
            community pets, sent in by viewers and put up on stream during breaks.
            {cfg.loginMode === "twitch" ? (
              <>
                {" "}spend a gifted sub, {cfg.bits.toLocaleString()} bits, or{" "}
                {cfg.points.toLocaleString()} channel points, and your good little
                friend can join the rotation.
              </>
            ) : (
              <> send one in and your good little friend can join the rotation.</>
            )}
          </p>
          <div style={{ marginTop: 28 }}>
            <Link className="btn btn--cyan" href="/pet-feed/submit">
              submit a pet →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div style={galleryInner}>
          {pets.length === 0 ? (
            <p style={emptyStyle}>
              no pets up yet — be the first to{" "}
              <Link href="/pet-feed/submit" style={{ color: "var(--accent)" }}>
                send one in
              </Link>
              .
            </p>
          ) : (
            <div style={gridStyle}>
              {pets.map((p) => (
                <figure key={p.id} style={cardStyle}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.pet_name || "a community pet"} style={imgStyle} loading="lazy" />
                  {(p.pet_name || p.caption) && (
                    <figcaption style={capStyle}>
                      {p.pet_name && <span style={{ fontWeight: 600 }}>{p.pet_name}</span>}
                      {p.caption && (
                        <span style={{ color: "var(--ink-muted)" }}>
                          {p.pet_name ? " — " : ""}
                          {p.caption}
                        </span>
                      )}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const heroInner: React.CSSProperties = { maxWidth: 880, margin: "0 auto", padding: "80px 32px" };
const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  marginTop: 4,
};
const introStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "1.05rem",
  lineHeight: 1.7,
  color: "var(--ink-muted)",
  marginTop: 24,
  maxWidth: "58ch",
};
const galleryInner: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "48px 32px 80px" };
const emptyStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 15,
  color: "var(--ink-muted)",
  fontStyle: "italic",
};
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 14,
};
const cardStyle: React.CSSProperties = {
  margin: 0,
  border: "1px solid var(--rule)",
  borderRadius: 10,
  overflow: "hidden",
  background: "var(--surface-1)",
};
const imgStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  objectFit: "cover",
  display: "block",
};
const capStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  padding: "8px 10px",
  lineHeight: 1.4,
};
