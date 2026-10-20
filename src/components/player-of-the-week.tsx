"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Winner = { userId: string; name: string; photoUrl: string | null; matches: number; wins: number; losses: number; avgPointDiff: number; timesWon: number };
type Week = { weekStart: string; label: string; winners: Winner[] };

/** The group's latest Player of the Week, with the previous few weeks underneath. Hidden until the first one. */
export function PlayerOfTheWeek({ groupId }: { groupId: string }) {
  const [weeks, setWeeks] = useState<Week[] | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/player-of-the-week`).then((response) => response.ok ? response.json() : null).then((data) => setWeeks(data?.weeks ?? []));
  }, [groupId]);

  if (!weeks?.length) return null;
  const [latest, ...earlier] = weeks;
  return (
    <section id="player-of-the-week" className="mt-5 scroll-mt-6 overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--panel)]">
      <div className="bg-[var(--lime)] p-5 text-[#0f1712] sm:p-6">
        <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[.16em]"><Star size={14} fill="currentColor" />Player of the week · {latest.label}</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {latest.winners.map((winner) => (
            <Link key={winner.userId} href={`/players/${winner.userId}`} className="flex items-center gap-3 hover:opacity-90">
              <Avatar name={winner.name} photoUrl={winner.photoUrl} className="h-14 w-14 shrink-0 rounded-2xl bg-[#0f1712] text-lg font-black text-[var(--lime)]" />
              <div>
                <p className="text-2xl font-black tracking-[-.03em]">{winner.name}</p>
                <p className="text-sm font-bold text-[#3c4a1e]">{winner.wins}-{winner.losses} in {winner.matches} matches · {winner.avgPointDiff > 0 ? "+" : ""}{winner.avgPointDiff} avg{winner.timesWon > 1 ? ` · ${winner.timesWon}x winner` : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {earlier.length > 0 && (
        <div className="divide-y divide-[var(--line)] px-5 sm:px-6">
          {earlier.map((week) => (
            <div key={week.weekStart} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="text-xs text-[var(--ink-soft)]">{week.label}</span>
              <span className="truncate font-bold">{week.winners.map((winner, index) => <span key={winner.userId}>{index > 0 && " & "}<Link href={`/players/${winner.userId}`} className="hover:text-[var(--lime-deep)] hover:underline">{winner.name}</Link></span>)} <span className="text-xs font-semibold text-[var(--ink-soft)]">{week.winners[0].wins}-{week.winners[0].losses}</span></span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
