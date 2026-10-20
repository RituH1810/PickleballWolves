"use client";

import { useEffect, useState } from "react";
import { Medal } from "lucide-react";

type MonthlyAward = { id: string; award: string; title: string; month: string; groupName: string; detail: string };

const AWARD_STYLES: Record<string, string> = { IRON_WOLF: "bg-[#8cc9df] text-[#1b211e]", MOST_IMPROVED: "bg-[#d8f24e] text-[#1b211e]", BEST_PARTNERSHIP: "bg-[#f17e62] text-[#2e1a16]", PLAYER_OF_THE_WEEK: "bg-[#f4c430] text-[#1b211e]" };

/** Monthly awards the player has won. Hidden until they win one. Omit userId for the signed-in player. */
export function AwardsPanel({ userId }: { userId?: string }) {
  const [awards, setAwards] = useState<MonthlyAward[]>([]);

  useEffect(() => {
    fetch(userId ? `/api/awards?userId=${encodeURIComponent(userId)}` : "/api/awards").then((response) => response.ok ? response.json() : null).then((data) => setAwards(data?.awards ?? []));
  }, [userId]);

  if (!awards.length) return null;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center gap-2"><Medal size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Awards</h2></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {awards.map((award) => (
          <div key={award.id} className="flex items-center gap-3 rounded-2xl bg-[#131f19] p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${AWARD_STYLES[award.award] ?? "bg-[#1c2a1a] text-[var(--lime-deep)]"}`}><Medal size={18} /></span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold">{award.title}</p>
              <p className="truncate text-xs text-[var(--ink-soft)]">{award.groupName} · {award.month}</p>
              <p className="truncate text-[11px] text-[var(--ink-soft)]">{award.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
