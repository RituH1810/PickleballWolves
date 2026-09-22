"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUp, ChevronRight, Plus } from "lucide-react";

type Position = { id: string; position: number; name: string; rating: string; wins: number; losses: number; userId: string };
type Ladder = { id: string; name: string; challengeRange: number; responseDeadlineHours: number };

export default function LadderPage() {
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/ladder").then((response) => response.json()).then((data) => { setLadder(data.ladder); setPositions(data.positions ?? []); }); }, []);
  async function createLadder() { const response = await fetch("/api/ladder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); const data = await response.json(); setNotice(response.ok ? "Ladder created. Invite players to join." : data.error ?? "Unable to create ladder"); if (response.ok) setLadder(data.ladder); }
  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-4xl"><Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to dashboard</Link><div className="mt-8 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Challenge play</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">The ladder.</h1><p className="mt-3 text-sm text-[var(--ink-soft)]">Challenge up, defend your spot, keep climbing.</p></div><button onClick={createLadder} className="flex items-center gap-2 rounded-full bg-[var(--lime)] px-5 py-3 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]"><Plus size={16} />New ladder</button></div>{notice && <p className="mt-5 rounded-xl bg-[#1e2b17] px-4 py-3 text-xs font-bold text-[#c7e572]">{notice}</p>}<section className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-extrabold">{ladder?.name ?? "No active ladder"}</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Challenge up to {ladder?.challengeRange ?? 3} spots · {ladder?.responseDeadlineHours ?? 48} hour response window</p></div><ArrowUp className="text-[var(--lime-deep)]" /></div><div className="mt-6 space-y-2">{positions.length ? positions.map((position) => <div key={position.id} className="flex items-center gap-4 rounded-xl bg-[#131f19] px-4 py-3"><span className="w-6 text-center font-black text-[var(--lime-deep)]">{position.position}</span><span className="flex-1 text-sm font-bold">{position.name}</span><span className="text-xs font-semibold text-[var(--ink-soft)]">{position.wins} - {position.losses}</span><span className="font-black">{position.rating}</span><ChevronRight size={16} className="text-[var(--ink-soft)]" /></div>) : <p className="py-8 text-center text-sm text-[var(--ink-soft)]">Create a ladder to start ranking players.</p>}</div></section></div></main>;
}
