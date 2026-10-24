"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Handshake } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PARTNER_MIN_MATCHES } from "@/lib/partners";

type Partner = { userId: string; name: string; photoUrl: string | null; wins: number; losses: number; played: number; winRate: number; pointDiff: number };

/** Partner chemistry: the best partner by win rate, plus the record with each most-played partner. */
export function PartnerCard({ userId, isMe = true }: { userId: string; isMe?: boolean }) {
  const [data, setData] = useState<{ best: Partner | null; partners: Partner[] } | null>(null);

  useEffect(() => {
    fetch(`/api/partners?userId=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then(setData);
  }, [userId]);

  if (!data?.partners.length) return null;
  const { best } = data;
  const percent = (partner: Partner) => `${Math.round(partner.winRate * 100)}%`;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="flex items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#131f19] text-[var(--lime-deep)]"><Handshake size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{isMe ? "Your best partner" : "Best partner"}</p>
          {best ? (
            <>
              <Link href={`/players/${best.userId}`} className="flex items-center gap-2 truncate text-base font-extrabold hover:text-[var(--lime-deep)]"><Avatar name={best.name} photoUrl={best.photoUrl} className="h-6 w-6 shrink-0 rounded-full bg-[#22331f] text-[9px] font-black text-[var(--lime)]" />{best.name}</Link>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{best.wins}-{best.losses} together · {percent(best)} wins · {best.pointDiff > 0 ? "+" : ""}{best.pointDiff} pts</p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">Unlocks after {PARTNER_MIN_MATCHES} scored matches with the same partner.</p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Most played with</p>
        {data.partners.slice(0, 5).map((partner) => (
          <Link key={partner.userId} href={`/players/${partner.userId}`} className="flex items-center gap-3 text-sm hover:text-[var(--lime-deep)]">
            <Avatar name={partner.name} photoUrl={partner.photoUrl} className="h-6 w-6 shrink-0 rounded-full bg-[#22331f] text-[9px] font-black text-[var(--lime)]" />
            <span className="min-w-0 flex-1 truncate font-semibold">{partner.name}</span>
            <span className="shrink-0 text-xs text-[var(--ink-soft)]">{partner.wins}-{partner.losses}</span>
            <span className={`w-10 shrink-0 text-right text-xs font-bold ${partner.winRate >= 0.5 ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"}`}>{percent(partner)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
