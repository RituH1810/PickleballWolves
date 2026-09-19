"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, Users, CalendarDays, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Stats = { users: number; groups: number; events: number };

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/admin").then(async (response) => { const data = await response.json(); if (!response.ok) setError(data.error); else setStats(data.stats); }); }, []);
  const cards: { label: string; value: number | string; icon: LucideIcon }[] = [{ label: "Users", value: stats?.users ?? "-", icon: Users }, { label: "Groups", value: stats?.groups ?? "-", icon: Layers }, { label: "Events", value: stats?.events ?? "-", icon: CalendarDays }];
  return <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-5xl"><Link href="/" className="flex items-center gap-2 text-xs font-bold text-[#6b8f21]"><ArrowLeft size={14} />Back to dashboard</Link><div className="mt-8 flex items-end gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1b211e] text-[#d8f24e]"><ShieldCheck size={27} /></div><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">Platform control</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">Admin panel.</h1></div></div>{error ? <p className="mt-8 rounded-xl bg-[#fde3dd] px-4 py-3 text-sm font-bold text-[#a94f3d]">{error}</p> : <section className="mt-8 grid gap-4 sm:grid-cols-3">{cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-[20px] border border-[#e2e7e2] bg-white p-6"><Icon size={20} className="text-[#98ba1f]" /><p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[#67716a]">{label}</p><p className="mt-2 text-4xl font-black">{value}</p></div>)}</section>}</div></main>;
}
