import Link from "next/link";
import { getSession } from "@/lib/session";
import { getPetFeedConfig } from "@/lib/petfeed/config";
import { PetSubmitForm } from "@/components/petfeed/PetSubmitForm";

/**
 * /pet-feed/submit — where a viewer submits a pet photo for the stream overlay.
 *
 * In twitch mode this is login-gated (we need the identity to enforce the
 * per-pet limit and show the streamer who submitted). In none mode it's open to
 * anyone — the approval queue is the gate.
 */

export const metadata = {
  title: "submit a pet — pet picture feed",
  description: "send a pet photo for the stream's pet picture feed. each one is reviewed before it goes on the rotation.",
};

export const dynamic = "force-dynamic";

export default async function SubmitPet() {
  const cfg = getPetFeedConfig();
  const twitch = cfg.loginMode === "twitch";
  const session = twitch ? await getSession() : null;
  const showForm = !twitch || !!session?.userId;

  return (
    <main style={{ color: "var(--ink)" }}>
      <section style={{ borderBottom: "1px solid var(--rule)" }}>
        <div style={heroInner}>
          <p className="lbl">pet picture feed / submit</p>
          <h1 style={titleStyle}>send a pet to the stream.</h1>
          <p style={introStyle}>
            {cfg.channelName} puts community pets up on stream during breaks.
            {twitch ? (
              <>
                {" "}spend a gifted sub, {cfg.bits.toLocaleString()} bits, or{" "}
                {cfg.points.toLocaleString()} channel points, then drop a photo
                here —
              </>
            ) : (
              <> just drop a photo here —</>
            )}{" "}
            each one is reviewed, and approved pets roll into the rotation. up to{" "}
            {cfg.maxPerPet30d} pics of the same pet every 30 days.
          </p>
        </div>
      </section>

      <section>
        <div style={formInner}>
          {showForm ? (
            <PetSubmitForm
              loginMode={cfg.loginMode}
              spendOptions={cfg.spendOptions}
              maxPerPet30d={cfg.maxPerPet30d}
            />
          ) : (
            <div
              style={{
                border: "1px solid var(--earth-300)",
                borderRadius: "var(--r-card, 12px)",
                padding: "32px 24px",
                textAlign: "center",
                background: "var(--surface-1)",
              }}
            >
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: "0 0 8px" }}>
                sign in to submit
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
                sign in with twitch so the streamer knows who sent the pet and your
                submission limit can be tracked.
              </p>
              <Link className="btn btn--cyan" href="/api/auth/twitch-signin?returnTo=/pet-feed/submit">
                sign in with twitch →
              </Link>
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
const formInner: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "48px 32px 80px" };
