import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Crown, MapPin, Trophy, Users } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { DEFAULT_BRAND_COLOR, readableTextColor, tournamentDates } from "@/lib/branding";
import { loadPublicTournament, type PublicTournament } from "@/lib/public-tournament";
import { DirectionsLink } from "@/components/directions-link";

const STATUS_LABELS: Record<string, string> = { DRAFT: "Coming soon", REGISTRATION_OPEN: "Registration open", TEAMS_LOCKED: "Teams set", LIVE: "Live now", COMPLETED: "Final results", CANCELLED: "Cancelled" };
const EVENT_LABELS: Record<string, string> = { SINGLES: "Singles", DOUBLES: "Doubles", MIXED: "Mixed doubles" };
const LEVEL_LABELS: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tournament = await loadPublicTournament((await params).slug);
  if (!tournament) return { title: "Tournament not found | PickleballWolves" };
  const description = `${tournamentDates(tournament.startDate, tournament.endDate)} · ${tournament.location} · ${EVENT_LABELS[tournament.eventType] ?? ""}. Presented by ${tournament.presentedBy}.`;
  return {
    title: `${tournament.name} | PickleballWolves`,
    description,
    openGraph: { title: tournament.name, description, type: "website", siteName: "PickleballWolves" },
    twitter: { card: "summary_large_image", title: tournament.name, description },
  };
}

function Score({ scores, winnerSide }: { scores: readonly (readonly [number, number])[]; winnerSide: string | null }) {
  if (!scores.length) return <span className="text-xs text-[var(--ink-soft)]">vs</span>;
  return <span className="text-xs font-bold tabular-nums">{scores.map(([a, b]) => `${a}-${b}`).join(", ")}{winnerSide ? "" : " · live"}</span>;
}

function TeamLine({ name, won }: { name: string; won: boolean }) {
  return <span className={`truncate text-sm ${won ? "font-extrabold text-[var(--foreground)]" : "text-[var(--ink-soft)]"}`}>{name}</span>;
}

