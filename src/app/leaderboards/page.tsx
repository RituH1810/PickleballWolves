"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Medal, PawPrint, Trophy } from "lucide-react";

type Leader = { rank: number; name: string; wins: number; losses: number; winPct: number; scored: number; conceded: number; differential: number; matches: number };

function initialsOf(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

function PodiumCard({ leader, place }: { leader: Leader; place: 1 | 2 | 3 }) {
  const isFirst = place === 1;
  return (
    <div className={`flex flex-col items-center rounded-[20px] border px-4 pb-5 text-center transition-transform hover:-translate-y-1 ${isFirst ? "col-start-2 border-[var(--lime-deep)] bg-[var(--lime)] pt-8 text-[#0f1712] sm:scale-105" : place === 2 ? "col-start-1 border-[var(--line)] bg-[var(--panel)] pt-6 text-[var(--foreground)]" : "col-start-3 border-[var(--line)] bg-[var(--panel)] pt-6 text-[var(--foreground)]"}`}>
      {isFirst ? <Crown size={22} className="mb-2 text-[#0f1712]" /> : <Medal size={20} className={`mb-2 ${place === 2 ? "text-[#c7d0d8]" : "text-[#d69a63]"}`} />}
      <div className={`grid place-items-center rounded-full font-black ${isFirst ? "h-16 w-16 bg-[#0f1712] text-xl text-[var(--lime)]" : "h-12 w-12 bg-[#22331f] text-sm text-[var(--lime)]"}`}>{initialsOf(leader.name)}</div>
      <p className={`mt-3 truncate font-extrabold ${isFirst ? "text-base" : "text-sm"}`}>{leader.name}</p>
      <p className={`mt-1 text-xs font-bold ${isFirst ? "text-[#3c4a1e]" : "text-[var(--lime-deep)]"}`}>{leader.winPct}% win rate</p>
      <p className={`mt-1 text-[11px] font-semibold ${isFirst ? "text-[#3c4a1e]" : "text-[var(--ink-soft)]"}`}>{leader.wins}-{leader.losses} · {leader.differential > 0 ? "+" : ""}{leader.differential} diff</p>
    </div>
  );
}

export default function LeaderboardsPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  useEffect(() => { fetch("/api/leaderboard").then((response) => response.json()).then((data) => setLeaders(data.leaderboard ?? [])); }, []);
  const podium = leaders.filter((leader) => leader.matches > 0).slice(0, 3);
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
        {podium.length > 0 && (
          <section className="mt-8 grid grid-cols-3 items-end gap-3">
            {podium.map((leader, index) => <PodiumCard key={leader.name} leader={leader} place={(index + 1) as 1 | 2 | 3} />)}
          </section>
        )}
        <section className="mt-8 overflow-x-auto rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
          {leaders.length === 0 ? <div className="py-10 text-center"><PawPrint size={22} className="mx-auto text-[var(--lime-deep)]" /><p className="mt-3 text-sm text-[var(--ink-soft)]">Play a match to appear on the leaderboard.</p></div> : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">
                  <th className="pb-3">#</th>
                  <th className="pb-3">Player</th>
                  <th className="w-14 pb-3 text-center">W</th>
                  <th className="w-14 pb-3 text-center">L</th>
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
                    <td className="w-14 py-4 text-center font-semibold">{leader.wins}</td>
                    <td className="w-14 py-4 text-center font-semibold">{leader.losses}</td>
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
