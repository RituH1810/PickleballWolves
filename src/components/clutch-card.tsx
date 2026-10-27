"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { CLOSE_GAME_MARGIN, CLUTCH_MIN_GAMES, type ClutchStats } from "@/lib/clutch";

const VERDICTS = {
  clutch: { label: "Clutch", hint: "wins close games more often than usual", className: "bg-[var(--lime)] text-[#0f1712]" },
  steady: { label: "Steady", hint: "close games go about like any other", className: "bg-[#1e2b17] text-[#c7e572]" },
  shaky: { label: "Room to grow", hint: "close games are tougher than usual", className: "bg-[#2e1a16] text-[#f2a08c]" },
};

/** How a player does when it's tight: close games, as the underdog, upsets and comebacks. */
export function ClutchCard({ userId }: { userId: string }) {
  const [stats, setStats] = useState<ClutchStats | null>(null);

  useEffect(() => {
    fetch(`/api/clutch?userId=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then(setStats);
  }, [userId]);

  if (!stats || !(stats.overall.wins + stats.overall.losses)) return null;
  const verdict = stats.verdict ? VERDICTS[stats.verdict] : null;
  const closeGames = stats.close.wins + stats.close.losses;
  const tiles: [string, string, string][] = [
    [`Close games (≤${CLOSE_GAME_MARGIN} pts)`, `${stats.close.wins}-${stats.close.losses}`, closeGames ? `${stats.close.winPct}% · ${stats.overall.winPct}% overall` : "None yet"],
    ["As the underdog", `${stats.underdog.wins}-${stats.underdog.losses}`, "Other side favored going in"],
    ["Upset wins", String(stats.upsetWins), "Won with a 40% chance or less"],
    ...(stats.comebacks.chances ? [["Comebacks", `${stats.comebacks.wins} of ${stats.comebacks.chances}`, "Won after dropping game 1"] as [string, string, string]] : []),
  ];
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="flex items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#131f19] text-[var(--lime-deep)]"><Timer size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Clutch stats</p>
          {verdict ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${verdict.className}`}>{verdict.label}</span><span className="text-xs text-[var(--ink-soft)]">{verdict.hint}</span></p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">Verdict after {CLUTCH_MIN_GAMES} close games ({closeGames} so far).</p>
          )}
        </div>
      </div>
      <div className={`mt-4 grid grid-cols-2 gap-2 ${tiles.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl bg-[#131f19] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ink-soft)]">{label}</p>
            <p className="mt-1 text-xl font-black tracking-[-.03em]">{value}</p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">{hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
