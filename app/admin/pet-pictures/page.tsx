import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import {
  getPendingPetPictures,
  getModeratedPetPictures,
} from "@/lib/petfeed/db";
import { logoutAdminAction } from "@/lib/actions/admin-auth";
import { PetPicturesClient } from "./PetPicturesClient";
import { ObsUrlCopy } from "./ObsUrlCopy";

/**
 * /admin/pet-pictures — the moderation queue for the Pet Picture Feed.
 *
 * A pending-submission queue (bulk approve / reject, with undo) and the live
 * feed (hide/show, remove + undo restore). All writes go through the
 * service-role actions in lib/actions/pet-pictures-admin.ts, each gated on the
 * admin cookie. Not signed in → bounced to /admin/login.
 */

export const metadata = {
  title: "admin: pet pictures",
  description: "review pet photos submitted for the stream overlay.",
};

export const dynamic = "force-dynamic";

export default async function AdminPetPictures() {
  const session = await requireAdmin();
  if (!session) redirect("/admin/login");

  const [pending, live] = await Promise.all([
    getPendingPetPictures(),
    getModeratedPetPictures(),
  ]);

  return (
    <main style={mainStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <p className="lbl">admin · pet pictures</p>
          <h1 style={titleStyle}>pet picture feed</h1>
        </div>
        <form action={logoutAdminAction}>
          <button type="submit" className="am-mini">sign out</button>
        </form>
      </div>
      <p style={pStyle}>
        approve pet photos into the rotation. approved pets show up on the OBS
        overlay within a few seconds — no refresh needed.
      </p>

      <ObsUrlCopy />

      <PetPicturesClient pending={pending} live={live} />
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "64px 32px",
  color: "var(--ink)",
};
const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2rem, 3.5vw, 3rem)",
  lineHeight: 1.1,
  marginTop: 8,
};
const pStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "1rem",
  lineHeight: 1.7,
  color: "var(--ink-muted)",
  marginTop: 12,
  maxWidth: 640,
};
