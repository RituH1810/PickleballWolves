"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Crown, Dices, Flame, Swords, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { BragButton } from "@/components/brag-button";
import { recapShareText, type Recap } from "@/lib/round-robin-recap";

type PlayerRef = { userId: string; name: string };

function Names({ players }: { players: PlayerRef[] }) {
  return <>{players.map((player, index) => <span key={player.userId}>{index > 0 && " & "}<Link href={`/players/${player.userId}`} className="hover:text-[var(--lime-deep)] hover:underline">{player.name}</Link></span>)}</>;
}

function Highlight({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#131f19] p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]"><Icon size={13} className="text-[var(--lime-deep)]" />{label}</p>
      <div className="mt-2 text-sm font-bold leading-5 text-[var(--foreground)]">{children}</div>
    </div>
  );
}

/** Shown on a completed round robin: champion, podium, and the night's highlights. */
export function RoundRobinRecap({ roundRobinId, name, played = false }: { roundRobinId: string; name: string; played?: boolean }) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/round-robin/${roundRobinId}/recap`).then((response) => response.ok ? response.json() : null).then((data) => setRecap(data?.recap ?? null));
  }, [roundRobinId]);

  if (!recap) return null;
  const shareText = () => recapShareText(name, recap, `${window.location.origin}/round-robin/${roundRobinId}`);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked -- WhatsApp button still works */ }
  }

  const [first] = recap.champions;
  const shareButton = "flex h-10 items-center gap-2 rounded-full px-4 text-xs font-bold transition-colors";
  return (
    <section className="mt-6 overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--panel)]">
      <div className="bg-[var(--lime)] p-6 text-[#0f1712] sm:p-8">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em]"><Crown size={16} />{recap.champions.length > 1 ? "Co-champions" : "Champion"}</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">
          {recap.champions.map((entry, index) => <span key={entry.userId}>{index > 0 && ", "}<Link href={`/players/${entry.userId}`} className="hover:underline">{entry.name}</Link></span>)}
        </h2>
        <p className="mt-2 text-sm font-bold text-[#3c4a1e]">{first.wins}-{first.losses} · {first.differential > 0 ? "+" : ""}{first.differential} point differential{recap.undefeated && " · undefeated"}</p>
      </div>

      <div className="p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Podium</h3>
            <ol className="mt-3 space-y-2">
              {recap.podium.map((entry) => (
                <li key={entry.userId} className="flex items-center gap-3 rounded-xl bg-[#131f19] px-3 py-2.5">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${entry.rank === 1 ? "bg-[var(--lime)] text-[#0f1712]" : entry.rank === 2 ? "bg-[#c7d0d8] text-[#1b211e]" : "bg-[#d69a63] text-[#1b211e]"}`}>{entry.rank}</span>
                  <Link href={`/players/${entry.userId}`} className="min-w-0 flex-1 truncate text-sm font-bold hover:text-[var(--lime-deep)] hover:underline">{entry.name}</Link>
                  <span className="shrink-0 text-xs font-bold text-[var(--ink-soft)]">{entry.wins}-{entry.losses} · {entry.differential > 0 ? "+" : ""}{entry.differential}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-[var(--ink-soft)]">{recap.totals.players} players · {recap.totals.games} games · {recap.totals.points} points{recap.shutouts > 0 && ` · ${recap.shutouts} shutout${recap.shutouts === 1 ? "" : "s"}`}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {recap.biggestWin && <Highlight icon={Flame} label="Biggest win"><Names players={recap.biggestWin.winners} /> <span className="text-[var(--lime-deep)]">{recap.biggestWin.winnerScore}-{recap.biggestWin.loserScore}</span></Highlight>}
            {recap.closestGame && <Highlight icon={Swords} label="Closest game"><Names players={recap.closestGame.winners} /> <span className="text-[var(--lime-deep)]">{recap.closestGame.winnerScore}-{recap.closestGame.loserScore}</span><span className="block text-xs font-semibold text-[var(--ink-soft)]">over <Names players={recap.closestGame.losers} /></span></Highlight>}
            {recap.biggestUpset && <Highlight icon={Dices} label="Biggest upset"><Names players={recap.biggestUpset.winners} /> <span className="text-[var(--lime-deep)]">{recap.biggestUpset.winnerScore}-{recap.biggestUpset.loserScore}</span><span className="block text-xs font-semibold text-[var(--ink-soft)]">over <Names players={recap.biggestUpset.losers} /> · {recap.biggestUpset.chance}% chance going in</span></Highlight>}
            {recap.topScorer && <Highlight icon={Target} label="Most points"><Link href={`/players/${recap.topScorer.userId}`} className="hover:text-[var(--lime-deep)] hover:underline">{recap.topScorer.name}</Link> <span className="text-[var(--lime-deep)]">{recap.topScorer.value}</span></Highlight>}
            {recap.biggestRatingGain && <Highlight icon={TrendingUp} label="Biggest rating jump"><Link href={`/players/${recap.biggestRatingGain.userId}`} className="hover:text-[var(--lime-deep)] hover:underline">{recap.biggestRatingGain.name}</Link> <span className="text-[var(--lime-deep)]">+{recap.biggestRatingGain.value.toFixed(2)}</span></Highlight>}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--line)] pt-5">
          <BragButton card={{ kind: "roundRobin", roundRobinId }} label="Share this recap as a picture" text="Share recap" align="left" />
          <button onClick={copy} className={`${shareButton} border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]`}><Copy size={14} />{copied ? "Copied!" : "Copy recap"}</button>
          {played && <div className="ml-auto"><BragButton card={{ kind: "recap", roundRobinId }} label="Share my result as a picture" text="Share my result" /></div>}
        </div>
      </div>
    </section>
  );
}
