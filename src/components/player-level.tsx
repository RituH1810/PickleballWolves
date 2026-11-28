"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { CardHeading } from "@/components/card-heading";
import { LEVEL_TITLES, REACTION_XP_PER_DAY, XP_RULES } from "@/lib/xp";

type Xp = { total: number; level: number; title: string; intoLevel: number; levelSize: number; toNext: number; progress: number; sources: { id: string; label: string; count: number; xp: number }[] };

function useXp(userId?: string) {
  const [xp, setXp] = useState<Xp | null>(null);
  useEffect(() => {
    fetch(`/api/xp${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`).then((response) => response.ok ? response.json() : null).then((data) => setXp(data?.xp ?? null));
  }, [userId]);
  return xp;
}

/** "Lv 7 · Hunter" next to a player's name. */
export function LevelChip({ userId }: { userId: string }) {
  const xp = useXp(userId);
  if (!xp) return null;
  return (
    <span title={`${xp.total.toLocaleString()} XP · ${xp.toNext.toLocaleString()} to level ${xp.level + 1}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--lime-deep)] bg-[var(--success-bg)] px-2.5 py-1 text-xs font-black text-[var(--success-ink)]">
      <Sparkles size={12} aria-hidden />Lv {xp.level} · {xp.title}
    </span>
  );
}

const EARN_LINES = [
  `+${XP_RULES.match} each match played, +${XP_RULES.win} more for a win`,
  `+${XP_RULES.night} each round robin night, +${XP_RULES.title} for a title`,
  `+${XP_RULES.badge.bronze} / ${XP_RULES.badge.silver} / ${XP_RULES.badge.gold} for bronze / silver / gold badges`,
  `+${XP_RULES.pickle} each pickle (shutout win)`,
  `+${XP_RULES.goodWolfWin} for a Good Wolf award, +${XP_RULES.goodWolfVote} for each vote you cast`,
  `+${XP_RULES.reaction} per reaction (up to ${REACTION_XP_PER_DAY} a day)`,
];

/** The dashboard's level card: level and title, progress to the next level, and where the XP came from. */
export function LevelCard() {
  const xp = useXp();
  const [open, setOpen] = useState(false);
  if (!xp) return null;
  const nextTitle = LEVEL_TITLES.find((entry) => entry.from > xp.level);
  return (
    <section className="panel mt-6 rounded-[20px] p-5">
      <CardHeading icon={Sparkles} title="Your level" />
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p><span className="text-3xl font-black tracking-[-.04em]">Level {xp.level}</span> <span className="text-sm font-bold text-[var(--lime-deep)]">{xp.title}</span></p>
        <p className="text-xs text-[var(--ink-soft)]">{xp.total.toLocaleString()} XP</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]" role="progressbar" aria-valuenow={Math.floor(xp.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to level ${xp.level + 1}`}>
        <div className="h-full rounded-full bg-[var(--lime)]" style={{ width: `${Math.max(3, xp.progress * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-[var(--ink-soft)]">{xp.toNext.toLocaleString()} XP to level {xp.level + 1}{nextTitle && nextTitle.from === xp.level + 1 ? ` -- you'll become ${nextTitle.title}` : nextTitle ? ` · ${nextTitle.title} at level ${nextTitle.from}` : ""}</p>
      {xp.sources.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {xp.sources.slice(0, 4).map((source) => (
            <li key={source.id} className="flex justify-between gap-3"><span className="text-[var(--ink-soft)]">{source.label} <span className="font-semibold">×{source.count}</span></span><span className="font-bold">{source.xp.toLocaleString()} XP</span></li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--lime-deep)]">How to earn XP<ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} /></button>
      {open && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-[var(--ink-soft)]">{EARN_LINES.map((line) => <li key={line}>{line}</li>)}</ul>}
    </section>
  );
}