function Bracket({ rounds, accent }: { rounds: PublicTournament["rounds"]; accent: string }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((round) => (
        <div key={round.round} className="w-64 shrink-0">
          <p className="mb-2 text-xs font-black uppercase tracking-[.14em]" style={{ color: accent }}>{round.label}</p>
          <div className="space-y-3">
            {round.matches.map((match) => (
              <div key={match.id} className="rounded-xl border border-[var(--line)] bg-[#131f19] p-3">
                <div className="flex items-center justify-between gap-2"><TeamLine name={match.teamA} won={match.winnerSide === "A"} />{match.winnerSide === "A" && <Trophy size={13} style={{ color: accent }} />}</div>
                <div className="mt-1 flex items-center justify-between gap-2"><TeamLine name={match.teamB} won={match.winnerSide === "B"} />{match.winnerSide === "B" && <Trophy size={13} style={{ color: accent }} />}</div>
                <div className="mt-2 border-t border-[var(--line)] pt-2"><Score scores={match.scores} winnerSide={match.winnerSide} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The organizer's branded, public tournament page: anyone with the link can follow along. */
export default async function PublicTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const tournament = await loadPublicTournament((await params).slug);
  if (!tournament) notFound();

  const brand = tournament.brandColor ?? DEFAULT_BRAND_COLOR;
  const onBrand = readableTextColor(brand);
  // Text accents on the dark page: the brand color unless it's too dark to read there.
  const accent = onBrand === "#0f1712" ? brand : DEFAULT_BRAND_COLOR;
  const live = tournament.status === "LIVE";
  const hasPools = tournament.pools.some((pool) => pool.matches.length || pool.standings.length);

  return (
    <main className="min-h-screen bg-[var(--background)] pb-12 text-[var(--foreground)]">
      {live && <LiveRefresh seconds={30} />}
      <header className="relative">
        {tournament.bannerUrl
          ? <div className="h-44 w-full bg-cover bg-center sm:h-64" style={{ backgroundImage: `url(${tournament.bannerUrl})` }} role="img" aria-label={`${tournament.name} banner`} />
          : <div className="h-28 w-full sm:h-40" style={{ background: `linear-gradient(135deg, ${brand}, #0f1712)` }} />}
        <div className="mx-auto -mt-12 max-w-4xl px-5 sm:-mt-16 sm:px-8">
          <div className="flex items-end gap-4">
            {tournament.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={tournament.logoUrl} alt={`${tournament.presentedBy} logo`} className="h-24 w-24 shrink-0 rounded-2xl border-4 border-[var(--background)] bg-white object-contain sm:h-28 sm:w-28" />
              : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border-4 border-[var(--background)] text-2xl font-black sm:h-28 sm:w-28" style={{ background: brand, color: onBrand }}>{tournament.presentedBy.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>}
            <span className="mb-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[.12em]" style={{ background: brand, color: onBrand }}>{STATUS_LABELS[tournament.status] ?? tournament.status}</span>
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.18em]" style={{ color: accent }}>{tournament.presentedBy} presents</p>
          <h1 className="mt-1 break-words text-3xl font-black tracking-[-.04em] sm:text-5xl">{tournament.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[var(--ink-soft)]">
            <span className="flex items-center gap-1.5"><CalendarDays size={15} />{tournamentDates(tournament.startDate, tournament.endDate)}</span>
            <span className="flex items-center gap-1.5"><MapPin size={15} />{tournament.location}<DirectionsLink address={tournament.location} className="ml-1" /></span>
            <span className="flex items-center gap-1.5"><Users size={15} />{EVENT_LABELS[tournament.eventType]} · {LEVEL_LABELS[tournament.skillLevel]} · {tournament.teamCount || tournament.entrantCount} {tournament.teamCount ? "teams" : "players"}</span>
          </div>
          {tournament.description && <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-6 text-[var(--ink-soft)]">{tournament.description}</p>}
          {tournament.registrationOpen && (
            <Link href={`/tournaments/${tournament.id}`} className="mt-6 inline-flex h-12 items-center rounded-full px-6 text-sm font-bold" style={{ background: brand, color: onBrand }}>Register now{tournament.registrationDeadline ? ` · closes ${tournamentDates(tournament.registrationDeadline)}` : ""}</Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-5 pt-8 sm:px-8">
        {tournament.champion && (
          <section className="flex items-center gap-4 rounded-[20px] p-5" style={{ background: brand, color: onBrand }}>
            <Crown size={28} />
            <div><p className="text-xs font-black uppercase tracking-[.16em] opacity-80">Champions</p><p className="text-2xl font-black tracking-[-.03em]">{tournament.champion}</p></div>
          </section>
        )}

        {tournament.rounds.length > 0 && (
          <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <h2 className="mb-4 font-extrabold">Bracket</h2>
            <Bracket rounds={tournament.rounds} accent={accent} />
          </section>
        )}

        {hasPools && tournament.pools.map((pool) => (
          <section key={pool.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <h2 className="font-extrabold">{pool.name}</h2>
            {pool.standings.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead><tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><th className="pb-2">#</th><th className="pb-2">Team</th><th className="pb-2 text-center">W</th><th className="pb-2 text-center">L</th><th className="pb-2 text-right">Diff</th></tr></thead>
                  <tbody>{pool.standings.map((entry) => <tr key={entry.teamId} className="border-b border-[var(--line)] last:border-0"><td className="py-2.5 font-black" style={{ color: entry.rank === 1 ? accent : undefined }}>{entry.rank}</td><td className="py-2.5 font-bold">{entry.teamName}</td><td className="py-2.5 text-center">{entry.wins}</td><td className="py-2.5 text-center">{entry.losses}</td><td className="py-2.5 text-right font-bold">{entry.differential > 0 ? "+" : ""}{entry.differential}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {pool.matches.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {pool.matches.map((match) => (
                  <div key={match.id} className="rounded-xl bg-[#131f19] p-3">
                    <div className="flex items-center justify-between gap-2"><TeamLine name={match.teamA} won={match.winnerSide === "A"} />{match.court && <span className="shrink-0 text-[10px] text-[var(--ink-soft)]">Court {match.court}</span>}</div>
                    <TeamLine name={match.teamB} won={match.winnerSide === "B"} />
                    <div className="mt-1.5"><Score scores={match.scores} winnerSide={match.winnerSide} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        {!hasPools && !tournament.rounds.length && (
          <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">The draw hasn&apos;t been made yet -- check back on {tournamentDates(tournament.startDate)} for pools, live scores, and the bracket.</section>
        )}

        {tournament.sponsors.length > 0 && (
          <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <h2 className="text-xs font-bold uppercase tracking-[.16em] text-[var(--ink-soft)]">Presented with our sponsors</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tournament.sponsors.map((sponsor) => {
                const inner = (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {sponsor.logoUrl ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-14 w-full object-contain" /> : <span className="grid h-14 place-items-center text-center text-sm font-extrabold">{sponsor.name}</span>}
                    {sponsor.logoUrl && <span className="mt-2 block truncate text-center text-[11px] text-[#3a4a3f]">{sponsor.name}</span>}
                  </>
                );
                return sponsor.url
                  ? <a key={sponsor.id} href={sponsor.url} target="_blank" rel="noopener noreferrer sponsored" className="rounded-xl bg-white p-3 text-[#0f1712] transition-transform hover:-translate-y-0.5">{inner}</a>
                  : <div key={sponsor.id} className="rounded-xl bg-white p-3 text-[#0f1712]">{inner}</div>;
              })}
            </div>
          </section>
        )}

        <footer className="flex flex-col items-center gap-1 pt-4 text-center text-xs text-[var(--ink-soft)]">
          {live && <p>Scores update automatically.</p>}
          <p>Powered by <Link href="/install" className="font-bold text-[var(--lime-deep)]">PickleballWolves</Link> -- organize your own games and tournaments.</p>
        </footer>
      </div>
    </main>
  );
}
