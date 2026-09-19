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
  return <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-4xl"><Link href="/" className="flex items-center gap-2 text-xs font-bold text-[#6b8f21]"><ArrowLeft size={14} />Back to dashboard</Link><div className="mt-8 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">Challenge play</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">The ladder.</h1><p className="mt-3 text-sm text-[#67716a]">Challenge up, defend your spot, keep climbing.</p></div><button onClick={createLadder} className="flex items-center gap-2 rounded-full bg-[#1b211e] px-5 py-3 text-sm font-bold text-white"><Plus size={16} />New ladder</button></div>{notice && <p className="mt-5 rounded-xl bg-[#e4f3a8] px-4 py-3 text-xs font-bold text-[#5c7b1a]">{notice}</p>}<section className="mt-8 rounded-[20px] border border-[#e2e7e2] bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-extrabold">{ladder?.name ?? "No active ladder"}</h2><p className="mt-1 text-sm text-[#67716a]">Challenge up to {ladder?.challengeRange ?? 3} spots · {ladder?.responseDeadlineHours ?? 48} hour response window</p></div><ArrowUp className="text-[#98ba1f]" /></div><div className="mt-6 space-y-2">{positions.length ? positions.map((position) => <div key={position.id} className="flex items-center gap-4 rounded-xl bg-[#f3f6ef] px-4 py-3"><span className="w-6 text-center font-black text-[#98ba1f]">{position.position}</span><span className="flex-1 text-sm font-bold">{position.name}</span><span className="text-xs font-semibold text-[#67716a]">{position.wins} - {position.losses}</span><span className="font-black">{position.rating}</span><ChevronRight size={16} className="text-[#a0aaa1]" /></div>) : <p className="py-8 text-center text-sm text-[#67716a]">Create a ladder to start ranking players.</p>}</div></section></div></main>;
}
