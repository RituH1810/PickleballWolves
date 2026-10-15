"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Only ever reduce `next` to a same-site path. Email templates may pass {{ .RedirectTo }}, a full
 * URL, so keep just its path and query -- never redirect off-site.
 */
function safePath(next: string | null) {
  if (!next) return "/";
  try {
    const url = new URL(next, "https://placeholder.invalid");
    return url.pathname.startsWith("/") && !url.pathname.startsWith("//") ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

export async function confirmEmailLink(formData: FormData) {
  const tokenHash = formData.get("token_hash");
  const type = formData.get("type");
  const next = formData.get("next");
  if (typeof tokenHash !== "string" || !tokenHash || typeof type !== "string" || !OTP_TYPES.includes(type as EmailOtpType)) redirect("/login?error=confirm-link-invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
  if (error) redirect("/login?error=confirm-link-invalid");
  redirect(safePath(typeof next === "string" ? next : null));
}
