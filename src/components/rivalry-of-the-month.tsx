"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Person = { userId: string; name: string; photoUrl: string | null };
type Rivalry = { a: string; b: string; aWins: number; bWins: number; meetings: number; month: string; isCurrent: boolean; playerA: Person; playerB: Person; last: { winner: string; score: [number, number]; playedAt: string } };

const firstName = (name: string) => name.split(" ")[0];

/** The group's closest head-to-head of the month. Hidden until two players have met enough. */
export function RivalryOfTheMonth({ groupId }: { groupId: string }) {
  const [rivalry, setRivalry] = useState<Rivalry | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/rivalry-of-the-month`).then((response) => response.ok ? response.json() : null).then((data) => setRivalry(data?.rivalry ?? null));
  }, [groupId]);

  if (!rivalry) return null;
  const { playerA, playerB } = rivalry;
  const lastWinner = rivalry.last.winner === playerA.userId ? playerA : playerB;
  const tied = rivalry.aWins === rivalry.bWins;
  const leader = rivalry.aWins > rivalry.bWins ? playerA : playerB;
  const side = (person: Person, wins: number) => (
    <Link href={`/players/${person.userId}`} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center hover:opacity-90">
      <Avatar name={person.name} photoUrl={person.photoUrl} className="h-14 w-14 rounded-2xl bg-[#22331f] text-lg font-black text-[var(--lime)]" />
      <span className="w-full truncate text-sm font-extrabold">{person.name}</span>
      <span className="text-3xl font-black tracking-[-.04em] text-[var(--lime)]">{wins}</span>
    </Link>
  );
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><Swords size={15} className="text-[var(--coral)]" />Rivalry of the month · {rivalry.month}</p>
      <div className="mt-4 flex items-center gap-3">
        {side(playerA, rivalry.aWins)}
        <span className="text-xs font-black uppercase tracking-[.14em] text-[var(--ink-soft)]">vs</span>
        {side(playerB, rivalry.bWins)}
      </div>
      <p className="mt-4 text-center text-sm text-[var(--ink-soft)]">
        {rivalry.meetings} meetings {rivalry.isCurrent ? "this month" : `in ${rivalry.month.split(" ")[0]}`} · {tied ? "dead even" : `${firstName(leader.name)} leads by ${Math.abs(rivalry.aWins - rivalry.bWins)}`}. Last time {firstName(lastWinner.name)} won {rivalry.last.score[0]}-{rivalry.last.score[1]}.
      </p>
      <p className="mt-1 text-center text-sm font-extrabold">Who takes the next one?</p>
      <Link href={`/rivalry/${playerA.userId}/${playerB.userId}`} className="mt-3 block text-center text-xs font-bold text-[var(--lime-deep)] hover:underline">Full head-to-head →</Link>
    </section>
  );
}
