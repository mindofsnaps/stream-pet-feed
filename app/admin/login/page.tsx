import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "./AdminLoginForm";

/**
 * /admin/login — password gate for the moderation queue. Already signed in?
 * Skip straight to the queue.
 */

export const metadata = { title: "admin login — pet picture feed" };
export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  if (await requireAdmin()) redirect("/admin/pet-pictures");

  return (
    <main style={wrap}>
      <p className="lbl">admin</p>
      <h1 style={title}>moderation login</h1>
      <p style={intro}>
        enter your admin password to review and approve pet submissions.
      </p>
      <AdminLoginForm />
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 420, margin: "0 auto", padding: "96px 32px" };
const title: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "2rem",
  lineHeight: 1.1,
  marginTop: 6,
};
const intro: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--ink-muted)",
  marginTop: 14,
  marginBottom: 24,
};
