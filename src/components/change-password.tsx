"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

/**
 * Change (or, for Google-only accounts, set) the signed-in player's password. Email/password
 * accounts must re-enter the current password first, so an unattended signed-in device can't be
 * used to lock the owner out.
 */
export function ChangePassword() {
  const [account, setAccount] = useState<{ email: string; hasPassword: boolean } | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

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
    if (next.length < MIN_LENGTH) { setMessage({ text: `Use at least ${MIN_LENGTH} characters.`, error: true }); return; }
    if (next !== confirm) { setMessage({ text: "The new passwords don't match.", error: true }); return; }
    setSaving(true);
    const supabase = createClient();
    if (account.hasPassword) {
      const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: current });
      if (error) { setMessage({ text: "Your current password isn't right.", error: true }); setSaving(false); return; }
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (error) { setMessage({ text: error.message, error: true }); return; }
    setCurrent("");
    setNext("");
    setConfirm("");
    setAccount({ ...account, hasPassword: true });
    setMessage({ text: account.hasPassword ? "Password changed." : `Password set. You can now also sign in with ${account.email} and this password.`, error: false });
  }

  const inputClass = "mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm outline-none focus:border-[var(--lime-deep)]";
  const ready = (!account.hasPassword || current) && next && confirm;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center gap-2"><KeyRound size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">{account.hasPassword ? "Change password" : "Set a password"}</h2></div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">{account.hasPassword ? `For ${account.email}.` : `You sign in with Google. Add a password to also sign in with ${account.email}.`}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {account.hasPassword && <label className="text-xs font-bold text-[#c3d0c5]">Current password<input type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} className={inputClass} /></label>}
        <label className="text-xs font-bold text-[#c3d0c5]">New password<input type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} placeholder={`At least ${MIN_LENGTH} characters`} className={inputClass} /></label>
        <label className="text-xs font-bold text-[#c3d0c5]">Confirm new password<input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && ready) save(); }} className={inputClass} /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving || !ready} className="rounded-full bg-[var(--lime)] px-5 py-2.5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : account.hasPassword ? "Change password" : "Set password"}</button>
        {message && <p role={message.error ? "alert" : "status"} className={`text-xs font-bold ${message.error ? "text-[var(--coral)]" : "text-[var(--lime-deep)]"}`}>{message.text}</p>}
      </div>
    </section>
  );
}
