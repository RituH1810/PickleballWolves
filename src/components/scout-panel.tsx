"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FormDots, streakText } from "@/components/form-dots";
import type { FormResult } from "@/lib/form";

type Record = { wins: number; losses: number };
type Report = { userId: string; name: string; photoUrl: string | null; rating: number; results: FormResult[]; streak: { result: FormResult; length: number } | null; clutch: "clutch" | "steady" | "shaky" | null; withViewer: { against: Record; together: Record } | null };

const CLUTCH_LABELS = { clutch: "Clutch", steady: "Steady", shaky: "Room to grow" };

/** A pre-match scouting report for everyone in a match: rating, form, clutch label and your history with them. */
export function ScoutPanel({ players }: { players: { userId: string; side: "A" | "B" }[] }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const ids = players.map((player) => player.userId).join(",");

  useEffect(() => {
    fetch(`/api/scout?ids=${encodeURIComponent(ids)}`).then((response) => response.ok ? response.json() : null).then((data) => setReports(data?.players ?? []));
  }, [ids]);

  if (!reports) return <div className="skeleton mt-3 h-24 rounded-xl" />;
  const bySide = (side: "A" | "B") => players.filter((player) => player.side === side).map((player) => reports.find((report) => report.userId === player.userId)).filter((report): report is Report => Boolean(report));
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-[#131f19] p-3">
      {(["A", "B"] as const).map((side) => (
        <div key={side} className="space-y-2">
          {bySide(side).map((report) => {
            const run = streakText(report.streak);
            const history = report.withViewer;
            return (
              <div key={report.userId} className="flex items-start gap-2.5">
                <Avatar name={report.name} photoUrl={report.photoUrl} className="h-8 w-8 shrink-0 rounded-full bg-[#22331f] text-[10px] font-black text-[var(--lime)]" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold">
                    <Link href={`/players/${report.userId}`} className="truncate hover:text-[var(--lime-deep)] hover:underline">{report.name}</Link>
                    <span className="font-semibold text-[var(--ink-soft)]">{report.rating.toFixed(3)}</span>
                    {report.clutch && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${report.clutch === "clutch" ? "bg-[var(--lime)] text-[#0f1712]" : report.clutch === "shaky" ? "bg-[var(--coral)] text-[#2e1a16]" : "border border-[var(--lime-deep)] text-[#c7e572]"}`}>{CLUTCH_LABELS[report.clutch]}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {report.results.length ? <FormDots results={report.results} size="sm" /> : <span className="text-[11px] text-[var(--ink-soft)]">No results yet</span>}
                    {run && <span className={`text-[11px] font-bold ${report.streak!.result === "W" ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"}`}>{run}</span>}
                  </div>
                  {history && (history.against.wins + history.against.losses + history.together.wins + history.together.losses > 0) && (
                    <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
                      {history.against.wins + history.against.losses > 0 && <>You vs them: <span className="font-bold text-[var(--foreground)]">{history.against.wins}-{history.against.losses}</span></>}
                      {history.against.wins + history.against.losses > 0 && history.together.wins + history.together.losses > 0 && " · "}
                      {history.together.wins + history.together.losses > 0 && <>Together: <span className="font-bold text-[var(--foreground)]">{history.together.wins}-{history.together.losses}</span></>}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {side === "A" && <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">vs</p>}
        </div>
      ))}
    </div>
  );
}
