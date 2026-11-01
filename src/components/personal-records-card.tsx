"use client";

import { useEffect, useState } from "react";
import { Gauge, Medal, Moon, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { MatchDetailRow, type MatchDetailItem } from "@/components/match-detail-row";

type PersonalRecord = { key: string; label: string; value: string; detail: string; at: string; matches: MatchDetailItem[] };

const ICONS: Record<string, LucideIcon> = { biggestWin: Zap, bestNight: Moon, longestMatch: Gauge, ratingJump: TrendingUp };

/** Personal bests; tap one to see the match (or night) behind it. Hidden until the player has a scored match. */
export function PersonalRecordsCard({ userId, isMe = true }: { userId: string; isMe?: boolean }) {
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/personal-records?userId=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then((data) => setRecords(data?.records ?? []));
  }, [userId]);

  if (!records.length) return null;
  const open = records.find((record) => record.key === openKey) ?? null;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{isMe ? "Your personal records" : "Personal records"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {records.map((record) => {
          const Icon = ICONS[record.key] ?? Medal;
          const canOpen = record.matches.length > 0;
          return (
            <button key={record.key} type="button" disabled={!canOpen} onClick={() => setOpenKey((current) => (current === record.key ? null : record.key))} aria-expanded={openKey === record.key} className={`rounded-2xl border bg-[#131f19] p-3 text-left transition-colors disabled:cursor-default ${openKey === record.key ? "border-[var(--lime-deep)]" : "border-transparent"} ${canOpen ? "hover:border-[var(--lime-deep)]" : ""}`}>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ink-soft)]"><Icon size={12} className="text-[var(--lime-deep)]" />{record.label}</p>
              <p className="mt-1 text-xl font-black tracking-[-.03em] text-[var(--lime)]">{record.value}</p>
              <p className="truncate text-[11px] text-[var(--ink-soft)]">{record.detail}</p>
              <p className="text-[11px] text-[var(--ink-soft)]">{new Date(record.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
            </button>
          );
        })}
      </div>
      {open && (
        <ol className="mt-3 divide-y divide-[var(--line)] rounded-2xl bg-[#131f19] px-4">
          {open.matches.map((match) => {
            const won = match.scores.reduce((total, [mine, theirs]) => total + mine - theirs, 0) > 0;
            return <MatchDetailRow key={match.id} match={match} marker={<span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${won ? "bg-[#1c2a1a] text-[var(--lime)]" : "bg-[#2e1a16] text-[var(--coral)]"}`}>{won ? "W" : "L"}</span>} />;
          })}
        </ol>
      )}
    </section>
  );
}
