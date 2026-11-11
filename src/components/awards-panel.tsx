"use client";

import { useEffect, useState } from "react";
import { Medal } from "lucide-react";
import { CardHeading } from "@/components/card-heading";

type MonthlyAward = { id: string; award: string; title: string; month: string; groupName: string; detail: string };

const AWARD_STYLES: Record<string, string> = { IRON_WOLF: "bg-[#8cc9df] text-[var(--ink-dark)]", MOST_IMPROVED: "bg-[var(--lime)] text-[var(--ink-dark)]", BEST_PARTNERSHIP: "bg-[#f17e62] text-[var(--on-coral)]", PLAYER_OF_THE_WEEK: "bg-[#f4c430] text-[var(--ink-dark)]" };

/** Monthly awards the player has won. Hidden until they win one. Omit userId for the signed-in player. */
export function AwardsPanel({ userId }: { userId?: string }) {
  const [awards, setAwards] = useState<MonthlyAward[]>([]);

  useEffect(() => {
    fetch(userId ? `/api/awards?userId=${encodeURIComponent(userId)}` : "/api/awards").then((response) => response.ok ? response.json() : null).then((data) => setAwards(data?.awards ?? []));
  }, [userId]);

  if (!awards.length) return null;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <CardHeading icon={Medal} title="Awards" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {awards.map((award) => (
          <div key={award.id} className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${AWARD_STYLES[award.award] ?? "bg-[var(--surface-hover)] text-[var(--lime-deep)]"}`}><Medal size={18} /></span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold">{award.title}</p>
              <p className="truncate text-xs text-[var(--ink-soft)]">{award.groupName} · {award.month}</p>
              <p className="truncate text-xs text-[var(--ink-soft)]">{award.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
