"use server";

import { redirect } from "next/navigation";
import {
  checkAdminPassword,
  createAdminSession,
  clearAdminSession,
} from "@/lib/admin";

/**
 * Admin login / logout actions backing /admin/login.
 *
 * loginAdminAction is called from the login form. On the right password it mints
 * the admin cookie and redirects into the queue; otherwise it returns an error
 * the form shows. A short artificial nod to constant-time compare lives in
 * checkAdminPassword.
 */

export type LoginResult = { ok: false; error: string };

export async function loginAdminAction(
  _prev: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { ok: false, error: "enter the admin password" };

  let valid = false;
  try {
    valid = checkAdminPassword(password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "login is not configured" };
  }
  if (!valid) return { ok: false, error: "wrong password" };

  await createAdminSession();
  redirect("/admin/pet-pictures");
}

export async function logoutAdminAction(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}
