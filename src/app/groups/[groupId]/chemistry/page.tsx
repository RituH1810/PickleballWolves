"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, FlaskConical, Handshake, Lock, TrendingDown } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Player = { userId: string; name: string; games: number; photoUrl: string | null };
type Pair = { a: string; b: string; wins: number; losses: number };
type Chemistry = { groupName: string; myId: string; minGames: number; players: Player[]; pairs: Pair[]; best: Pair[]; worst: Pair | null };

const keyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const percent = (pair: Pair) => Math.round((pair.wins / (pair.wins + pair.losses)) * 100);
const firstName = (name: string) => name.split(" ")[0];

/** First names, with a last initial for players who share one (two Avinashes become "Avinash M" and "Avinash K"). */
function shortNames(players: Player[]) {
  const count = new Map<string, number>();
  for (const player of players) count.set(firstName(player.name), (count.get(firstName(player.name)) ?? 0) + 1);
  return new Map(players.map((player) => {
    const [first, ...rest] = player.name.split(" ");
    return [player.userId, count.get(first)! > 1 && rest.length ? `${first} ${rest[rest.length - 1][0]}` : first];
  }));
}

/** Lime for pairs that win together, coral for pairs that don't; faint until they've played enough. */
function cellStyle(pair: Pair | undefined, minGames: number) {
  if (!pair) return undefined;
  const rate = pair.wins / (pair.wins + pair.losses);
  const strength = Math.min(1, Math.abs(rate - 0.5) * 2);
  const alpha = (pair.wins + pair.losses >= minGames ? 0.25 + strength * 0.6 : 0.12).toFixed(2);
  return { backgroundColor: rate >= 0.5 ? `rgba(216, 242, 78, ${alpha})` : `rgba(241, 126, 98, ${alpha})` };
}

/** A group's partner chemistry: every pair's record together, plus its best and worst duos. */
export default function ChemistryPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [data, setData] = useState<Chemistry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/chemistry`).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (response.ok) setData(body); else setError(body?.error ?? "Unable to load the chemistry grid.");
    });
  }, [groupId]);

  const pairOf = new Map((data?.pairs ?? []).map((pair) => [keyOf(pair.a, pair.b), pair]));
  const nameOf = shortNames(data?.players ?? []);
  const pairNames = (pair: Pair) => `${nameOf.get(pair.a)} & ${nameOf.get(pair.b)}`;
  const chosen = selected ? pairOf.get(selected) : undefined;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 noise sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href={`/groups/${groupId}`} className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to group</Link>
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">{data?.groupName ?? "Group"} · All time</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Chemistry</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">How every pair does together in this group&apos;s ended round robins, game by game. Green pairs win together, red pairs don&apos;t. Faded squares have fewer than {data?.minGames ?? 5} games.</p>
        </div>

        {error ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-10 text-center">
            <Lock size={20} className="text-[var(--lime-deep)]" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : !data ? (
          <div className="skeleton mt-8 h-80 rounded-2xl" />
        ) : !data.pairs.length ? (
          <p className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">No doubles games yet -- the grid fills in once the group finishes its first round robin.</p>
        ) : (
          <>
            {(data.best.length > 0 || data.worst) && (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {data.best.length > 0 && (
                  <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]"><Handshake size={15} className="text-[var(--lime-deep)]" />Best duos</p>
                    <ol className="mt-3 space-y-2">
                      {data.best.map((pair, index) => (
                        <li key={keyOf(pair.a, pair.b)}>
                          <button type="button" onClick={() => setSelected(keyOf(pair.a, pair.b))} className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left hover:bg-[var(--surface-hover)]">
                            <span className="w-4 text-xs font-black text-[var(--ink-soft)]">{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-extrabold">{pairNames(pair)}</span>
                            <span className="text-xs text-[var(--ink-soft)]">{pair.wins}-{pair.losses}</span>
                            <span className="w-11 text-right font-black text-[var(--lime)]">{percent(pair)}%</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                {data.worst && (
                  <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]"><TrendingDown size={15} className="text-[var(--coral)]" />Still finding their groove</p>
                    <button type="button" onClick={() => setSelected(keyOf(data.worst!.a, data.worst!.b))} className="mt-3 flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left hover:bg-[var(--surface-hover)]">
                      <span className="min-w-0 flex-1 truncate font-extrabold">{pairNames(data.worst)}</span>
                      <span className="text-xs text-[var(--ink-soft)]">{data.worst.wins}-{data.worst.losses}</span>
                      <span className="w-11 text-right font-black text-[var(--coral)]">{percent(data.worst)}%</span>
                    </button>
                  </section>
                )}
              </div>
            )}

            <section className="mt-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]"><FlaskConical size={15} className="text-[var(--lime-deep)]" />Tap a square</p>
              <p className="mt-2 min-h-5 text-sm">
                {chosen ? (
                  <><span className="font-extrabold">{pairNames(chosen)}</span> <span className="text-[var(--ink-soft)]">are</span> <span className="font-bold">{chosen.wins}-{chosen.losses}</span> <span className="text-[var(--ink-soft)]">together ·</span> <span className={`font-black ${percent(chosen) >= 50 ? "text-[var(--lime)]" : "text-[var(--coral)]"}`}>{percent(chosen)}%</span></>
                ) : selected ? (
                  <span className="text-[var(--ink-soft)]">They haven&apos;t played together yet.</span>
                ) : (
                  <span className="text-[var(--ink-soft)]">Pick any two players to see their record together.</span>
                )}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="border-separate border-spacing-1 text-center text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[var(--panel)]" />
                      {data.players.map((player) => (
                        <th key={player.userId} title={player.name} className="min-w-9 font-bold">
                          <Avatar name={player.name} photoUrl={player.photoUrl} className={`mx-auto h-7 w-7 rounded-full bg-[var(--avatar-bg)] text-xs font-black text-[var(--lime)] ${player.userId === data.myId ? "ring-2 ring-[var(--lime)]" : ""}`} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((row) => (
                      <tr key={row.userId}>
                        <th scope="row" className={`sticky left-0 z-10 max-w-24 truncate bg-[var(--panel)] pr-2 text-left text-xs font-extrabold ${row.userId === data.myId ? "text-[var(--lime)]" : ""}`}>{nameOf.get(row.userId)}</th>
                        {data.players.map((column) => {
                          if (row.userId === column.userId) return <td key={column.userId} className="h-9 min-w-9 rounded-md bg-[var(--surface-2)]" />;
                          const key = keyOf(row.userId, column.userId);
                          const pair = pairOf.get(key);
                          return (
                            <td key={column.userId} className="p-0">
                              <button type="button" onClick={() => setSelected(key)} title={pair ? `${row.name} & ${column.name}: ${pair.wins}-${pair.losses}` : `${row.name} & ${column.name}: no games together`} style={cellStyle(pair, data.minGames)} className={`h-9 w-full min-w-9 rounded-md font-black ${pair ? "text-[var(--foreground)]" : "bg-[var(--surface-2)] text-[var(--ink-soft)]"} ${selected === key ? "outline outline-2 outline-[var(--foreground)]" : ""}`}>
                                {pair ? `${percent(pair)}` : "·"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-[var(--ink-soft)]">Numbers are win % together. Showing the {data.players.length} players with the most doubles games; guests aren&apos;t shown.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
