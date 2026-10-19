"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Flame, Handshake, Swords, Target, Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Person = { id: string; name: string; photoUrl: string | null; skillRating: number };
type Meeting = { id: string; playedAt: string; event: string; winner: "a" | "b"; games: [number, number][]; margin: number; partnersA: string[]; partnersB: string[] };
type Rivalry = {
  a: Person; b: Person; played: number; winsA: number; winsB: number; pointsA: number; pointsB: number;
  currentStreak: { who: "a" | "b"; length: number } | null; longestStreakA: number; longestStreakB: number;
  closest: Meeting | null; biggestWinA: Meeting | null; biggestWinB: Meeting | null;
  firstMeeting: string | null; lastMeeting: string | null; together: { wins: number; losses: number }; meetings: Meeting[];
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const first = (name: string) => name.split(" ")[0];

function Stat({ icon: Icon, label, children }: { icon: typeof Flame; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#131f19] p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]"><Icon size={13} className="text-[var(--lime-deep)]" />{label}</p>
      <div className="mt-1.5 text-sm font-bold leading-5">{children}</div>
    </div>
  );
}

/** Head-to-head between two players: record, streaks, standout matches, and every meeting. */
export default function RivalryPage({ params }: { params: Promise<{ playerA: string; playerB: string }> }) {
  const { playerA, playerB } = use(params);
  const [state, setState] = useState<{ key: string; rivalry?: Rivalry; error?: string } | null>(null);
  const key = `${playerA}|${playerB}`;

  useEffect(() => {
    fetch(`/api/rivalry?a=${encodeURIComponent(playerA)}&b=${encodeURIComponent(playerB)}`).then(async (response) => {
      const body = await response.json().catch(() => null);
      setState(response.ok ? { key: `${playerA}|${playerB}`, rivalry: body.rivalry } : { key: `${playerA}|${playerB}`, error: body?.error ?? "Couldn't load this rivalry." });
    });
  }, [playerA, playerB]);

  if (state?.key !== key) return <main className="grid min-h-screen place-items-center bg-[var(--background)]"><p className="text-sm text-[var(--ink-soft)]">Loading rivalry...</p></main>;
  if (!state.rivalry) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5"><div className="text-center"><p className="font-bold">{state.error}</p><Link href="/players" className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Find players</Link></div></main>;

  const r = state.rivalry;
  const leader = r.winsA === r.winsB ? null : r.winsA > r.winsB ? r.a : r.b;
  const share = r.played ? r.winsA / r.played : 0.5;
  const nameOf = (who: "a" | "b") => first(who === "a" ? r.a.name : r.b.name);

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href={`/players/${r.a.id}`} className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />{r.a.name}</Link>

        <section className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Rivalry</p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {[r.a, r.b].map((person, index) => (
              <Link key={person.id} href={`/players/${person.id}`} className={`flex flex-col items-center gap-2 text-center ${index === 1 ? "col-start-3" : ""}`}>
                <Avatar name={person.name} photoUrl={person.photoUrl} className="h-16 w-16 rounded-2xl bg-[#d8f24e] text-xl font-black text-[#1b211e] sm:h-20 sm:w-20" />
                <span className="text-sm font-extrabold hover:underline sm:text-base">{person.name}</span>
                <span className="text-[11px] text-[var(--ink-soft)]">{person.skillRating.toFixed(2)} rating</span>
              </Link>
            ))}
            <div className="col-start-2 row-start-1 text-center">
              <p className="text-4xl font-black tabular-nums tracking-[-.04em] sm:text-6xl">{r.winsA}<span className="text-[var(--ink-soft)]">-</span>{r.winsB}</p>
              <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{r.played} meeting{r.played === 1 ? "" : "s"}</p>
            </div>
          </div>
          {r.played > 0 && (
            <>
              <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-[var(--coral)]" aria-hidden><div className="bg-[var(--lime)]" style={{ width: `${Math.round(share * 100)}%` }} /></div>
              <p className="mt-3 text-center text-sm text-[var(--ink-soft)]">
                {leader ? <><strong className="text-[var(--foreground)]">{first(leader.name)}</strong> leads the rivalry</> : "Dead even"}
                {r.currentStreak && r.currentStreak.length >= 2 && <> · {nameOf(r.currentStreak.who)} has won the last {r.currentStreak.length}</>}
              </p>
            </>
          )}
        </section>

        {r.played === 0 ? (
          <p className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">{first(r.a.name)} and {first(r.b.name)} haven&apos;t played against each other yet{r.together.wins + r.together.losses ? ` -- but they're ${r.together.wins}-${r.together.losses} as partners` : ""}.</p>
        ) : (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stat icon={Target} label="Points">{r.pointsA} - {r.pointsB} <span className="text-xs font-semibold text-[var(--ink-soft)]">({r.pointsA - r.pointsB > 0 ? "+" : ""}{r.pointsA - r.pointsB} for {first(r.a.name)})</span></Stat>
              <Stat icon={Flame} label="Longest streak">{first(r.a.name)} {r.longestStreakA} · {first(r.b.name)} {r.longestStreakB}</Stat>
              <Stat icon={Handshake} label="As partners">{r.together.wins + r.together.losses ? `${r.together.wins}-${r.together.losses} together` : "Never partnered"}</Stat>
              {r.closest && <Stat icon={Swords} label="Closest match">{r.closest.games.map(([x, y]) => `${x}-${y}`).join(", ")} <span className="text-xs font-semibold text-[var(--ink-soft)]">· {nameOf(r.closest.winner)} won · {day(r.closest.playedAt)}</span></Stat>}
              {r.biggestWinA && <Stat icon={Trophy} label={`${first(r.a.name)}'s biggest win`}>{r.biggestWinA.games.map(([x, y]) => `${x}-${y}`).join(", ")} <span className="text-xs font-semibold text-[var(--ink-soft)]">· {day(r.biggestWinA.playedAt)}</span></Stat>}
              {r.biggestWinB && <Stat icon={Trophy} label={`${first(r.b.name)}'s biggest win`}>{r.biggestWinB.games.map(([x, y]) => `${y}-${x}`).join(", ")} <span className="text-xs font-semibold text-[var(--ink-soft)]">· {day(r.biggestWinB.playedAt)}</span></Stat>}
            </section>
            {r.firstMeeting && r.lastMeeting && <p className="mt-3 text-center text-xs text-[var(--ink-soft)]">First met {day(r.firstMeeting)} · Latest {day(r.lastMeeting)}</p>}

            <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
              <h2 className="font-extrabold">Every meeting</h2>
              <div className="mt-3 divide-y divide-[var(--line)]">
                {r.meetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-center gap-3 py-3">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-black ${meeting.winner === "a" ? "bg-[var(--lime)] text-[#0f1712]" : "bg-[var(--coral)] text-[#2e1a16]"}`}>{meeting.winner === "a" ? "W" : "L"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{first(r.a.name)}{meeting.partnersA.length ? ` & ${meeting.partnersA.join(" & ")}` : ""} <span className="text-[var(--ink-soft)]">vs</span> {first(r.b.name)}{meeting.partnersB.length ? ` & ${meeting.partnersB.join(" & ")}` : ""}</p>
                      <p className="truncate text-[11px] text-[var(--ink-soft)]">{meeting.event}{/* Round robin names already carry the date. */}{!meeting.event.includes(day(meeting.playedAt)) && ` · ${day(meeting.playedAt)}`}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold tabular-nums ${meeting.winner === "a" ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"}`}>{meeting.games.map(([x, y]) => `${x}-${y}`).join(", ")}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-soft)]">W/L and scores from {first(r.a.name)}&apos;s side.</p>
            </section>
          </>
        )}
        <p className="mt-6 text-center"><Link href={`/rivalry/${r.b.id}/${r.a.id}`} className="text-xs font-bold text-[var(--lime-deep)]">See it from {first(r.b.name)}&apos;s side</Link></p>
      </div>
    </main>
  );
}
