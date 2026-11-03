"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import type { Goal } from "@/lib/almost-there";

/** The dashboard's nearest goals with progress bars. Hidden when nothing is close. */
export function AlmostThere() {
  const [goals, setGoals] = useState<Goal[] | null>(null);

  useEffect(() => {
    fetch("/api/almost-there").then((response) => response.ok ? response.json() : null).then((data) => setGoals(data?.goals ?? []));
  }, []);

  if (!goals?.length) return null;
  return (
    <section className="panel mt-6 rounded-2xl p-5">
      <div className="flex items-center gap-2"><Target size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Almost there</h2></div>
      <ul className="mt-4 space-y-3">
        {goals.map((goal) => {
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold">{goal.label}</p>
                <span className="shrink-0 text-[11px] font-black text-[var(--lime-deep)]">{Math.floor(goal.progress * 100)}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#131f19]" role="progressbar" aria-valuenow={Math.floor(goal.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={goal.label}>
                <div className="h-full rounded-full bg-[var(--lime)]" style={{ width: `${Math.max(4, goal.progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{goal.detail}</p>
            </>
          );
          return <li key={goal.id}>{goal.href ? <Link href={goal.href} className="block rounded-xl hover:opacity-90">{body}</Link> : body}</li>;
        })}
      </ul>
    </section>
  );
}
