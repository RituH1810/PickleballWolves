"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Crown, Flame, Handshake, Swords, Target, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { playerRecapHeadline, type PlayerRecap } from "@/lib/round-robin-recap";

type RecentRecap = { roundRobinId: string; name: string; groupName: string | null; completedAt: string; expiresAt: string; recap: PlayerRecap };
type Ref = { userId: string; name: string };

function names(players: Ref[]) {
  return players.map((player) => player.name).join(" & ");
}

function hoursLeft(expiresAt: string) {
  const hours = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
  return `${hours}h left`;
}

function Stat({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#131f19] p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]"><Icon size={13} className="text-[var(--lime-deep)]" />{label}</p>
      <div className="mt-1.5 text-sm font-bold leading-5 text-[var(--foreground)]">{children}</div>
    </div>
  );
}

/**
 * The player's own recap for each round robin that ended in the last 24 hours -- where they
 * finished, how they played, and who with/against. Disappears on its own once the day is up.
 */
export function MyRecaps() {
  const [recaps, setRecaps] = useState<RecentRecap[]>([]);

  useEffect(() => {
    fetch("/api/recaps").then((response) => response.ok ? response.json() : null).then((data) => setRecaps(data?.recaps ?? []));
  }, []);

  if (!recaps.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold tracking-tight">Your recap</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">How you played. Available for 24 hours after a round robin ends.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {recaps.map(({ roundRobinId, name, expiresAt, recap }) => (
          <article key={roundRobinId} className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--panel)]">
            <div className={`p-5 ${recap.champion ? "bg-[var(--lime)] text-[#0f1712]" : "bg-[#1b2a20]"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className={`truncate text-xs font-bold ${recap.champion ? "text-[#3c4a1e]" : "text-[var(--ink-soft)]"}`}>{name}</p>
                <span className={`shrink-0 text-[10px] font-bold ${recap.champion ? "text-[#3c4a1e]" : "text-[var(--ink-soft)]"}`}>{hoursLeft(expiresAt)}</span>
              </div>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black tracking-[-.03em]">{recap.champion && <Crown size={20} />}{playerRecapHeadline(recap).split(" · ")[0]}</p>
              <p className={`mt-1 text-sm font-bold ${recap.champion ? "text-[#3c4a1e]" : "text-[var(--ink-soft)]"}`}>
                {recap.wins}-{recap.losses} ({recap.winPct}%) · {recap.scored} scored, {recap.conceded} against ({recap.differential > 0 ? "+" : ""}{recap.differential})
              </p>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {recap.ratingChange !== null && (
                <Stat icon={recap.ratingChange >= 0 ? TrendingUp : TrendingDown} label="Rating change">
                  <span className={recap.ratingChange > 0 ? "text-[var(--lime-deep)]" : recap.ratingChange < 0 ? "text-[var(--coral)]" : ""}>{recap.ratingChange > 0 ? "+" : recap.ratingChange < 0 ? "−" : "±"}{Math.abs(recap.ratingChange).toFixed(2)}</span>
                </Stat>
              )}
              {recap.bestPartner && <Stat icon={Handshake} label="Best partner"><Link href={`/players/${recap.bestPartner.userId}`} className="hover:text-[var(--lime-deep)] hover:underline">{recap.bestPartner.name}</Link> <span className="text-xs text-[var(--ink-soft)]">{recap.bestPartner.wins}-{recap.bestPartner.losses} together</span></Stat>}
              {recap.toughestOpponent && <Stat icon={Swords} label="Toughest opponent"><Link href={`/players/${recap.toughestOpponent.userId}`} className="hover:text-[var(--lime-deep)] hover:underline">{recap.toughestOpponent.name}</Link> <span className="text-xs text-[var(--ink-soft)]">you went {recap.toughestOpponent.wins}-{recap.toughestOpponent.losses}</span></Stat>}
              {recap.bestWin && <Stat icon={Flame} label="Best win"><span className="text-[var(--lime-deep)]">{recap.bestWin.winnerScore}-{recap.bestWin.loserScore}</span> <span className="text-xs text-[var(--ink-soft)]">over {names(recap.bestWin.losers)}</span></Stat>}
              {recap.closestGame && <Stat icon={Target} label="Closest game"><span className={recap.closestGame.won ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"}>{recap.closestGame.won ? "Won" : "Lost"} {recap.closestGame.won ? `${recap.closestGame.winnerScore}-${recap.closestGame.loserScore}` : `${recap.closestGame.loserScore}-${recap.closestGame.winnerScore}`}</span> <span className="text-xs text-[var(--ink-soft)]">vs {names(recap.closestGame.won ? recap.closestGame.losers : recap.closestGame.winners)}</span></Stat>}
            </div>
            <Link href={`/round-robin/${roundRobinId}`} className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3 text-xs font-bold text-[var(--lime-deep)] hover:bg-[#1c2a1a]">Full round robin recap<ChevronRight size={15} /></Link>
          </article>
        ))}
      </div>
    </section>
  );
}
