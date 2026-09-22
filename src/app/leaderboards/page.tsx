"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, PawPrint, Trophy } from "lucide-react";

type Leader = { rank: number; name: string; wins: number; losses: number; winPct: number; scored: number; conceded: number; differential: number; matches: number };

export default function LeaderboardsPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  useEffect(() => { fetch("/api/leaderboard").then((response) => response.json()).then((data) => setLeaders(data.leaderboard ?? [])); }, []);
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to dashboard</Link>
        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">PickleballWolves</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">Leaderboard.</h1>
            <p className="mt-3 text-sm text-[var(--ink-soft)]">Ranked by win %, then point differential, across every recorded match.</p>
          </div>
          <Trophy size={36} className="text-[var(--lime-deep)]" />
        </div>
        <section className="mt-8 overflow-x-auto rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
          {leaders.length === 0 ? <div className="py-10 text-center"><PawPrint size={22} className="mx-auto text-[var(--lime-deep)]" /><p className="mt-3 text-sm text-[var(--ink-soft)]">Play a match to appear on the leaderboard.</p></div> : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">
                  <th className="pb-3">#</th>
                  <th className="pb-3">Player</th>
                  <th className="pb-3 text-center">W</th>
                  <th className="pb-3 text-center">L</th>
                  <th className="pb-3 text-center">Win%</th>
                  <th className="pb-3 text-center">Points earned</th>
                  <th className="pb-3 text-center">Points against</th>
                  <th className="pb-3 text-right">Difference</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((leader) => (
                  <tr key={leader.name} className="border-b border-[var(--line)] last:border-0">
                    <td className={`py-4 font-black ${leader.rank <= 3 ? "text-[var(--lime-deep)]" : "text-[var(--ink-soft)]"}`}>{leader.rank}</td>
                    <td className="py-4 font-bold text-[var(--foreground)]">{leader.name}<small className="ml-2 font-normal text-[var(--ink-soft)]">{leader.matches} matches</small></td>
                    <td className="py-4 text-center font-semibold">{leader.wins}</td>
                    <td className="py-4 text-center font-semibold">{leader.losses}</td>
                    <td className="py-4 text-center font-semibold">{leader.winPct}%</td>
                    <td className="py-4 text-center font-semibold">{leader.scored}</td>
                    <td className="py-4 text-center font-semibold">{leader.conceded}</td>
                    <td className={`py-4 text-right font-black ${leader.differential > 0 ? "text-[var(--lime-deep)]" : leader.differential < 0 ? "text-[#e8836a]" : "text-[var(--ink-soft)]"}`}>{leader.differential > 0 ? "+" : ""}{leader.differential}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
