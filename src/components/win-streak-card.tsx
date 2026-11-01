"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Flame } from "lucide-react";
import { MatchDetailRow, type MatchDetailItem } from "@/components/match-detail-row";

type Streak = { best: number; current: number; matches: MatchDetailItem[] };

const day = (iso: string, withYear = false) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });

/** The player's best win streak; tap it to see the matches behind it, with dates. Hidden until they win a match. */
export function WinStreakCard({ userId }: { userId: string }) {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/win-streak?userId=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then(setStreak);
  }, [userId]);

  if (!streak?.best) return null;
  const canOpen = streak.matches.length > 0;
  const first = streak.matches[0];
  const last = streak.matches.at(-1);
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
      <button type="button" onClick={() => canOpen && setOpen((current) => !current)} disabled={!canOpen} aria-expanded={open} className="flex w-full items-center gap-4 text-left disabled:cursor-default">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2e1f12] text-[#ff9a3c]"><Flame size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Best winning streak</p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-black tracking-[-.04em] text-[#ff9a3c]">{streak.best} win{streak.best === 1 ? "" : "s"}</span>
            <span className="text-xs text-[var(--ink-soft)]">{first && last ? (first.id === last.id ? day(first.playedAt, true) : `${day(first.playedAt)} – ${day(last.playedAt, true)}`) : "in a row"}{streak.current > 1 ? ` · on ${streak.current} now` : ""}</span>
          </p>
        </div>
        {canOpen && <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--lime-deep)]">{open ? "Hide" : "See matches"}<ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} /></span>}
      </button>
      {open && (
        <ol className="mt-4 divide-y divide-[var(--line)] rounded-2xl bg-[#131f19] px-4">
          {streak.matches.map((match, index) => (
            <MatchDetailRow key={match.id} match={match} marker={<span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2e1f12] text-[10px] font-black text-[#ff9a3c]">{index + 1}</span>} />
          ))}
        </ol>
      )}
    </section>
  );
}
