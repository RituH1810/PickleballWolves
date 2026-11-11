"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";

type Title = { roundRobinId: string; name: string; endedAt: string; groupName: string | null; wins: number; losses: number; sharedWith: string[] };

/** Every round robin the player has won, newest first, on a timeline. Hidden until they win one. Omit userId for the signed-in player. */
export function TitleTimeline({ userId }: { userId?: string }) {
  const [titles, setTitles] = useState<Title[]>([]);

  useEffect(() => {
    fetch(userId ? `/api/titles?userId=${encodeURIComponent(userId)}` : "/api/titles").then((response) => response.ok ? response.json() : null).then((data) => setTitles(data?.titles ?? []));
  }, [userId]);

  if (!titles.length) return null;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Crown size={17} className="text-[#f5c542]" /><h2 className="font-extrabold">Title timeline</h2></div>
        <p className="text-xs font-bold text-[var(--ink-soft)]"><span className="text-lg font-black text-[#f5c542]">{titles.length}</span> round robin title{titles.length === 1 ? "" : "s"}</p>
      </div>
      <ol className="mt-4">
        {titles.map((title, index) => (
          <li key={title.roundRobinId} className="relative flex gap-3 pb-3 last:pb-0">
            {/* The line joining each title to the next one down. */}
            {index < titles.length - 1 && <span aria-hidden className="absolute bottom-0 left-4 top-8 w-0.5 -translate-x-1/2 bg-[#f5c542]/30" />}
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f5c542] text-[var(--ink-dark)]"><Crown size={15} /></span>
            <Link href={`/round-robin/${title.roundRobinId}`} className="min-w-0 flex-1 rounded-2xl bg-[var(--surface-2)] px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-extrabold">{title.name}</p>
                <p className="shrink-0 text-xs font-bold text-[var(--ink-soft)]">{new Date(title.endedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
              <p className="truncate text-xs text-[var(--ink-soft)]">{title.groupName ?? "Round robin"} · {title.wins}-{title.losses}{title.sharedWith.length > 0 ? ` · shared with ${title.sharedWith.join(", ")}` : ""}</p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
