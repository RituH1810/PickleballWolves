"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, PawPrint } from "lucide-react";

type Match = { id: string; event: string; location: string; scheduledAt: string | null; scores: { sideAScore: number; sideBScore: number }[]; players: { id: string; name: string; side: "A" | "B" }[] };
type Profile = { id: string; record: string; winRate: string; rank: number };

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => { fetch("/api/matches").then((response) => response.json()).then((data) => setMatches(data.matches ?? [])).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetch("/api/profile").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.profile) setProfile(data.profile); }); }, []);

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

    <section className="mt-8 space-y-3">
      {loading ? (
        <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">Loading matches...</div>
      ) : matches.length === 0 ? (
        <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-8 text-center"><PawPrint size={22} className="mx-auto text-[var(--lime-deep)]" /><p className="mt-3 font-bold text-[var(--foreground)]">No matches recorded yet.</p><p className="mt-2 text-sm text-[var(--ink-soft)]">Record your first result after a game to start your history.</p></div>
      ) : matches.map((match) => {
        const mine = match.players.find((player) => player.id === myUserId);
        const teammates = match.players.filter((player) => player.id !== myUserId && player.side === mine?.side).map((player) => player.name);
        const opposingSide = match.players.filter((player) => player.side !== mine?.side).map((player) => player.name);
        const myLabel = teammates.length ? `You & ${teammates.join(" & ")}` : "You";
        const theirLabel = opposingSide.length ? opposingSide.join(" & ") : (match.players.filter((player) => player.id !== myUserId).map((player) => player.name).join(" & ") || "Unknown");
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
            <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs">
              <span className={result === "W" ? "font-bold text-[var(--lime-deep)]" : "font-semibold text-[var(--foreground)]"}>{myLabel}</span>
              <span className="mx-2 text-[var(--ink-soft)]">vs</span>
              <span className={result === "L" ? "font-bold text-[var(--coral)]" : "font-semibold text-[var(--foreground)]"}>{theirLabel}</span>
            </p>
          </article>
        );
      })}
    </section>
  </div></main>;
}
