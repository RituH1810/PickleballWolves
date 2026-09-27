"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Award, CalendarDays, MapPin, Plus, Users } from "lucide-react";

type TournamentSummary = {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string | null;
  skillLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  eventType: "SINGLES" | "DOUBLES" | "MIXED";
  registrationMode: "ROSTER" | "OPEN";
  status: string;
  organizerName: string;
  entrantCount: number;
  teamCount: number;
};

const skillLabels: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
const eventTypeLabels: Record<string, string> = { SINGLES: "Singles", DOUBLES: "Doubles", MIXED: "Mixed doubles" };
const statusLabels: Record<string, string> = { DRAFT: "Draft", REGISTRATION_OPEN: "Registration open", TEAMS_LOCKED: "Teams locked", LIVE: "Live", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tournaments").then((response) => response.ok ? response.json() : null).then((data) => setTournaments(data?.tournaments ?? [])).finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to dashboard</Link>
        <div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Bracket play</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">Tournaments.</h1>
            <p className="mt-3 text-sm text-[var(--ink-soft)]">Open to everyone -- pools, fixed teams, and live standings.</p>
          </div>
          <Link href="/tournaments/new" className="flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-5 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]"><Plus size={16} />Create tournament</Link>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-40 rounded-[20px]" />)}</div>
        ) : tournaments.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-10 text-center">
            <Award size={22} className="text-[var(--lime-deep)]" />
            <p className="text-sm font-bold text-[var(--foreground)]">No tournaments yet.</p>
            <Link href="/tournaments/new" className="text-xs font-bold text-[var(--lime-deep)]">Create the first one</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {tournaments.map((tournament) => (
              <Link key={tournament.id} href={`/tournaments/${tournament.id}`} className="panel flex flex-col gap-3 rounded-[20px] p-5 transition-transform hover:-translate-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">{skillLabels[tournament.skillLevel]} · {eventTypeLabels[tournament.eventType]}</p>
                    <h2 className="mt-1 truncate text-lg font-extrabold text-[var(--foreground)]">{tournament.name}</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#1e2b17] px-2.5 py-1 text-[10px] font-bold text-[#c7e572]">{statusLabels[tournament.status] ?? tournament.status}</span>
                </div>
                <div className="space-y-1.5 text-xs text-[var(--ink-soft)]">
                  <p className="flex items-center gap-2"><CalendarDays size={13} />{new Date(tournament.startDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
                  <p className="flex items-center gap-2"><MapPin size={13} />{tournament.location}</p>
                  <p className="flex items-center gap-2"><Users size={13} />{tournament.entrantCount} registered{tournament.teamCount > 0 ? ` · ${tournament.teamCount} teams` : ""}</p>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs">
                  <span className="text-[var(--ink-soft)]">By {tournament.organizerName}</span>
                  {tournament.registrationMode === "OPEN" && tournament.status === "REGISTRATION_OPEN" && <span className="font-bold text-[var(--lime-deep)]">Open to join</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
