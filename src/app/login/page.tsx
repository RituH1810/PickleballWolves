"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setError("");
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    else router.push("/dashboard");
    setLoading(false);
  }

  async function signInWithGoogle() {
    setError("");
    const { error: authError } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (authError) setError(authError.message);
  }

  return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 noise"><section className="w-full max-w-md rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[0_18px_50px_rgba(0,0,0,.35)] sm:p-9"><div className="mb-9 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1b211e] text-sm font-black text-[#d8f24e]">PW</div><div><p className="text-[15px] font-extrabold tracking-tight">Pickleball<span className="text-[var(--lime-deep)]">Wolves</span></p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--ink-soft)]">Find your pack</p></div></div><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--lime-deep)]">Welcome back</p><h1 className="text-3xl font-black tracking-[-.04em] text-[var(--foreground)]">Sign in to your court.</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Keep your games, groups, and progress moving.</p><button onClick={signInWithGoogle} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] text-sm font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]">Continue with Google</button><div className="my-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><span className="h-px flex-1 bg-[var(--line)]" />or email<span className="h-px flex-1 bg-[var(--line)]" /></div><label className="block text-xs font-bold text-[#c3d0c5]">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm outline-none focus:border-[var(--lime-deep)]" /></label><label className="mt-4 block text-xs font-bold text-[#c3d0c5]">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Your password" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm outline-none focus:border-[var(--lime-deep)]" /></label>{error && <p role="alert" className="mt-4 rounded-xl bg-[#2e1a16] px-4 py-3 text-xs font-semibold text-[#f2a08c]">{error}</p>}<button disabled={loading || !email || !password} onClick={signIn} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Signing in..." : "Sign in"} <ArrowRight size={16} /></button><p className="mt-6 text-center text-sm text-[var(--ink-soft)]">New to the pack? <Link href="/signup" className="font-bold text-[var(--lime-deep)]">Create an account</Link></p></section></main>;
}
