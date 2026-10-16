"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, TrendingUp } from "lucide-react";
import type { Tip } from "@/lib/daily-tip";

const SEEN_KEY = "pw:dailyTipSeen";

function seenToday(dateKey: string) {
  try { return window.localStorage.getItem(SEEN_KEY) === dateKey; } catch { return false; }
}

function markSeen(dateKey: string) {
  try { window.localStorage.setItem(SEEN_KEY, dateKey); } catch { /* private mode: it just shows again next visit */ }
}

/**
 * Today's tip, shown once a day the first time the player opens the dashboard. "Got it" hides it
 * until tomorrow (remembered in this browser).
 */
export function DailyTip() {
  const [state, setState] = useState<{ tip: Tip; dateKey: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch("/api/tips/today").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.tip && !seenToday(data.dateKey)) setState(data);
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    buttonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function dismiss() {
    if (state) markSeen(state.dateKey);
    setState(null);
  }

  if (!state) return null;
  const { tip } = state;
  const personal = tip.kind === "insight";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5" onClick={dismiss}>
      <div role="dialog" aria-modal="true" aria-labelledby="daily-tip-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_18px_50px_rgba(0,0,0,.45)]">
        <div className="bg-[var(--lime)] px-6 py-4 text-[#0f1712]">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em]">{personal ? <TrendingUp size={15} /> : <Lightbulb size={15} />}{personal ? "Today's tip, from your games" : "Today's tip"}</p>
        </div>
        <div className="p-6">
          <h2 id="daily-tip-title" className="text-xl font-black tracking-[-.02em] text-[var(--foreground)]">{tip.title}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{tip.body}</p>
          <button ref={buttonRef} onClick={dismiss} className="mt-6 h-11 w-full rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">Got it</button>
          <p className="mt-3 text-center text-[11px] text-[var(--ink-soft)]">A new tip tomorrow.</p>
        </div>
      </div>
    </div>
  );
}
