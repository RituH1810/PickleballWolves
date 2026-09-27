"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Award, CalendarDays, Check, Copy, Mail, MapPin, MessageCircle, Plus, Share2, Trash2, Trophy, Users, X } from "lucide-react";
import { bracketRoundLabel } from "@/lib/tournament";

type MatchPlayerT = { userId: string; name: string; side: "A" | "B" };
type MatchT = { id: string; courtNumber: number | null; players: MatchPlayerT[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
type TeamT = { id: string; poolId: string | null; seed: number | null; members: { user: { id: string; name: string } }[] };
type PoolT = { id: string; name: string; teams: TeamT[]; matches: MatchT[] };
type EntrantT = { id: string; name: string; skillRating: string; gender: string | null; status: string; matchesSkillLevel: boolean };
type BracketMatchT = { id: string; round: number; position: number; teamA: TeamT | null; teamB: TeamT | null; match: MatchT | null };
type TournamentT = {
  id: string; name: string; description: string | null; location: string; courtCount: number; startDate: string; endDate: string | null;
  skillLevel: string; eventType: string; groupCount: number; teamFormationMethod: string; groupAssignmentMethod: string;
  registrationMode: string; registrationDeadline: string | null; pointsToWin: number; winBy: number; status: string;
  createdBy: { id: string; name: string }; isOwner: boolean; hasScores: boolean; myEntrantStatus: string | null;
  entrants: EntrantT[]; teams: TeamT[]; pools: PoolT[]; bracketMatches: BracketMatchT[];
};
type PoolStanding = { poolId: string; poolName: string; standings: { rank: number; teamId: string; teamName: string; wins: number; losses: number; scored: number; conceded: number; differential: number }[] };

const skillLabels: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
const eventTypeLabels: Record<string, string> = { SINGLES: "Singles", DOUBLES: "Doubles", MIXED: "Mixed doubles" };
const statusLabels: Record<string, string> = { DRAFT: "Draft", REGISTRATION_OPEN: "Registration open", TEAMS_LOCKED: "Teams locked", LIVE: "Live", COMPLETED: "Completed", CANCELLED: "Cancelled" };

function teamName(team: TeamT) { return team.members.map((member) => member.user.name).join(" / ") || "TBD"; }

function MatchCard({ match, onSave, onDelete, canScore, canDelete }: { match: MatchT; onSave: (matchId: string, sideA: string, sideB: string) => void; onDelete: (matchId: string) => void; canScore: boolean; canDelete: boolean }) {
  const [sideA, setSideA] = useState(match.scores[0]?.sideAScore?.toString() ?? "");
  const [sideB, setSideB] = useState(match.scores[0]?.sideBScore?.toString() ?? "");
  const hasScore = match.scores.length > 0;
  return (
    <article className="rounded-xl border border-[var(--line)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Court {match.courtNumber}</span>
        <div className="flex items-center gap-2">
          {hasScore ? <span className="rounded-full bg-[#1e2b17] px-2 py-1 text-[10px] font-bold text-[#c7e572]"><Check size={11} className="mr-1 inline" />Completed</span> : <span className="rounded-full bg-[#1c2a1a] px-2 py-1 text-[10px] font-bold"><Users size={11} className="mr-1 inline" />Ready</span>}
          {canDelete && <button onClick={() => onDelete(match.id)} aria-label="Delete match" className="rounded-full p-1.5 text-[var(--ink-soft)] hover:bg-[#2e1a16] hover:text-[var(--coral)]"><Trash2 size={13} /></button>}
        </div>
      </div>
      <div className="space-y-2 text-sm font-bold text-[var(--foreground)]">
        <p>{match.players.filter((player) => player.side === "A").map((player) => player.name).join(" / ")}</p>
        <p className="text-[var(--ink-soft)]">vs</p>
        <p>{match.players.filter((player) => player.side === "B").map((player) => player.name).join(" / ")}</p>
      </div>
      {canScore ? (
        <div className="mt-4 flex items-center gap-2">
          <input value={sideA} onChange={(event) => setSideA(event.target.value)} placeholder="0" type="number" className="h-10 w-16 rounded-lg border border-[var(--line)] text-center font-bold" />
          <span className="text-[var(--ink-soft)]">-</span>
          <input value={sideB} onChange={(event) => setSideB(event.target.value)} placeholder="0" type="number" className="h-10 w-16 rounded-lg border border-[var(--line)] text-center font-bold" />
          <button onClick={() => onSave(match.id, sideA, sideB)} className="ml-auto rounded-full bg-[#d8f24e] px-3 py-2 text-xs font-bold text-[#1b211e]">{hasScore ? "Update score" : "Save score"}</button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-[#131f19] px-3 py-2.5 text-xs font-semibold text-[var(--ink-soft)]">
          {hasScore ? <span className="font-bold text-[var(--foreground)]">{match.scores[0].sideAScore} - {match.scores[0].sideBScore}</span> : <span>Score not entered yet</span>}
          <span>Players only</span>
        </div>
      )}
    </article>
  );
}

export default function TournamentDetailPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const router = useRouter();
  const [tournament, setTournament] = useState<TournamentT | null>(null);
  const [standings, setStandings] = useState<PoolStanding[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [pendingPartner, setPendingPartner] = useState<string | null>(null);
  const [manualPairs, setManualPairs] = useState<[string, string][]>([]);
  const [manualPoolByTeam, setManualPoolByTeam] = useState<Record<string, number>>({});
  const [advancePerPool, setAdvancePerPool] = useState(1);

  function showNotice(text: string, type: "success" | "error") {
    setNotice({ text, type });
    if (type === "error") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadAll() {
    const [tournamentResponse, standingsResponse] = await Promise.all([fetch(`/api/tournaments/${tournamentId}`), fetch(`/api/tournaments/${tournamentId}/standings`)]);
    if (tournamentResponse.ok) setTournament((await tournamentResponse.json()).tournament);
    if (standingsResponse.ok) setStandings((await standingsResponse.json()).pools);
  }
  useEffect(() => {
    Promise.all([fetch(`/api/tournaments/${tournamentId}`), fetch(`/api/tournaments/${tournamentId}/standings`)]).then(async ([tournamentResponse, standingsResponse]) => {
      if (tournamentResponse.ok) setTournament((await tournamentResponse.json()).tournament);
      if (standingsResponse.ok) setStandings((await standingsResponse.json()).pools);
    }).finally(() => setLoading(false));
  }, [tournamentId]);
  useEffect(() => { fetch("/api/profile").then((response) => response.ok ? response.json() : null).then((data) => setMyUserId(data?.profile?.id ?? null)); }, []);

  async function registerSelf(override = false) {
    setBusy(true);
    const response = await fetch(`/api/tournaments/${tournamentId}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ override }) });
    const data = await response.json();
    if (!response.ok) {
      setBusy(false);
      if (data.skillMismatch && !override && window.confirm(`${data.error} Register anyway?`)) { registerSelf(true); return; }
      showNotice(data.error ?? "Unable to register.", "error");
      return;
    }
    showNotice("You're registered!", "success");
    await loadAll();
    setBusy(false);
  }

  async function withdrawSelf() {
    setBusy(true);
    await fetch(`/api/tournaments/${tournamentId}/register`, { method: "DELETE" });
    showNotice("Withdrawn.", "success");
    await loadAll();
    setBusy(false);
  }

  async function addEntrant(override = false) {
    if (!addEmail.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/tournaments/${tournamentId}/entrants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: addEmail.trim(), override }) });
    const data = await response.json();
    if (!response.ok) {
      setBusy(false);
      if (data.skillMismatch && !override && window.confirm(`${data.error} Add anyway?`)) { await addEntrant(true); return; }
      showNotice(data.error ?? "Unable to add player.", "error");
      return;
    }
    setAddEmail("");
    showNotice("Player added.", "success");
    await loadAll();
    setBusy(false);
  }

  async function removeEntrant(userId: string) {
    if (!window.confirm("Remove this player from the tournament?")) return;
    setBusy(true);
    await fetch(`/api/tournaments/${tournamentId}/entrants/${userId}`, { method: "DELETE" });
    await loadAll();
    setBusy(false);
  }

  async function formTeams(method: string, pairs?: [string, string][], override = false) {
    setBusy(true);
    const response = await fetch(`/api/tournaments/${tournamentId}/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, pairs, override }) });
    const data = await response.json();
    if (!response.ok) {
      setBusy(false);
      if (data.genderMismatch && !override && window.confirm(`${data.error} Continue anyway?`)) { await formTeams(method, pairs, true); return; }
      showNotice(data.error ?? "Unable to form teams.", "error");
      return;
    }
    setManualPairs([]);
    setPendingPartner(null);
    showNotice(`Formed ${data.teamsFormed} team${data.teamsFormed === 1 ? "" : "s"}${data.unpairedCount ? `, ${data.unpairedCount} left unpaired` : ""}.`, "success");
    await loadAll();
    setBusy(false);
  }

  async function assignGroups(method: string, groups?: string[][]) {
    setBusy(true);
    const response = await fetch(`/api/tournaments/${tournamentId}/groups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, groupCount: tournament?.groupCount, groups }) });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to assign groups.", "error"); setBusy(false); return; }
    setManualPoolByTeam({});
    showNotice(`Created ${data.groupCount} groups.`, "success");
    await loadAll();
    setBusy(false);
  }

  async function generateSchedule() {
    setBusy(true);
    const response = await fetch(`/api/tournaments/${tournamentId}/generate`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to generate the schedule.", "error"); setBusy(false); return; }
    showNotice(`Generated ${data.matches} matches across ${data.pools} pools.`, "success");
    await loadAll();
    setBusy(false);
  }

  async function generateBracket() {
    setBusy(true);
    const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ advancePerPool }) });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to generate the bracket.", "error"); setBusy(false); return; }
    showNotice(`Bracket generated: ${data.bracketMatches} matches across ${data.totalRounds} rounds.`, "success");
    await loadAll();
    setBusy(false);
  }

  async function saveScore(matchId: string, sideA: string, sideB: string) {
    const response = await fetch(`/api/matches/${matchId}/score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sideAScore: Number(sideA), sideBScore: Number(sideB), gameNumber: 1 }) });
    if (response.ok) { showNotice("Score saved and standings updated.", "success"); await loadAll(); }
    else showNotice((await response.json()).error ?? "Unable to save score.", "error");
  }

  async function deleteMatchFn(matchId: string) {
    if (!window.confirm("Delete this match?")) return;
    const response = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    if (response.ok) { showNotice("Match deleted.", "success"); await loadAll(); }
    else showNotice((await response.json()).error ?? "Unable to delete this match.", "error");
  }

  async function deleteTournament() {
    if (!window.confirm("Delete this tournament? This can't be undone.")) return;
    const response = await fetch(`/api/tournaments/${tournamentId}`, { method: "DELETE" });
    if (response.ok) router.push("/tournaments");
    else showNotice((await response.json()).error ?? "Unable to delete this tournament.", "error");
  }

  function toggleShare() {
    setShowShare((current) => !current);
    if (!shareUrl) setShareUrl(`${window.location.origin}/tournaments/${tournamentId}`);
  }
  async function copyShareUrl() {
    try { await navigator.clipboard.writeText(shareUrl); showNotice("Link copied!", "success"); } catch { showNotice("Unable to copy the link.", "error"); }
  }

  function toggleManualPairing(userId: string) {
    const paired = new Set(manualPairs.flat());
    if (paired.has(userId)) { setManualPairs((current) => current.filter((pair) => !pair.includes(userId))); return; }
    if (pendingPartner === userId) { setPendingPartner(null); return; }
    if (pendingPartner) { setManualPairs((current) => [...current, [pendingPartner, userId]]); setPendingPartner(null); return; }
    setPendingPartner(userId);
  }

  function cycleManualPool(teamId: string) {
    setManualPoolByTeam((current) => {
      const next = { ...current };
      const groupCount = tournament?.groupCount ?? 1;
      const currentValue = next[teamId];
      if (currentValue === undefined) next[teamId] = 0;
      else if (currentValue + 1 >= groupCount) delete next[teamId];
      else next[teamId] = currentValue + 1;
      return next;
    });
  }

  if (loading) return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton mt-6 h-16 w-2/3 max-w-lg rounded-xl" /></div>
    </main>
  );
  if (!tournament) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[var(--foreground)]">Tournament not found.</p><Link href="/tournaments" className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Back to tournaments</Link></div></main>;

  const isOwner = tournament.isOwner;
  const canManage = isOwner && tournament.status !== "LIVE" && tournament.status !== "COMPLETED";
  const registeredEntrants = tournament.entrants.filter((entrant) => entrant.status === "REGISTERED");
  const pairedIds = new Set(tournament.teams.flatMap((team) => team.members.map((member) => member.user.id)));
  const unpairedEntrants = registeredEntrants.filter((entrant) => !pairedIds.has(entrant.id));
  const manuallyPairedIds = new Set(manualPairs.flat());
  const unassignedTeams = tournament.teams.filter((team) => !team.poolId);
  const canRegisterOpenly = tournament.registrationMode === "OPEN" && tournament.status === "REGISTRATION_OPEN" && (!tournament.registrationDeadline || new Date(tournament.registrationDeadline) > new Date());
  const allPoolsScored = tournament.pools.length > 0 && tournament.pools.every((pool) => pool.matches.length > 0 && pool.matches.every((match) => match.scores.length > 0));
  const bracketRounds = [...new Set(tournament.bracketMatches.map((bracketMatch) => bracketMatch.round))].sort((a, b) => a - b);
  const totalBracketRounds = bracketRounds.length;

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/tournaments" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to tournaments</Link>
        <div className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">{skillLabels[tournament.skillLevel]} · {eventTypeLabels[tournament.eventType]}</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">{tournament.name}</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">Organized by <span className="font-bold text-[var(--foreground)]">{isOwner ? "you" : tournament.createdBy.name}</span></p>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-[var(--lime-deep)]"><span className="flex items-center gap-1.5"><CalendarDays size={15} />{new Date(tournament.startDate).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><span className="flex items-center gap-1.5"><MapPin size={15} />{tournament.location}</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#1e2b17] px-4 text-xs font-bold text-[#c7e572]"><Trophy size={13} />{statusLabels[tournament.status] ?? tournament.status}</span>
            <button onClick={toggleShare} className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]"><Share2 size={14} />Share</button>
            {isOwner && !tournament.hasScores && <button onClick={deleteTournament} className="flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-[var(--coral)] px-4 text-xs font-bold text-[var(--coral)] transition-colors hover:bg-[#2e1a16]">Delete tournament</button>}
          </div>
        </div>

        {notice && <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1e2b17] text-[#c7e572]"}`}>{notice.text}</p>}

        {showShare && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">Share this tournament</p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">{tournament.registrationMode === "OPEN" ? "Anyone with this link can register while sign-up is open." : "Send this link so players can follow the schedule and results."}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input readOnly value={shareUrl} onFocus={(event) => event.target.select()} className="h-11 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm text-[var(--ink-soft)] outline-none" />
              <button onClick={copyShareUrl} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-5 text-sm font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><Copy size={15} />Copy</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(`Join ${tournament.name} on PickleballWolves: ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><MessageCircle size={14} />WhatsApp</a>
              <a href={`mailto:?subject=${encodeURIComponent(`Join ${tournament.name}`)}&body=${encodeURIComponent(`Join ${tournament.name} on PickleballWolves: ${shareUrl}`)}`} className="flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><Mail size={14} />Email</a>
            </div>
          </section>
        )}

        {/* Registration */}
        <section className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-extrabold">Registered players</h2><p className="mt-1 text-xs text-[var(--ink-soft)]">{registeredEntrants.length} registered{tournament.registrationDeadline ? ` · Registration closes ${new Date(tournament.registrationDeadline).toLocaleDateString()}` : ""}</p></div>
            {canRegisterOpenly && (tournament.myEntrantStatus === "REGISTERED" ? <button onClick={withdrawSelf} disabled={busy} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]">Withdraw</button> : <button onClick={() => registerSelf()} disabled={busy} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">Register</button>)}
          </div>
          {isOwner && (
            <div className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-4 sm:flex-row">
              <input value={addEmail} onChange={(event) => setAddEmail(event.target.value)} placeholder="player@email.com" type="email" className="h-11 flex-1 rounded-xl border border-[var(--line)] px-4 text-sm" />
              <button onClick={() => addEntrant()} disabled={busy || !addEmail.trim()} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60"><Plus size={14} />Add player</button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {registeredEntrants.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No one registered yet.</p>}
            {registeredEntrants.map((entrant) => (
              <span key={entrant.id} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${entrant.matchesSkillLevel ? "bg-[#1e2b17] text-[#c7e572]" : "bg-[#2e1a16] text-[#f2a08c]"}`}>
                {!entrant.matchesSkillLevel && <AlertTriangle size={11} />}
                {entrant.name}
                {isOwner && canManage && <button onClick={() => removeEntrant(entrant.id)} aria-label={`Remove ${entrant.name}`}><X size={12} /></button>}
              </span>
            ))}
          </div>
        </section>

        {/* Team formation */}
        {canManage && tournament.eventType !== "SINGLES" && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <h2 className="font-extrabold">Form teams</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">{tournament.teams.length} team{tournament.teams.length === 1 ? "" : "s"} formed · {unpairedEntrants.length} player{unpairedEntrants.length === 1 ? "" : "s"} unpaired.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => formTeams("AUTO_BALANCED")} disabled={busy} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">Auto: balanced</button>
              <button onClick={() => formTeams("AUTO_RANDOM")} disabled={busy} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a] disabled:cursor-not-allowed disabled:opacity-60">Auto: random</button>
            </div>
            {unpairedEntrants.length > 0 && (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Or pair manually -- tap two players</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unpairedEntrants.map((entrant) => {
                    const paired = manuallyPairedIds.has(entrant.id);
                    const isPending = pendingPartner === entrant.id;
                    return <button key={entrant.id} onClick={() => toggleManualPairing(entrant.id)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${paired ? "border-[var(--lime-deep)] bg-[#1e2b17] text-[#c7e572]" : isPending ? "border-[var(--lime)] bg-[var(--lime)] text-[#0f1712]" : "border-[var(--line)] text-[var(--foreground)] hover:border-[var(--lime-deep)]"}`}>{entrant.name}{isPending ? " · pick a partner" : ""}</button>;
                  })}
                </div>
                {manualPairs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {manualPairs.map(([a, b]) => {
                      const nameOf = (id: string) => tournament.entrants.find((entrant) => entrant.id === id)?.name ?? "Unknown";
                      return <div key={`${a}-${b}`} className="flex items-center justify-between rounded-xl bg-[#131f19] px-4 py-2.5 text-sm font-bold text-[var(--foreground)]"><span>{nameOf(a)} &amp; {nameOf(b)}</span><button onClick={() => toggleManualPairing(a)} className="text-xs font-bold text-[var(--lime-deep)]">Unpair</button></div>;
                    })}
                    <button onClick={() => formTeams("MANUAL", manualPairs)} disabled={busy} className="mt-2 rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">Save {manualPairs.length} manual team{manualPairs.length === 1 ? "" : "s"}</button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Group assignment */}
        {canManage && tournament.teams.length > 0 && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <h2 className="font-extrabold">Assign groups</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">{tournament.pools.length} of {tournament.groupCount} group{tournament.groupCount === 1 ? "" : "s"} set up.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => assignGroups("RANDOM")} disabled={busy} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">Random</button>
              <button onClick={() => assignGroups("SEEDED")} disabled={busy} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a] disabled:cursor-not-allowed disabled:opacity-60">Seeded</button>
            </div>
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Or assign manually -- tap a team to cycle its group</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tournament.teams.map((team) => {
                  const assigned = manualPoolByTeam[team.id];
                  return <button key={team.id} onClick={() => cycleManualPool(team.id)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${assigned !== undefined ? "border-[var(--lime-deep)] bg-[#1e2b17] text-[#c7e572]" : "border-[var(--line)] text-[var(--foreground)] hover:border-[var(--lime-deep)]"}`}>{teamName(team)}{assigned !== undefined ? ` · Group ${String.fromCharCode(65 + assigned)}` : ""}</button>;
                })}
              </div>
              {Object.keys(manualPoolByTeam).length > 0 && (
                <button onClick={() => {
                  const groups: string[][] = Array.from({ length: tournament.groupCount }, () => []);
                  for (const [teamId, poolIndex] of Object.entries(manualPoolByTeam)) groups[poolIndex]?.push(teamId);
                  assignGroups("MANUAL", groups);
                }} disabled={busy} className="mt-3 rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">Save manual groups</button>
              )}
            </div>
          </section>
        )}

        {/* Generate schedule */}
        {canManage && tournament.pools.length > 0 && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-extrabold">Generate schedule</h2><p className="mt-1 text-xs text-[var(--ink-soft)]">Builds a full round robin within each group.</p></div>
              <button onClick={generateSchedule} disabled={busy || unassignedTeams.length > 0} className="rounded-full bg-[var(--lime)] px-5 py-2.5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Working..." : "Generate matches"}</button>
            </div>
            {unassignedTeams.length > 0 && <p className="mt-2 text-xs font-semibold text-[#f2a08c]">{unassignedTeams.length} team{unassignedTeams.length === 1 ? "" : "s"} not yet assigned to a group.</p>}
          </section>
        )}

        {/* Knockout bracket */}
        {canManage && allPoolsScored && tournament.bracketMatches.length === 0 && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <h2 className="font-extrabold">Generate knockout bracket</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">Group play is complete. Pick how many teams advance from each pool.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-[#c3d0c5]">Advance per group
                <input type="number" min="1" value={advancePerPool} onChange={(event) => setAdvancePerPool(Math.max(1, Number(event.target.value)))} className="mt-2 h-11 w-24 rounded-xl border border-[var(--line)] px-3 text-sm" />
              </label>
              <button onClick={generateBracket} disabled={busy} className="mt-6 rounded-full bg-[var(--lime)] px-5 py-2.5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Working..." : "Generate bracket"}</button>
            </div>
          </section>
        )}

        {tournament.bracketMatches.length > 0 && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <div className="flex items-center gap-2"><Trophy size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Knockout bracket</h2></div>
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
              {bracketRounds.map((round) => (
                <div key={round} className="w-64 shrink-0 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">{bracketRoundLabel(round, totalBracketRounds)}</p>
                  {tournament.bracketMatches.filter((bracketMatch) => bracketMatch.round === round).map((bracketMatch) => (
                    <div key={bracketMatch.id} className="rounded-xl border border-[var(--line)] p-3">
                      {bracketMatch.match ? (
                        <MatchCard match={bracketMatch.match} onSave={saveScore} onDelete={deleteMatchFn} canScore={isOwner || (Boolean(myUserId) && bracketMatch.match.players.some((player) => player.userId === myUserId))} canDelete={isOwner} />
                      ) : (
                        <div className="space-y-2 text-sm font-bold text-[var(--ink-soft)]">
                          <p>{bracketMatch.teamA ? teamName(bracketMatch.teamA) : "TBD"}</p>
                          <p className="text-xs">vs</p>
                          <p>{bracketMatch.teamB ? teamName(bracketMatch.teamB) : "TBD"}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pools: matches + standings */}
        {tournament.pools.length > 0 && (
          <div className="mt-6 space-y-6">
            {tournament.pools.map((pool) => {
              const poolStandings = standings.find((entry) => entry.poolId === pool.id);
              return (
                <section key={pool.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
                  <div className="flex items-center gap-2"><Award size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">{pool.name}</h2><span className="text-xs text-[var(--ink-soft)]">{pool.teams.length} teams</span></div>
                  <div className="mt-3 flex flex-wrap gap-2">{pool.teams.map((team) => <span key={team.id} className="rounded-full bg-[#1e2b17] px-3 py-1.5 text-xs font-bold text-[#c7e572]">{teamName(team)}</span>)}</div>
                  {pool.matches.length > 0 && (
                    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_.4fr]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {pool.matches.map((match) => {
                          const isPlaying = Boolean(myUserId) && match.players.some((player) => player.userId === myUserId);
                          return <MatchCard key={match.id} match={match} onSave={saveScore} onDelete={deleteMatchFn} canScore={isOwner || isPlaying} canDelete={isOwner} />;
                        })}
                      </div>
                      {poolStandings && (
                        <div className="rounded-[16px] bg-[#131f19] p-4">
                          <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">Standings</p>
                          <div className="mt-3 space-y-2">
                            {poolStandings.standings.map((entry) => (
                              <div key={entry.teamId} className="flex items-center gap-2 rounded-xl bg-[var(--panel)] px-3 py-2.5">
                                <span className="w-5 text-xs font-black text-[var(--lime-deep)]">{entry.rank}</span>
                                <span className="flex-1 truncate text-xs font-bold">{entry.teamName}</span>
                                <span className="text-xs font-black">{entry.wins}-{entry.losses}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
