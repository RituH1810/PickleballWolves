"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

// Reached two ways: from the password reset email (/auth/callback has already signed the player in
// with the recovery link), or -- with ?required=1 -- after signing in with a temporary password an
// admin gave them, which the proxy won't let them past until they've chosen their own.
function ResetPasswordForm() {
  const router = useRouter();
  const required = useSearchParams().has("required");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    if (password.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters.`); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setSaving(true);
    const supabase = createClient();
    // Clearing must_change_password lets them past the proxy's "choose your own password" check.
    const { error: updateError } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    if (updateError) { setError(updateError.message); setSaving(false); return; }
    if (required) {
      // They just signed in with the temporary one -- straight on to the app.
      await supabase.auth.refreshSession();
      router.push("/dashboard");
      router.refresh();
      return;
    }
    // Sign out so they prove the new password works right away, rather than finding out next week.
    await supabase.auth.signOut();
    router.push("/login?reset=done");
  }

  const inputClass = "mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm outline-none focus:border-[var(--lime-deep)]";
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 noise">
      <section className="w-full max-w-md rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[0_18px_50px_rgba(0,0,0,.35)] sm:p-9">
        <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--lime-deep)]">{required ? "Welcome to the pack" : "Reset password"}</p>
        <h1 className="text-3xl font-black tracking-[-.04em] text-[var(--foreground)]">{required ? "Choose your own password." : "Choose a new password."}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{required ? "You signed in with a temporary password. Pick one only you know -- the temporary one stops working once you do." : "You’ll sign in with it next."}</p>
        <label className="mt-7 block text-xs font-bold text-[#c3d0c5]">New password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" placeholder={`At least ${MIN_LENGTH} characters`} className={inputClass} /></label>
        <label className="mt-4 block text-xs font-bold text-[#c3d0c5]">Confirm password<input value={confirm} onChange={(event) => setConfirm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); }} type="password" autoComplete="new-password" className={inputClass} /></label>
        {error && <p role="alert" className="mt-4 rounded-xl bg-[#2e1a16] px-4 py-3 text-xs font-semibold text-[#f2a08c]">{error}</p>}
        <button disabled={saving || !password || !confirm} onClick={save} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save new password"} <ArrowRight size={16} /></button>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
