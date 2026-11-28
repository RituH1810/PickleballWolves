"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/password-input";
import { PasswordChecklist } from "@/components/password-checklist";
import { passwordError } from "@/lib/password-rules";


/**
 * Change (or, for Google-only accounts, set) the signed-in player's password. Email/password
 * accounts must re-enter the current password first, so an unattended signed-in device can't be
 * used to lock the owner out. After saving, the new password is tried straight away, so a change
 * Supabase didn't take never leaves the player thinking it did -- and locked out next time.
 */

// Supabase's messages, in plain words where they're cryptic.
function friendlyError(message: string) {
  if (/weak|pwned|leaked|compromised/i.test(message)) return "That password is too easy to guess or has appeared in a data leak. Try a longer one with a mix of words, numbers and symbols.";
  if (/should contain|characters/i.test(message)) return `That password doesn't meet the rules: ${message}`;
  if (/reauthenticat|nonce/i.test(message)) return "For security, sign out and back in, then change your password again.";
  if (/same.*(old|current)|different from/i.test(message)) return "The new password has to be different from your current one.";
  return message;
}
export function ChangePassword() {
  const [account, setAccount] = useState<{ email: string; hasPassword: boolean } | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user?.email) return;
      setAccount({ email: data.user.email, hasPassword: Boolean(data.user.identities?.some((identity) => identity.provider === "email")) });
    });
  }, []);

  if (!account) return null;

  async function save() {
    if (!account) return;
    setMessage(null);
    const weak = passwordError(next);
    if (weak) { setMessage({ text: weak, error: true }); return; }
    if (next !== confirm) { setMessage({ text: "The new passwords don't match.", error: true }); return; }
    setSaving(true);
    const supabase = createClient();
    if (account.hasPassword) {
      const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: current });
      if (error) { setMessage({ text: "Your current password isn't right.", error: true }); setSaving(false); return; }
    }
    // Clearing must_change_password too, like the reset page, so an admin's temporary-password flag can't linger.
    const { error } = await supabase.auth.updateUser({ password: next, data: { must_change_password: false } });
    if (error) { setMessage({ text: `Your password was not changed. ${friendlyError(error.message)}`, error: true }); setSaving(false); return; }
    // Prove the new password signs in before telling them it worked.
    const { error: checkError } = await supabase.auth.signInWithPassword({ email: account.email, password: next });
    setSaving(false);
    if (checkError) { setMessage({ text: "Something went wrong saving your new password, so keep using your old one for now. Try again, or use Forgot password on the sign-in page.", error: true }); return; }
    setCurrent("");
    setNext("");
    setConfirm("");
    setAccount({ ...account, hasPassword: true });
    setMessage({ text: account.hasPassword ? "Password changed -- use your new password next time you sign in." : `Password set. You can now also sign in with ${account.email} and this password.`, error: false });
  }

  // For players who don't know their current password (e.g. they joined from an email invite link).
  async function emailReset() {
    if (!account) return;
    setMessage(null);
    const { error } = await createClient().auth.resetPasswordForEmail(account.email, { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}` });
    if (error) { setMessage({ text: friendlyError(error.message), error: true }); return; }
    setResetSent(true);
  }

  const inputClass = "mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--lime-deep)]";
  const ready = (!account.hasPassword || current) && next && confirm;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center gap-2"><KeyRound size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">{account.hasPassword ? "Change password" : "Set a password"}</h2></div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">{account.hasPassword ? `For ${account.email}.` : `You sign in with Google. Add a password to also sign in with ${account.email}.`}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {account.hasPassword && <label className="text-xs font-bold text-[var(--ink-muted)]">Current password<PasswordInput autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} className={inputClass} /></label>}
        <label className="text-xs font-bold text-[var(--ink-muted)]">New password<PasswordInput autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} placeholder="8+ with a capital, number & symbol" className={inputClass} /></label>
        <label className="text-xs font-bold text-[var(--ink-muted)]">Confirm new password<PasswordInput autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && ready) save(); }} className={inputClass} /></label>
      </div>
      {next && <PasswordChecklist password={next} className="mt-3" />}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving || !ready} className="rounded-full bg-[var(--lime)] px-5 py-2.5 text-xs font-bold text-[var(--on-lime)] hover:bg-[var(--lime-hover)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : account.hasPassword ? "Change password" : "Set password"}</button>
        {account.hasPassword && <button type="button" onClick={emailReset} disabled={resetSent} className="text-xs font-bold text-[var(--lime-deep)] hover:underline disabled:no-underline disabled:opacity-70">{resetSent ? `Reset link sent to ${account.email}` : "Forgot your current password? Email me a reset link"}</button>}
      </div>
      {message && <p role={message.error ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${message.error ? "bg-[var(--danger-bg)] text-[var(--danger-ink)]" : "bg-[var(--success-bg)] text-[var(--success-ink)]"}`}>{message.text}</p>}
    </section>
  );
}
