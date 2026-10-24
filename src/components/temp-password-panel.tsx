"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, MessageCircle } from "lucide-react";

type Result = { email: string; password: string; created: boolean; wasConfirmed: boolean };

/**
 * Admin tool: give a player a temporary password when emails aren't reaching them. Shows the
 * password once, with a message to send them; they choose their own at their next sign-in.
 */
export function TempPasswordPanel() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Set a temporary password for ${email.trim()}? Their current password will stop working.`)) return;
    setBusy(true);
    setError("");
    setResult(null);
    const response = await fetch("/api/admin/temp-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name }) });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setError(data?.error ?? "Couldn't set a temporary password."); return; }
    setResult(data);
  }

  const message = result ? `Hi! Your PickleballWolves temporary password is: ${result.password}\n\nSign in at https://pickleballwolves.com/login with ${result.email} -- you'll then choose your own password. 🏓` : "";
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied(""); }
  }

  return (
    <section className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <h2 className="flex items-center gap-2 font-extrabold"><KeyRound size={18} className="text-[var(--lime-deep)]" />Temporary password</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">For players who aren&apos;t getting confirmation or reset emails. Also confirms their email, and creates the account if their sign-up never arrived. They&apos;ll pick their own password when they sign in.</p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="Player's email" aria-label="Player's email" className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name (only for new accounts)" aria-label="Player's name" className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm" />
        <button type="submit" disabled={busy || !email.trim()} className="h-11 rounded-full bg-[var(--lime)] px-5 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:opacity-50">{busy ? "Setting..." : "Set temporary password"}</button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-xl bg-[#2e1a16] px-4 py-3 text-sm font-semibold text-[#f2a08c]">{error}</p>}
      {result && (
        <div className="mt-4 rounded-2xl border border-[var(--lime-deep)] bg-[#1e2b17] p-4">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#c7e572]">{result.created ? "Account created" : result.wasConfirmed ? "Password reset" : "Email confirmed + password set"} · {result.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-[#0f1712] px-3 py-2 text-lg font-black tracking-wide text-[var(--lime)]">{result.password}</code>
            <button type="button" onClick={() => copy(result.password, "password")} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold hover:bg-[#1c2a1a]">{copied === "password" ? <Check size={13} /> : <Copy size={13} />}Copy password</button>
          </div>
          <p className="mt-3 text-xs text-[var(--ink-soft)]">Send it to them privately. It&apos;s shown only now -- set a new one if it gets lost.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-xs font-bold text-[#0f1712]"><MessageCircle size={13} />Send on WhatsApp</a>
            <button type="button" onClick={() => copy(message, "message")} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 py-2 text-xs font-bold hover:bg-[#1c2a1a]">{copied === "message" ? <Check size={13} /> : <Copy size={13} />}Copy message</button>
          </div>
        </div>
      )}
    </section>
  );
}
