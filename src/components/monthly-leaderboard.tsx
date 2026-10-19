"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarRange, Crown, Medal } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Entry = { userId: string; name: string; photoUrl: string | null; matches: number; wins: number; losses: number; winPct: number; avgPointDiff: number; differential: number; rank?: number };
type Month = { key: string; label: string; isCurrent: boolean; matchCount: number; ranked: (Entry & { rank: number })[]; unranked: Entry[] };

const MEDALS = ["text-[var(--lime-deep)]", "text-[#c7d0d8]", "text-[#d69a63]"];

/** This month's group standings (fresh every 1st) with the two previous months a tap away. */
export function MonthlyLeaderboard({ groupId }: { groupId: string }) {
  const [data, setData] = useState<{ minMatches: number; months: Month[] } | null>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/monthly-leaderboard`).then((response) => response.ok ? response.json() : null).then((body) => { if (body?.months) setData(body); });
  }, [groupId]);

  if (!data) return null;
  const month = data.months[selected];
  const leader = month.ranked[0];

  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><CalendarRange size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Monthly leaderboard</h2></div>
        <div role="tablist" aria-label="Month" className="flex rounded-full bg-[#131f19] p-1">
          {data.months.map((entry, index) => (
            <button key={entry.key} role="tab" aria-selected={index === selected} onClick={() => setSelected(index)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${index === selected ? "bg-[var(--lime)] text-[#0f1712]" : "text-[var(--ink-soft)] hover:text-[var(--foreground)]"}`}>
              {entry.isCurrent ? "This month" : entry.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">
        {month.label}{month.isCurrent ? " so far -- resets on the 1st" : " final"} · {month.matchCount} match{month.matchCount === 1 ? "" : "es"} · ranked by win %, then average point difference · {data.minMatches}+ matches to qualify
      </p>

      {leader && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#1e2b17] p-4">
          <Crown size={20} className="shrink-0 text-[var(--lime)]" />
          <Avatar name={leader.name} photoUrl={leader.photoUrl} className="h-10 w-10 shrink-0 rounded-full bg-[#22331f] text-xs font-black text-[var(--lime)]" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#c7e572]">{month.isCurrent ? "Leading this month" : `${month.label.split(" ")[0]} winner`}</p>
            <Link href={`/players/${leader.userId}`} className="block truncate text-lg font-black hover:underline">{leader.name}</Link>
            <p className="text-xs text-[var(--ink-soft)]">{leader.wins}-{leader.losses} · {Math.round(leader.winPct * 100)}% · {leader.avgPointDiff > 0 ? "+" : ""}{leader.avgPointDiff} avg</p>
          </div>
        </div>
      )}

      {month.ranked.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-soft)]">{month.matchCount === 0 ? `No matches ${month.isCurrent ? "yet this month" : `in ${month.label}`}.` : `No one has played ${data.minMatches} matches${month.isCurrent ? " yet this month" : ` in ${month.label}`}.`}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead><tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><th className="pb-3">#</th><th className="pb-3">Player</th><th className="pb-3 text-center">Matches</th><th className="pb-3 text-center">W-L</th><th className="pb-3 text-center">Win%</th><th className="pb-3 text-right">Avg diff</th></tr></thead>
            <tbody>
              {month.ranked.map((entry) => (
                <tr key={entry.userId} className="border-b border-[var(--line)] last:border-0">
                  <td className={`py-3 font-black ${MEDALS[entry.rank - 1] ?? "text-[var(--ink-soft)]"}`}><span className="flex items-center gap-1">{entry.rank <= 3 && <Medal size={13} />}{entry.rank}</span></td>
                  <td className="py-3"><Link href={`/players/${entry.userId}`} className="flex items-center gap-2 font-bold hover:text-[var(--lime-deep)]"><Avatar name={entry.name} photoUrl={entry.photoUrl} className="h-7 w-7 shrink-0 rounded-full bg-[#22331f] text-[10px] font-black text-[var(--lime)]" />{entry.name}</Link></td>
                  <td className="py-3 text-center text-[var(--ink-soft)]">{entry.matches}</td>
                  <td className="py-3 text-center">{entry.wins}-{entry.losses}</td>
                  <td className="py-3 text-center font-bold">{Math.round(entry.winPct * 100)}%</td>
                  <td className={`py-3 text-right font-black ${entry.avgPointDiff > 0 ? "text-[var(--lime-deep)]" : entry.avgPointDiff < 0 ? "text-[var(--coral)]" : "text-[var(--ink-soft)]"}`}>{entry.avgPointDiff > 0 ? "+" : ""}{entry.avgPointDiff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {month.unranked.length > 0 && (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Not enough matches {month.isCurrent ? "yet" : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {month.unranked.map((entry) => (
              <Link key={entry.userId} href={`/players/${entry.userId}`} className="rounded-full bg-[#131f19] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-soft)] hover:text-[var(--foreground)]">
                {entry.name} · {entry.wins}-{entry.losses}{month.isCurrent ? ` · ${data.minMatches - entry.matches} to go` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
