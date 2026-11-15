"use client";

import { useEffect } from "react";
import { PickleIcon } from "@/components/pickle-icon";

export type PickleMoment = { winners: string[]; losers: string[]; winnerScore: number; iServed: boolean | null };

const SHOWN_MS = 4200;
// Fixed positions so the shower looks the same on every render (no hydration surprises).
const RAIN = [6, 14, 23, 31, 40, 48, 57, 65, 74, 82, 90, 96].map((left, index) => ({ left, delay: (index % 5) * 0.22, duration: 1.8 + (index % 4) * 0.35, size: 22 + (index % 3) * 10, spin: index % 2 ? 1 : -1 }));

/** Full-screen "PICKLED!" splash for an 11-0 game. Tap anywhere or press Escape to close; it also closes itself. */
export function PickleCelebration({ moment, onClose }: { moment: PickleMoment; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, SHOWN_MS);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const headline = moment.iServed === true ? "You served a pickle!" : moment.iServed === false ? "You got pickled." : "Pickle served!";
  return (
    <div role="alertdialog" aria-label={`Pickled! ${moment.winners.join(" & ")} won ${moment.winnerScore}-0`} onClick={onClose} className="pickle-backdrop fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-black/70 px-6 backdrop-blur-sm">
      {RAIN.map((drop, index) => (
        <span key={index} className="pickle-drop pointer-events-none absolute -top-16 text-[var(--lime)]" style={{ left: `${drop.left}%`, animationDelay: `${drop.delay}s`, animationDuration: `${drop.duration}s`, ["--spin" as string]: drop.spin }}>
          <PickleIcon size={drop.size} strokeWidth={1.6} />
        </span>
      ))}
      <div className="pickle-pop relative max-w-sm rounded-[28px] border-2 border-[var(--lime)] bg-[var(--panel)] px-8 py-9 text-center shadow-2xl">
        <div className="pickle-wobble mx-auto grid h-24 w-24 place-items-center rounded-full bg-[var(--lime)] text-[var(--on-lime)]"><PickleIcon size={58} strokeWidth={1.8} /></div>
        <p className="mt-5 text-5xl font-black tracking-[-.05em] text-[var(--lime)]">PICKLED!</p>
        <p className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">{moment.winnerScore}<span className="text-[var(--ink-soft)]">-</span>0</p>
        <p className="mt-4 text-sm font-extrabold text-[var(--foreground)]">{headline}</p>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">{moment.winners.join(" & ")} kept {moment.losers.join(" & ") || "the other side"} off the scoreboard.{moment.iServed === false ? " Shake it off -- next game is a fresh jar." : ""}</p>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Tap to close</p>
      </div>
    </div>
  );
}
