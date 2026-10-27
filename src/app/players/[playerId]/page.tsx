"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, Pencil, Swords, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { AchievementsPanel } from "@/components/achievements-panel";
import { AwardsPanel } from "@/components/awards-panel";
import { PartnerCard } from "@/components/partner-card";
import { ClutchCard } from "@/components/clutch-card";
import { RivalCard } from "@/components/rival-card";
import { RatingHistoryPanel } from "@/components/rating-history-panel";
import { DirectionsLink } from "@/components/directions-link";
import { useViewer } from "@/components/guest-shell";

type PlayerLink = { id: string; name: string };
type Player = { isGuest?: boolean; id: string; name: string; photoUrl: string | null; homeCourt: string | null; preferredHand: "LEFT" | "RIGHT" | "AMBIDEXTROUS"; skillRating: string; memberSince: string; matches: number; record: string; winRate: string; rank: number | null; matchesToQualify: number; isMe: boolean };
type WinLoss = { wins: number; losses: number };
type RecentMatch = { id: string; event: string; playedAt: string; result: "W" | "L" | "-"; partners: PlayerLink[]; opponents: PlayerLink[]; score: string };
type Data = { player: Player; groups: PlayerLink[]; headToHead: { against: WinLoss; together: WinLoss }; recent: RecentMatch[] };

// Round robin names often already carry the date ("Lancaster Group - Oct 12, 2026").
function formatDay(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Names({ players }: { players: PlayerLink[] }) {
  return <>{players.map((entry, index) => <span key={entry.id}>{index > 0 && " & "}<Link href={`/players/${entry.id}`} className="hover:text-[var(--lime-deep)] hover:underline">{entry.name}</Link></span>)}</>;
}

export default function PlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { signedIn } = useViewer();
  const { playerId } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<{ playerId: string; message: string } | null>(null);

  useEffect(() => {
    fetch(`/api/players/${playerId}`).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError({ playerId, message: body?.error ?? "Couldn't load this player." }); return; }
      setData(body);
    }).catch(() => setError({ playerId, message: "Couldn't load this player." }));
  }, [playerId]);

  // Results are tagged with the player they belong to, so following a link to another player
  // shows the loading state instead of the previous player's data.
  if (error?.playerId === playerId) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise"><div className="text-center"><p className="font-bold">{error.message}</p><Link href="/leaderboards" className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Back to leaderboard</Link></div></main>;
  if (data?.player.id !== playerId) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise"><p className="text-sm text-[var(--ink-soft)]">Loading player...</p></main>;

  const { player, groups, headToHead, recent } = data!;
  const firstName = player.name.split(" ")[0];
  const hasHeadToHead = headToHead.against.wins + headToHead.against.losses + headToHead.together.wins + headToHead.together.losses > 0;

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/leaderboards" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Leaderboard</Link>

        <section className="mt-8 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar name={player.name} photoUrl={player.photoUrl} className="h-24 w-24 shrink-0 rounded-[28px] bg-[#d8f24e] text-2xl font-black text-[#1b211e]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--lime-deep)]">{player.isGuest ? "Guest player" : "Player"}</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-[var(--foreground)]">{player.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--ink-soft)]">
                <span className="flex items-center gap-2">{signedIn && <><MapPin size={15} />{player.homeCourt || "No home court"}{player.homeCourt && <DirectionsLink address={player.homeCourt} />} &middot; </>}{player.preferredHand.toLowerCase()}-handed</span>
                <span className="flex items-center gap-2"><CalendarDays size={15} />Joined {new Date(player.memberSince).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
              </p>
              {groups.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Users size={14} className="text-[var(--ink-soft)]" />
                  {groups.map((group) => <Link key={group.id} href={`/groups/${group.id}`} className="rounded-full bg-[#1c2a1a] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-soft)] hover:text-[var(--foreground)]">{group.name}</Link>)}
                </div>
              )}
            </div>
            {player.isMe && <Link href="/profile" className="flex items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-bold"><Pencil size={14} />Edit profile</Link>}
          </div>

          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-[#131f19] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Skill rating</p><p className="mt-2 text-2xl font-black">{player.skillRating}</p></div>
            <div className="rounded-2xl bg-[#131f19] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Record</p><p className="mt-2 text-2xl font-black">{player.record}</p></div>
            <div className="rounded-2xl bg-[#131f19] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Win rate</p><p className="mt-2 text-2xl font-black">{player.winRate}</p></div>
            <div className="rounded-2xl bg-[#1b211e] p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9b6a9]">Wolves rank</p>
              {player.rank ? <p className="mt-2 text-2xl font-black">#{player.rank}</p> : <><p className="mt-2 text-2xl font-black text-[#a9b6a9]">—</p><p className="text-[10px] text-[#a9b6a9]">{player.matchesToQualify} more match{player.matchesToQualify === 1 ? "" : "es"} to qualify</p></>}
            </div>
          </div>
        </section>

        {hasHeadToHead && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Swords size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">You and {firstName}</h2></div><Link href={`/rivalry/me/${player.id}`} className="text-xs font-bold text-[var(--lime-deep)] hover:underline">Full rivalry →</Link></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([["Against each other", headToHead.against, `You're ${headToHead.against.wins}-${headToHead.against.losses} against ${firstName}`], ["As partners", headToHead.together, `${headToHead.together.wins}-${headToHead.together.losses} as a team`]] as const).map(([label, stat, line]) => (
                <div key={label} className="rounded-2xl bg-[#131f19] p-4">
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">{label}</p>
                  {stat.wins + stat.losses > 0 ? <><p className="mt-2 text-2xl font-black">{stat.wins} - {stat.losses}</p><p className="mt-1 text-xs text-[var(--ink-soft)]">{line}</p></> : <p className="mt-2 text-sm text-[var(--ink-soft)]">No matches yet</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <RatingHistoryPanel userId={player.id} />

        <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
          <h2 className="font-extrabold">Recent matches</h2>
          <div className="mt-4 space-y-3">
            {recent.length === 0 ? <p className="text-sm text-[var(--ink-soft)]">No matches recorded yet.</p> : recent.map((match) => (
              <div key={match.id} className="flex items-center gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-black ${match.result === "W" ? "bg-[var(--lime)] text-[#0f1712]" : match.result === "L" ? "bg-[var(--coral)] text-[#2e1a16]" : "bg-[#1c2a1a] text-[var(--ink-soft)]"}`}>{match.result}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{match.partners.length > 0 && <>With <Names players={match.partners} /> </>}vs <Names players={match.opponents} /></p>
                  <p className="truncate text-[11px] text-[var(--ink-soft)]">{match.event}{!match.event.includes(formatDay(match.playedAt)) && ` · ${formatDay(match.playedAt)}`}</p>
                </div>
                <span className={`shrink-0 text-xs font-bold ${match.result === "W" ? "text-[var(--lime-deep)]" : match.result === "L" ? "text-[var(--coral)]" : "text-[var(--ink-soft)]"}`}>{match.score || "No score"}</span>
              </div>
            ))}
          </div>
        </section>

        <RivalCard userId={player.id} isMe={player.isMe} playerName={player.name} />
        <PartnerCard userId={player.id} isMe={player.isMe} />
        <ClutchCard userId={player.id} />
        <AwardsPanel userId={player.id} />
        <AchievementsPanel userId={player.id} />
      </div>
    </main>
  );
}
