"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Winner = { userId: string; name: string; photoUrl: string | null; titles: number; rank: number };

const MEDALS = ["text-[var(--lime-deep)]", "text-[#c7d0d8]", "text-[#d69a63]"];

/** The group's top three round robin winners by titles won. Hidden until a round robin has a champion. */
export function RoundRobinWinners({ groupId }: { groupId: string }) {
  const [winners, setWinners] = useState<Winner[] | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/round-robin-winners`).then((response) => response.ok ? response.json() : null).then((data) => setWinners(data?.winners ?? []));
  }, [groupId]);

  if (!winners?.length) return null;
  return (
    <section id="round-robin-winners" className="mt-5 scroll-mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Crown size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Most round robin wins</h2></div><Link href={`/groups/${groupId}/hall-of-fame`} className="text-xs font-bold text-[var(--lime-deep)] hover:underline">Hall of Fame</Link></div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">All-time titles in this group · co-champions each get the title</p>
      <div className="mt-4 space-y-2">
        {winners.map((winner) => (
          <Link key={winner.userId} href={`/players/${winner.userId}`} className="flex items-center gap-3 rounded-2xl bg-[#131f19] p-3 text-sm hover:text-[var(--lime-deep)]">
            <span className={`w-5 shrink-0 text-center text-base font-black ${MEDALS[winner.rank - 1]}`}>{winner.rank}</span>
            <Avatar name={winner.name} photoUrl={winner.photoUrl} className="h-9 w-9 shrink-0 rounded-full bg-[#22331f] text-xs font-black text-[var(--lime)]" />
            <span className="min-w-0 flex-1 truncate font-bold">{winner.name}</span>
            <span className="shrink-0 text-xs font-bold text-[var(--lime-deep)]">{winner.titles} {winner.titles === 1 ? "win" : "wins"}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
