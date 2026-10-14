"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, PawPrint } from "lucide-react";

type MatchPlayer = { id: string; name: string; side: "A" | "B"; ratingDelta: number | null; ratingAfter: number | null };
type Match = { id: string; event: string; location: string; scheduledAt: string | null; scores: { sideAScore: number; sideBScore: number }[]; players: MatchPlayer[] };
type Profile = { id: string; record: string; winRate: string; rank: number };
type RelationshipStat = { id: string; name: string; matches: number; wins: number; losses: number; winPct: number; scored: number; conceded: number; differential: number };

function RelationshipTable({ title, subtitle, firstColumn, rows, loading, emptyText }: { title: string; subtitle: string; firstColumn: string; rows: RelationshipStat[]; loading: boolean; emptyText: string }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">{subtitle}</p>
      <div className="mt-4 overflow-x-auto rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-10 rounded-xl" />)}</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">{emptyText}</p>
        ) : (
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">
                <th className="pb-3">{firstColumn}</th>
                <th className="pb-3 text-center">Matches</th>
                <th className="w-14 pb-3 text-center">W</th>
                <th className="w-14 pb-3 text-center">L</th>
                <th className="pb-3 text-center">Win%</th>
                <th className="pb-3 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-3 font-bold text-[var(--foreground)]">{row.name}</td>
                  <td className="py-3 text-center font-semibold text-[var(--ink-soft)]">{row.matches}</td>
                  <td className="w-14 py-3 text-center font-semibold">{row.wins}</td>
                  <td className="w-14 py-3 text-center font-semibold">{row.losses}</td>
                  <td className="py-3 text-center font-semibold">{row.winPct}%</td>
                  <td className={`py-3 text-right font-black ${row.differential > 0 ? "text-[var(--lime-deep)]" : row.differential < 0 ? "text-[#e8836a]" : "text-[var(--ink-soft)]"}`}>{row.differential > 0 ? "+" : ""}{row.differential}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function PlayerRatingChip({ player, isMe }: { player: MatchPlayer; isMe: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={isMe ? "font-bold text-[var(--foreground)]" : "font-semibold text-[var(--ink-soft)]"}>{isMe ? "You" : player.name}</span>
      {player.ratingDelta != null && player.ratingAfter != null && (
        <span className={`text-[11px] font-bold ${player.ratingDelta > 0 ? "text-[var(--lime-deep)]" : player.ratingDelta < 0 ? "text-[var(--coral)]" : "text-[var(--ink-soft)]"}`}>
          {player.ratingAfter.toFixed(2)} ({player.ratingDelta > 0 ? "+" : ""}{player.ratingDelta.toFixed(2)})
        </span>
      )}
    </span>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [opponents, setOpponents] = useState<RelationshipStat[]>([]);
  const [partners, setPartners] = useState<RelationshipStat[]>([]);
  const [loadingH2H, setLoadingH2H] = useState(true);

  useEffect(() => { fetch("/api/matches").then((response) => response.json()).then((data) => setMatches(data.matches ?? [])).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetch("/api/profile").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.profile) setProfile(data.profile); }); }, []);
  useEffect(() => { fetch("/api/matches/head-to-head").then((response) => response.ok ? response.json() : null).then((data) => { setOpponents(data?.opponents ?? []); setPartners(data?.partners ?? []); }).finally(() => setLoadingH2H(false)); }, []);

  const myUserId = profile?.id ?? null;

  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-5xl">
    <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to dashboard</Link>
    <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Your record</p>
    <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">Match history.</h1>
    <p className="mt-3 text-sm text-[var(--ink-soft)]">Every result, score, and opponent in one place.</p>

    {profile && (
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="panel rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Overall record</p><p className="mt-3 text-3xl font-black tracking-[-.04em]">{profile.record}</p></div>
        <div className="panel rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Win rate</p><p className="mt-3 text-3xl font-black tracking-[-.04em] text-[var(--lime-deep)]">{profile.winRate}</p></div>
        <div className="panel rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Current rank</p><p className="mt-3 text-3xl font-black tracking-[-.04em]">#{profile.rank}</p></div>
      </section>
    )}

    <RelationshipTable title="Head to head" subtitle="Your record against everyone you've played." firstColumn="Opponent" rows={opponents} loading={loadingH2H} emptyText="Play a match to see your head-to-head record." />
    <RelationshipTable title="With a partner" subtitle="Your win rate playing alongside each teammate." firstColumn="Partner" rows={partners} loading={loadingH2H} emptyText="Play a doubles match to see your partner stats." />

    <section className="mt-8 space-y-3">
      {loading ? (
        <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">Loading matches...</div>
      ) : matches.length === 0 ? (
        <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-8 text-center"><PawPrint size={22} className="mx-auto text-[var(--lime-deep)]" /><p className="mt-3 font-bold text-[var(--foreground)]">No matches recorded yet.</p><p className="mt-2 text-sm text-[var(--ink-soft)]">Record your first result after a game to start your history.</p></div>
      ) : matches.map((match) => {
        const mine = match.players.find((player) => player.id === myUserId);
        const mySide = mine ? match.players.filter((player) => player.side === mine.side) : [];
        const theirSide = mine ? match.players.filter((player) => player.side !== mine.side) : match.players;
        const myScore = match.scores.reduce((total, score) => total + (mine?.side === "A" ? score.sideAScore : score.sideBScore), 0);
        const theirScore = match.scores.reduce((total, score) => total + (mine?.side === "A" ? score.sideBScore : score.sideAScore), 0);
        const result: "W" | "L" | "-" = match.scores.length ? (myScore > theirScore ? "W" : myScore < theirScore ? "L" : "-") : "-";
        return (
          <article key={match.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <h2 className="font-extrabold text-[var(--foreground)]">{match.event}</h2>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--ink-soft)]"><span className="flex items-center gap-1"><MapPin size={14} />{match.location}</span><span className="flex items-center gap-1"><CalendarDays size={14} />{match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString() : "Recently"}</span></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-2">
                  {match.scores.map((score, index) => <span key={index} className={`rounded-lg px-3 py-2 text-sm font-black ${result === "W" ? "bg-[var(--lime)] text-[#0f1712]" : result === "L" ? "bg-[var(--coral)] text-[#2e1a16]" : "bg-[#1c2a1a] text-[var(--foreground)]"}`}>{mine?.side === "A" ? score.sideAScore : score.sideBScore} - {mine?.side === "A" ? score.sideBScore : score.sideAScore}</span>)}
                </div>
                {result !== "-" && <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${result === "W" ? "bg-[var(--lime)] text-[#0f1712]" : "bg-[var(--coral)] text-[#2e1a16]"}`}>{result}</span>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-[var(--line)] pt-3 text-xs">
              {mySide.map((player, index) => <span key={player.id} className="flex items-center gap-1.5">{index > 0 && <span className="text-[var(--ink-soft)]">&</span>}<PlayerRatingChip player={player} isMe={player.id === myUserId} /></span>)}
              <span className="mx-1 text-[var(--ink-soft)]">vs</span>
              {theirSide.map((player, index) => <span key={player.id} className="flex items-center gap-1.5">{index > 0 && <span className="text-[var(--ink-soft)]">&</span>}<PlayerRatingChip player={player} isMe={player.id === myUserId} /></span>)}
            </div>
          </article>
        );
      })}
    </section>
  </div></main>;
}
