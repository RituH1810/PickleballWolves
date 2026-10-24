"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, MailCheck } from "lucide-react";

type Result = { email: string; created: boolean; wasConfirmed: boolean; emailed: boolean; emailError: string | null; password: string | null };

/**
 * Admin tool: give a player a temporary password when sign-up or reset emails aren't reaching them.
 * The password is emailed to them (through Resend); only if that fails is it shown here to pass
 * on by hand. They choose their own password at their next sign-in.
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

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied(""); }
  }

  return (
    <section className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <h2 className="flex items-center gap-2 font-extrabold"><KeyRound size={18} className="text-[var(--lime-deep)]" />Temporary password</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">For players who aren&apos;t getting confirmation or reset emails. Emails them a temporary password, confirms their email, and creates the account if their sign-up never arrived. They&apos;ll pick their own password when they sign in.</p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="Player's email" aria-label="Player's email" className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name (only for new accounts)" aria-label="Player's name" className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm" />
        <button type="submit" disabled={busy || !email.trim()} className="h-11 rounded-full bg-[var(--lime)] px-5 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:opacity-50">{busy ? "Setting..." : "Set temporary password"}</button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-xl bg-[#2e1a16] px-4 py-3 text-sm font-semibold text-[#f2a08c]">{error}</p>}
      {result && (result.emailed ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--lime-deep)] bg-[#1e2b17] p-4">
          <MailCheck size={20} className="mt-0.5 shrink-0 text-[var(--lime)]" />
          <div>
            <p className="font-extrabold">Temporary password emailed to {result.email}</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{result.created ? "Their account was created and confirmed." : result.wasConfirmed ? "Their old password no longer works." : "Their email is now confirmed too."} They&apos;ll choose their own password when they sign in. Ask them to check spam if it doesn&apos;t arrive in a few minutes.</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-[var(--coral)] bg-[#2e1a16] p-4">
          <p className="text-sm font-bold text-[#f2a08c]">The password is set, but the email couldn&apos;t be sent{result.emailError ? ` (${result.emailError})` : ""}. Pass it on yourself:</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-[#0f1712] px-3 py-2 text-lg font-black tracking-wide text-[var(--lime)]">{result.password}</code>
            <button type="button" onClick={() => copy(result.password ?? "", "password")} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold hover:bg-[#1c2a1a]">{copied === "password" ? <Check size={13} /> : <Copy size={13} />}Copy password</button>
          </div>
        </div>
      ))}
    </section>
  );
}
