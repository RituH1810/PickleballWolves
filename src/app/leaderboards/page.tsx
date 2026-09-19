"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Trophy } from "lucide-react";

type Leader = { rank: number; name: string; rating: string; record: string; matches: number; movement: number };

export default function LeaderboardsPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  useEffect(() => { fetch("/api/leaderboard").then((response) => response.json()).then((data) => setLeaders(data.leaderboard ?? [])); }, []);
  return <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-4xl"><Link href="/" className="flex items-center gap-2 text-xs font-bold text-[#6b8f21]"><ArrowLeft size={14} />Back to dashboard</Link><div className="mt-8 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">Northside Wolves</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">Leaderboard.</h1><p className="mt-3 text-sm text-[#67716a]">Skill rating and results across the current season.</p></div><Trophy size={36} className="text-[#98ba1f]" /></div><section className="mt-8 overflow-hidden rounded-[20px] border border-[#e2e7e2] bg-white"><div className="grid grid-cols-[45px_1fr_90px_90px_70px] gap-3 border-b border-[#e2e7e2] px-5 py-4 text-[10px] font-bold uppercase tracking-[.14em] text-[#67716a]"><span>#</span><span>Player</span><span>Rating</span><span>Record</span><span>Move</span></div>{leaders.map((leader) => <div key={leader.name} className="grid grid-cols-[45px_1fr_90px_90px_70px] items-center gap-3 border-b border-[#e2e7e2] px-5 py-4 last:border-0"><span className={`font-black ${leader.rank <= 3 ? "text-[#98ba1f]" : "text-[#67716a]"}`}>{leader.rank}</span><span className="font-bold text-[#1b211e]">{leader.name}<small className="ml-2 font-normal text-[#67716a]">{leader.matches} matches</small></span><span className="font-black">{leader.rating}</span><span className="text-sm font-semibold text-[#67716a]">{leader.record}</span><span className="text-xs font-bold text-[#67716a]">{leader.movement > 0 ? <ArrowUpRight size={15} /> : leader.movement < 0 ? <ArrowDownRight size={15} /> : "-"}</span></div>)}</section></div></main>;
}
