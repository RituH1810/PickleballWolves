"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { TOUGHEST_MIN_MEETINGS } from "@/lib/rivalry";

type Opponent = { userId: string; name: string; photoUrl: string | null; wins: number; losses: number; played: number; winRate: number; pointDiff: number };

/** The toughest opponent (lowest win rate against), with a tap-to-open record against everyone, best first. */
export function OpponentsCard({ userId, isMe = true }: { userId: string; isMe?: boolean }) {
  const [data, setData] = useState<{ toughest: Opponent | null; opponents: Opponent[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/opponents?userId=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then(setData);
  }, [userId]);

  if (!data?.opponents.length) return null;
  const { toughest } = data;
  const percent = (opponent: Opponent) => `${Math.round(opponent.winRate * 100)}%`;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="flex items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--danger-bg)] text-[var(--coral)]"><ShieldAlert size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">{isMe ? "Your toughest opponent" : "Toughest opponent"}</p>
          {toughest ? (
            <>
              <Link href={`/rivalry/${userId}/${toughest.userId}`} className="flex items-center gap-2 truncate text-base font-extrabold hover:text-[var(--lime-deep)]"><Avatar name={toughest.name} photoUrl={toughest.photoUrl} className="h-6 w-6 shrink-0 rounded-full bg-[var(--avatar-bg)] text-[9px] font-black text-[var(--lime)]" />{toughest.name}</Link>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{toughest.wins}-{toughest.losses} against · {percent(toughest)} wins · {toughest.pointDiff > 0 ? "+" : ""}{toughest.pointDiff} pts</p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">Shows after facing someone {TOUGHEST_MIN_MEETINGS} times.</p>
          )}
        </div>
      </div>

      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="mt-4 flex w-full items-center justify-between border-t border-[var(--line)] pt-3 text-xs font-bold text-[var(--lime-deep)]">
        {open ? "Hide" : `Record against all ${data.opponents.length} opponents`}<ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Best to worst · tap for the full rivalry</p>
          {data.opponents.map((opponent) => (
            <Link key={opponent.userId} href={`/rivalry/${userId}/${opponent.userId}`} className="flex items-center gap-3 text-sm hover:text-[var(--lime-deep)]">
              <Avatar name={opponent.name} photoUrl={opponent.photoUrl} className="h-6 w-6 shrink-0 rounded-full bg-[var(--avatar-bg)] text-[9px] font-black text-[var(--lime)]" />
              <span className="min-w-0 flex-1 truncate font-semibold">{opponent.name}</span>
              <span className="shrink-0 text-xs text-[var(--ink-soft)]">{opponent.wins}-{opponent.losses}</span>
              <span className={`w-10 shrink-0 text-right text-xs font-bold ${opponent.winRate >= 0.5 ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"}`}>{percent(opponent)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
