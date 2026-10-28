"use client";

import { useEffect, useState } from "react";
import type { FormResult } from "@/lib/form";

/** Recent results as W/L dots, newest on the left. Nothing while there are no results. */
export function FormDots({ results, size = "md" }: { results: FormResult[]; size?: "sm" | "md" }) {
  if (!results.length) return null;
  const dot = size === "sm" ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]";
  return (
    <span className="inline-flex items-center gap-1" title={`Last ${results.length}, newest first: ${results.join(" ")}`} aria-label={`Last ${results.length} results, newest first: ${results.map((result) => (result === "W" ? "win" : "loss")).join(", ")}`}>
      {results.map((result, index) => (
        <span key={index} aria-hidden className={`grid place-items-center rounded-full font-black ${dot} ${result === "W" ? "bg-[var(--lime)] text-[#0f1712]" : "bg-[var(--coral)] text-[#2e1a16]"}`}>{result}</span>
      ))}
    </span>
  );
}

/** "Current run: 3 wins in a row" style text for a streak. */
export function streakText(streak: { result: FormResult; length: number } | null) {
  if (!streak || streak.length < 2) return null;
  return `${streak.length} ${streak.result === "W" ? "wins" : "losses"} in a row`;
}

/** A player's form guide (last five results and current run), loaded on its own for profile pages. */
export function FormGuide({ userId }: { userId: string }) {
  const [form, setForm] = useState<{ results: FormResult[]; streak: { result: FormResult; length: number } | null } | null>(null);

  useEffect(() => {
    fetch(`/api/scout?ids=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then((data) => setForm(data?.players?.[0] ?? null));
  }, [userId]);

  if (!form?.results.length) return null;
  const run = streakText(form.streak);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <FormDots results={form.results} size="sm" />
      {run && <span className={`text-[11px] font-bold ${form.streak!.result === "W" ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"}`}>{run}</span>}
    </div>
  );
}
