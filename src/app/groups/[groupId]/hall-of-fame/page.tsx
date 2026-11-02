"use client";

import Link from "next/link";
import { use, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, BadgeCheck, Crown, Dumbbell, Flame, Gauge, Handshake, History, Lock, Medal, ShieldCheck, Target, Timer, Trophy, UserRound, Zap } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Reactions } from "@/components/reactions";
import { recordTarget } from "@/lib/reactions";

type Holder = { userId: string; name: string; photoUrl: string | null };
type Winner = { userId: string; name: string; photoUrl: string | null; titles: number; lastWonAt: string; rank: number };
type HallRecord = { key: string; label: string; value: string; holders: Holder[]; detail: string; roundRobin: { id: string; name: string } | null; at: string | null };
type Ref = { userId: string; name: string };
type Reign = { value: string; holders: Ref[]; at: string; roundRobin: { id: string; name: string } };
type Chase = { userId: string; key: string; text: string };
type Placing = { key: string; label: string; rank: number; of: number; tied: number; value: string };
type Club = { key: string; label: string; members: (Ref & { joinedAt: string })[] };
type Grit = { key: string; label: string; value: string; holders: Ref[]; detail: string };
type WallMonth = { key: string; label: string; champions: { roundRobin: { id: string; name: string }; players: Ref[] }[]; playersOfTheWeek: { weekStart: string; players: Ref[] }[]; awards: { title: string; players: Ref[]; detail: string }[] };
type HallData = { groupName: string | null; monthLabel: string; records: HallRecord[]; winners: Winner[]; history?: Record<string, Reign[]>; chases?: Chase[]; place?: Placing[]; clubs?: Club[]; grit?: Grit[]; wall?: WallMonth[]; error: string | null };

const MEDALS: Record<number, { label: string; color: string; ring: string }> = {
  1: { label: "1st", color: "#f5c542", ring: "border-[#f5c542]" },
  2: { label: "2nd", color: "#c9d1d9", ring: "border-[#c9d1d9]" },
  3: { label: "3rd", color: "#d08a4f", ring: "border-[#d08a4f]" },
};

