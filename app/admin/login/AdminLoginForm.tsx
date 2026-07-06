"use client";

import { useActionState } from "react";
import { loginAdminAction, type LoginResult } from "@/lib/actions/admin-auth";

/**
 * The admin password form. On success the action redirects to the queue; on
 * failure it returns an error string we show inline.
 */
export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(
    loginAdminAction,
    null,
  );

  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <input
        type="password"
        name="password"
        placeholder="admin password"
        autoFocus
        autoComplete="current-password"
        style={input}
      />
      {state?.error && (
        <p className="mono" role="alert" style={{ fontSize: 12, color: "var(--terracotta)", margin: 0 }}>
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn--cyan" disabled={pending}>
        {pending ? "checking…" : "sign in →"}
      </button>
    </form>
  );
}

const input: React.CSSProperties = {
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
