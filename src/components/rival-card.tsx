"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Swords } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Rival = { userId: string; name: string; photoUrl: string | null; wins: number; losses: number; played: number };

/** "Your rival": the opponent this player has faced most, linking to the full rivalry. */
export function RivalCard({ userId, isMe = true, playerName }: { userId: string; isMe?: boolean; playerName?: string }) {
  const [rival, setRival] = useState<Rival | null>(null);

  useEffect(() => {
    fetch(`/api/rivalry/top?userId=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then((data) => setRival(data?.rival ?? null));
  }, [userId]);

  if (!rival) return null;
  const who = isMe ? "You" : (playerName ?? "They").split(" ")[0];
  const verdict = rival.wins === rival.losses ? "dead even" : rival.wins > rival.losses ? `${who} lead${isMe ? "" : "s"}` : `${rival.name.split(" ")[0]} leads`;
  return (
    <Link href={`/rivalry/${userId}/${rival.userId}`} className="mt-5 flex items-center gap-4 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 transition-colors hover:border-[var(--lime-deep)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#131f19] text-[var(--lime-deep)]"><Swords size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{isMe ? "Your rival" : "Biggest rival"}</p>
        <p className="flex items-center gap-2 truncate text-base font-extrabold"><Avatar name={rival.name} photoUrl={rival.photoUrl} className="h-6 w-6 shrink-0 rounded-full bg-[#22331f] text-[9px] font-black text-[var(--lime)]" />{rival.name}</p>
        <p className="mt-0.5 text-xs text-[var(--ink-soft)]">Faced {rival.played} times · {rival.wins}-{rival.losses} · {verdict}</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-[var(--ink-soft)]" />
    </Link>
  );
}