const DAY = 24 * 60 * 60 * 1000;
const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The top 3 round robin winners; players tied on titles share a place. */
function WinnersPodium({ winners }: { winners: Winner[] }) {
  return (
    <section className="mt-4 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><Crown size={15} className="text-[var(--lime-deep)]" />Top round robin winners</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {winners.map((winner) => {
          const medal = MEDALS[winner.rank] ?? MEDALS[3];
          return (
            <li key={winner.userId}>
              <Link href={`/players/${winner.userId}`} className={`flex items-center gap-3 rounded-2xl border-2 ${medal.ring} bg-[#131f19] p-3 transition-colors hover:bg-[#1c2a1a]`}>
                <div className="relative shrink-0">
                  <Avatar name={winner.name} photoUrl={winner.photoUrl} className="h-11 w-11 rounded-full bg-[#22331f] text-xs font-black text-[var(--lime)]" />
                  <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px] font-black text-[#0f1712]" style={{ backgroundColor: medal.color }}>{medal.label}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{winner.name}</p>
                  <p className="text-xs text-[var(--ink-soft)]"><span className="font-bold" style={{ color: medal.color }}>{winner.titles} title{winner.titles === 1 ? "" : "s"}</span> · last {new Date(winner.lastWonAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PlayerLinks({ players }: { players: Ref[] }) {
  return <>{players.map((player, index) => <span key={player.userId}>{index > 0 && (index === players.length - 1 ? " & " : ", ")}<Link href={`/players/${player.userId}`} className="font-bold hover:text-[var(--lime-deep)] hover:underline">{player.name}</Link></span>)}</>;
}

function Section({ icon: Icon, title, hint, children, tone = "lime" }: { icon: typeof Trophy; title: string; hint?: string; children: ReactNode; tone?: "lime" | "coral" }) {
  return (
    <section className="mt-4 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><Icon size={15} className={tone === "lime" ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"} />{title}</p>
      {hint && <p className="mt-1 text-xs text-[var(--ink-soft)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Who has held a record and for how long, the current holder first. */
function RecordHistory({ reigns }: { reigns: Reign[] }) {
  const [now] = useState(() => Date.now());
  const newestFirst = [...reigns].reverse();
  return (
    <ol className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
      {newestFirst.map((reign, index) => {
        const until = index === 0 ? now : new Date(newestFirst[index - 1].at).getTime();
        const held = Math.max(0, Math.round((until - new Date(reign.at).getTime()) / DAY));
        return (
          <li key={`${reign.at}-${index}`} className="flex items-start gap-3 text-xs">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${index === 0 ? "bg-[var(--lime)]" : "bg-[var(--line)]"}`} />
            <div className="min-w-0 flex-1">
              <p><span className="font-black text-[var(--foreground)]">{reign.value}</span> · <PlayerLinks players={reign.holders} /></p>
              <p className="text-[var(--ink-soft)]">{shortDate(reign.at)} at <Link href={`/round-robin/${reign.roundRobin.id}`} className="hover:underline">{reign.roundRobin.name}</Link> · held {held} day{held === 1 ? "" : "s"}{index === 0 ? " so far" : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const ICONS: Record<string, typeof Trophy> = { titles: Crown, streak: Flame, biggestWin: Zap, bestNight: Trophy, undefeated: ShieldCheck, duo: Handshake, clutch: Timer, games: Gauge };

/** A group's Hall of Fame, all time or this month; all time adds record histories, chases, your place, clubs, grit and the champions wall. */
export default function HallOfFamePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [period, setPeriod] = useState<"all" | "month">("all");
  const [data, setData] = useState<HallData | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/hall-of-fame${period === "month" ? "?period=month" : ""}`).then(async (response) => {
      const body = await response.json().catch(() => null);
      setData(response.ok ? { ...body, winners: body.winners ?? [], error: null } : { groupName: null, monthLabel: "", records: [], winners: [], error: body?.error ?? "Unable to load the Hall of Fame." });
    });
  }, [groupId, period]);

  function choose(next: "all" | "month") {
    if (next === period) return;
    setData(null);
    setPeriod(next);
  }

  const allTime = period === "all";
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href={`/groups/${groupId}`} className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to group</Link>
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">{data?.groupName ?? "Group"} · {allTime ? "All time" : data?.monthLabel || "This month"}</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Hall of Fame</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">Records from {allTime ? "every ended round robin" : "this month's ended round robins"} in this group. Each scored game counts as a win or loss, and guests don&apos;t hold records.</p>
          <div className="mt-4 inline-flex rounded-full bg-[#1a2a1c] p-1" role="tablist" aria-label="Period">
            {([["all", "All time"], ["month", "This month"]] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={period === value} onClick={() => choose(value)} className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${period === value ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm" : "text-[var(--ink-soft)]"}`}>{label}</button>
            ))}
          </div>
        </div>

        {!data ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-36 rounded-2xl" />)}</div>
        ) : data.error ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-10 text-center">
            <Lock size={20} className="text-[var(--lime-deep)]" />
            <p className="text-sm font-bold">{data.error}</p>
          </div>
        ) : !data.records.length ? (
          <p className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">{allTime ? "No records yet -- they're set once the group finishes its first round robin." : "No round robins have ended this month yet -- this month's board fills in after the first one."}</p>
        ) : (
          <div className="mt-4">
            {allTime && !!data.chases?.length && (
              <section className="mt-4 rounded-[20px] border border-[var(--coral)] bg-[#2a1c17] p-5 sm:p-6">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#f6b5a3]"><Target size={15} />Chasing a record</p>
                <ul className="mt-3 space-y-2">{data.chases.map((chase) => <li key={`${chase.key}-${chase.userId}`} className="text-sm font-bold"><Link href={`/players/${chase.userId}`} className="hover:underline">{chase.text}</Link></li>)}</ul>
              </section>
            )}
            {data.winners.length > 0 && <WinnersPodium winners={data.winners} />}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* The podium above already shows the most titles. */}
              {data.records.filter((record) => !(record.key === "titles" && data.winners.length)).map((record) => {
                const Icon = ICONS[record.key] ?? Trophy;
                const reigns = allTime ? data.history?.[record.key] ?? [] : [];
                return (
                  <section key={record.key} className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><Icon size={15} className="text-[var(--lime-deep)]" />{record.label}</p>
                      <p className="text-2xl font-black tracking-[-.04em] text-[var(--lime)]">{record.value}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                      {record.holders.map((holder) => (
                        <Link key={holder.userId} href={`/players/${holder.userId}`} className="flex min-w-0 items-center gap-2 font-extrabold hover:text-[var(--lime-deep)]">
                          <Avatar name={holder.name} photoUrl={holder.photoUrl} className="h-8 w-8 shrink-0 rounded-full bg-[#22331f] text-[10px] font-black text-[var(--lime)]" />
                          <span className="truncate">{holder.name}</span>
                        </Link>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[var(--ink-soft)]">
                      {record.detail}
                      {record.roundRobin && <> · <Link href={`/round-robin/${record.roundRobin.id}`} className="font-semibold hover:text-[var(--lime-deep)] hover:underline">{record.roundRobin.name}</Link></>}
                      {record.at && <> · {new Date(record.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</>}
                    </p>
                    {reigns.length > 1 && (
                      <button type="button" onClick={() => setOpenHistory((current) => (current === record.key ? null : record.key))} aria-expanded={openHistory === record.key} className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-[var(--lime-deep)] hover:underline"><History size={12} />{openHistory === record.key ? "Hide history" : `Record history (${reigns.length})`}</button>
                    )}
                    {openHistory === record.key && <RecordHistory reigns={reigns} />}
                    {allTime && <Reactions targetType="RECORD" targetId={recordTarget(groupId, record)} className="mt-4" />}
                  </section>
                );
              })}
            </div>

            {allTime && !!data.place?.length && (
              <Section icon={UserRound} title="Your place in the Hall" hint="Where you rank on each record among everyone who's played here.">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.place.map((placing) => (
                    <li key={placing.key} className="flex items-center justify-between gap-3 rounded-xl bg-[#131f19] px-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="font-bold">{placing.label}</span> <span className="text-xs text-[var(--ink-soft)]">· {placing.value}</span>
                        {placing.tied > 0 && <span className="block text-[11px] text-[var(--ink-soft)]">Shared with {placing.tied} {placing.tied === 1 ? "other" : "others"}</span>}
                      </span>
                      <span className={`shrink-0 font-black ${placing.rank === 1 ? "text-[#f5c542]" : placing.rank <= 3 ? "text-[var(--lime)]" : "text-[var(--ink-soft)]"}`}>{placing.tied > 0 ? "T-" : ""}#{placing.rank}<span className="text-[10px] font-bold text-[var(--ink-soft)]"> of {placing.of}</span></span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {allTime && !!data.clubs?.some((club) => club.members.length) && (
              <Section icon={BadgeCheck} title="Milestone clubs" hint="With the date each player got in.">
                <div className="grid gap-3 sm:grid-cols-3">
                  {data.clubs.map((club) => (
                    <div key={club.key} className="rounded-2xl bg-[#131f19] p-4">
                      <p className="font-extrabold">{club.label}</p>
                      {club.members.length ? (
                        <ul className="mt-2 space-y-1 text-xs">{club.members.map((member) => <li key={member.userId} className="flex justify-between gap-2"><Link href={`/players/${member.userId}`} className="truncate font-bold hover:text-[var(--lime-deep)]">{member.name}</Link><span className="shrink-0 text-[var(--ink-soft)]">{shortDate(member.joinedAt)}</span></li>)}</ul>
                      ) : <p className="mt-2 text-xs text-[var(--ink-soft)]">No members yet.</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {allTime && !!data.grit?.length && (
              <Section icon={Dumbbell} title="Hall of Grit" hint="For the effort, not the scoreline." tone="coral">
                <div className="grid gap-3 sm:grid-cols-3">
                  {data.grit.map((record) => (
                    <div key={record.key} className="rounded-2xl bg-[#131f19] p-4">
                      <div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-[var(--ink-soft)]">{record.label}</p><p className="text-xl font-black text-[var(--coral)]">{record.value}</p></div>
                      <p className="mt-2 text-sm"><PlayerLinks players={record.holders} /></p>
                      <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{record.detail}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {allTime && !!data.wall?.length && (
              <Section icon={Medal} title="Wall of champions" hint="Every month's awards, Players of the Week and round robin champions.">
                <div className="space-y-5">
                  {data.wall.map((month) => (
                    <div key={month.key}>
                      <p className="text-sm font-black">{month.label}</p>
                      <div className="mt-2 space-y-1.5 text-xs">
                        {month.awards.map((award) => <p key={award.title}><span className="font-bold text-[#f5c542]">{award.title}:</span> <PlayerLinks players={award.players} /></p>)}
                        {month.playersOfTheWeek.length > 0 && <p><span className="font-bold text-[var(--lime)]">Players of the Week:</span> {month.playersOfTheWeek.map((week, index) => <span key={week.weekStart}>{index > 0 && " · "}<PlayerLinks players={week.players} /></span>)}</p>}
                        {month.champions.length > 0 && (
                          <details>
                            <summary className="cursor-pointer font-bold text-[var(--ink-soft)] hover:text-[var(--foreground)]">{month.champions.length} round robin champion{month.champions.length === 1 ? "" : "s"}</summary>
                            <ul className="mt-1.5 space-y-1 pl-3">{month.champions.map((night) => <li key={night.roundRobin.id}><Link href={`/round-robin/${night.roundRobin.id}`} className="text-[var(--ink-soft)] hover:underline">{night.roundRobin.name}</Link> · <PlayerLinks players={night.players} /></li>)}</ul>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
