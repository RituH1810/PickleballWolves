"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";

type Match = { id: string; event: string; location: string; scheduledAt: string | null; scores: { sideAScore: number; sideBScore: number }[]; players: { id: string; name: string; side: "A" | "B" }[] };

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/matches").then((response) => response.json()).then((data) => setMatches(data.matches ?? [])).finally(() => setLoading(false)); }, []);
  return <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-5xl"><Link href="/" className="flex items-center gap-2 text-xs font-bold text-[#6b8f21]"><ArrowLeft size={14} />Back to dashboard</Link><p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">Your record</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">Match history.</h1><p className="mt-3 text-sm text-[#67716a]">Every result, score, and opponent in one place.</p><section className="mt-8 space-y-3">{loading ? <div className="rounded-[20px] border border-[#e2e7e2] bg-white p-6 text-sm text-[#67716a]">Loading matches...</div> : matches.length === 0 ? <div className="rounded-[20px] border border-[#e2e7e2] bg-white p-8 text-center"><p className="font-bold text-[#1b211e]">No matches recorded yet.</p><p className="mt-2 text-sm text-[#67716a]">Record your first result after a game to start your history.</p></div> : matches.map((match) => <article key={match.id} className="rounded-[20px] border border-[#e2e7e2] bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex-1"><h2 className="font-extrabold text-[#1b211e]">{match.event}</h2><div className="mt-2 flex flex-wrap gap-4 text-xs text-[#67716a]"><span className="flex items-center gap-1"><MapPin size={14} />{match.location}</span><span className="flex items-center gap-1"><CalendarDays size={14} />{match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString() : "Recently"}</span></div></div><div className="flex flex-wrap gap-2">{match.scores.map((score, index) => <span key={index} className="rounded-lg bg-[#eef2ed] px-3 py-2 text-sm font-black text-[#1b211e]">{score.sideAScore} - {score.sideBScore}</span>)}</div></div><p className="mt-4 border-t border-[#e2e7e2] pt-3 text-xs text-[#67716a]">{match.players.map((player) => player.name).join(" · ")}</p></article>)}</section></div></main>;
}
