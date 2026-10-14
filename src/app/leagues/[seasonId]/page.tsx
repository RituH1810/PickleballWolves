"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Award, CalendarDays, Check, Copy, Mail, MessageCircle, Plus, Share2, Trash2, Trophy, Users, X } from "lucide-react";
import { AddToCalendar } from "@/components/add-to-calendar";

type MatchPlayerT = { userId: string; name: string; side: "A" | "B" };
type MatchT = { id: string; courtNumber: number | null; players: MatchPlayerT[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
type WeekMatch = { weekNumber: number; scheduledAt: string; matchId: string; courtNumber: number | null; leagueTeamAId: string | null; leagueTeamBId: string | null; players: MatchPlayerT[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
type RegistrationT = { id: string; name: string; skillRating: string; status: string };
type PlatformPlayer = { id: string; name: string; skillRating: string };
type TeamT = { id: string; members: { id: string; name: string }[] };
type DivisionT = { id: string; name: string; minSkillRating: string | null; maxSkillRating: string | null; registrations: RegistrationT[]; teams: TeamT[]; weeks: WeekMatch[] };
type SeasonT = {
  id: string; name: string; startDate: string; endDate: string; registrationOpensAt: string; registrationClosesAt: string; status: string; playoffsEnabled: boolean;
  league: { id: string; name: string; format: string; description: string | null; createdBy: { id: string; name: string } };
  isOwner: boolean; hasScores: boolean; divisions: DivisionT[];
};
type DivisionStanding = { divisionId: string; divisionName: string; standings: { rank: number; teamId: string; teamName: string; wins: number; losses: number; scored: number; conceded: number; differential: number }[] };

const statusLabels: Record<string, string> = { UPCOMING: "Upcoming", ACTIVE: "Active", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const formatLabels: Record<string, string> = { SINGLES: "Singles", DOUBLES: "Doubles" };

function MatchCard({ match, onSave, onDelete, canScore, canDelete, weekNumber }: { match: MatchT; onSave: (matchId: string, sideA: string, sideB: string) => void; onDelete: (matchId: string) => void; canScore: boolean; canDelete: boolean; weekNumber: number }) {
  const [sideA, setSideA] = useState(match.scores[0]?.sideAScore?.toString() ?? "");
  const [sideB, setSideB] = useState(match.scores[0]?.sideBScore?.toString() ?? "");
  const hasScore = match.scores.length > 0;
  return (
    <article className="rounded-xl border border-[var(--line)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Week {weekNumber}</span>
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

export default function SeasonDetailPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = use(params);
  const [season, setSeason] = useState<SeasonT | null>(null);
  const [standings, setStandings] = useState<DivisionStanding[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionMin, setNewDivisionMin] = useState("");
  const [newDivisionMax, setNewDivisionMax] = useState("");
  const [addEmailByDivision, setAddEmailByDivision] = useState<Record<string, string>>({});
  const [pendingPartnerByDivision, setPendingPartnerByDivision] = useState<Record<string, string | null>>({});
  const [manualPairsByDivision, setManualPairsByDivision] = useState<Record<string, [string, string][]>>({});
  const [matchesPerPairingByDivision, setMatchesPerPairingByDivision] = useState<Record<string, number>>({});
  const [players, setPlayers] = useState<PlatformPlayer[]>([]);
  const [pickerOpenByDivision, setPickerOpenByDivision] = useState<Record<string, boolean>>({});
  const [selectedByDivision, setSelectedByDivision] = useState<Record<string, string[]>>({});
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  function showNotice(text: string, type: "success" | "error") {
    setNotice({ text, type });
    if (type === "error") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadAll() {
    const [seasonResponse, standingsResponse] = await Promise.all([fetch(`/api/leagues/${seasonId}`), fetch(`/api/leagues/${seasonId}/standings`)]);
    if (seasonResponse.ok) setSeason((await seasonResponse.json()).season);
    if (standingsResponse.ok) setStandings((await standingsResponse.json()).divisions);
  }
  useEffect(() => {
    Promise.all([fetch(`/api/leagues/${seasonId}`), fetch(`/api/leagues/${seasonId}/standings`)]).then(async ([seasonResponse, standingsResponse]) => {
      if (seasonResponse.ok) setSeason((await seasonResponse.json()).season);
      if (standingsResponse.ok) setStandings((await standingsResponse.json()).divisions);
    }).finally(() => setLoading(false));
  }, [seasonId]);
  useEffect(() => { fetch("/api/profile").then((response) => response.ok ? response.json() : null).then((data) => setMyUserId(data?.profile?.id ?? null)); }, []);
  const isOwnerForPlayers = season?.isOwner;
  useEffect(() => {
    if (!isOwnerForPlayers) return;
    fetch("/api/players").then((response) => response.ok ? response.json() : null).then((data) => setPlayers(data?.players ?? []));
  }, [isOwnerForPlayers]);

  // Keep other viewers' screens live while scores are still being entered, same pattern as the
  // round robin room and tournament pages. Stops once the season is over.
  const seasonStatus = season?.status;
  useEffect(() => {
    if (!seasonStatus || seasonStatus === "COMPLETED" || seasonStatus === "CANCELLED") return;
    const interval = setInterval(() => {
      Promise.all([fetch(`/api/leagues/${seasonId}`), fetch(`/api/leagues/${seasonId}/standings`)]).then(async ([seasonResponse, standingsResponse]) => {
        if (seasonResponse.ok) setSeason((await seasonResponse.json()).season);
        if (standingsResponse.ok) setStandings((await standingsResponse.json()).divisions);
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [seasonId, seasonStatus]);

  async function createDivision() {
    if (!newDivisionName.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/leagues/${seasonId}/divisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDivisionName.trim(), minSkillRating: newDivisionMin || undefined, maxSkillRating: newDivisionMax || undefined }) });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to create division.", "error"); setBusy(false); return; }
    setNewDivisionName(""); setNewDivisionMin(""); setNewDivisionMax("");
    showNotice("Division created.", "success");
    await loadAll();
    setBusy(false);
  }

  async function registerSelf(divisionId: string, override = false) {
    setBusy(true);
    const response = await fetch(`/api/leagues/divisions/${divisionId}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ override }) });
    const data = await response.json();
    if (!response.ok) {
      setBusy(false);
      if (data.skillMismatch && !override && window.confirm(`${data.error} Register anyway?`)) { await registerSelf(divisionId, true); return; }
      showNotice(data.error ?? "Unable to register.", "error");
      return;
    }
    showNotice("You're registered!", "success");
    await loadAll();
    setBusy(false);
  }

  async function withdrawSelf(divisionId: string) {
    setBusy(true);
    await fetch(`/api/leagues/divisions/${divisionId}/register`, { method: "DELETE" });
    showNotice("Withdrawn.", "success");
    await loadAll();
    setBusy(false);
  }

  async function addRegistration(divisionId: string, override = false) {
    const email = addEmailByDivision[divisionId]?.trim();
    if (!email) return;
    setBusy(true);
    const response = await fetch(`/api/leagues/divisions/${divisionId}/registrations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, override }) });
    const data = await response.json();
    if (!response.ok) {
      setBusy(false);
      if (data.skillMismatch && !override && window.confirm(`${data.error} Add anyway?`)) { await addRegistration(divisionId, true); return; }
      showNotice(data.error ?? "Unable to add player.", "error");
      return;
    }
    setAddEmailByDivision((current) => ({ ...current, [divisionId]: "" }));
    showNotice("Player added.", "success");
    await loadAll();
    setBusy(false);
  }

  function togglePlayerSelected(divisionId: string, userId: string) {
    setSelectedByDivision((current) => {
      const selected = current[divisionId] ?? [];
      return { ...current, [divisionId]: selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId] };
    });
  }

  async function addSelectedPlayers(divisionId: string) {
    const selected = selectedByDivision[divisionId] ?? [];
    if (!selected.length) return;
    setBusy(true);
    let added = 0;
    for (const userId of selected) {
      const response = await fetch(`/api/leagues/divisions/${divisionId}/registrations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, override: true }) });
      if (response.ok) added += 1;
    }
    setSelectedByDivision((current) => ({ ...current, [divisionId]: [] }));
    setPickerOpenByDivision((current) => ({ ...current, [divisionId]: false }));
    showNotice(`Added ${added} player${added === 1 ? "" : "s"}.`, "success");
    await loadAll();
    setBusy(false);
  }

  function toggleShare() {
    setShowShare((current) => !current);
    if (shareUrl) return;
    const url = `${window.location.origin}/leagues/${seasonId}`;
    setShareUrl(url);
    setShareMessage(`Join ${season?.name} on PickleballWolves: ${url}`);
  }
  async function copyShareUrl() {
    try { await navigator.clipboard.writeText(shareUrl); showNotice("Link copied!", "success"); } catch { showNotice("Unable to copy the link.", "error"); }
  }

  async function removeRegistration(divisionId: string, userId: string) {
    if (!window.confirm("Remove this player from the division?")) return;
    setBusy(true);
    await fetch(`/api/leagues/divisions/${divisionId}/registrations/${userId}`, { method: "DELETE" });
    await loadAll();
    setBusy(false);
  }

  async function formTeams(divisionId: string, method: string, pairs?: [string, string][]) {
    setBusy(true);
    const response = await fetch(`/api/leagues/divisions/${divisionId}/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, pairs }) });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to form teams.", "error"); setBusy(false); return; }
    setManualPairsByDivision((current) => ({ ...current, [divisionId]: [] }));
    setPendingPartnerByDivision((current) => ({ ...current, [divisionId]: null }));
    showNotice(`Formed ${data.teamsFormed} team${data.teamsFormed === 1 ? "" : "s"}${data.unpairedCount ? `, ${data.unpairedCount} left unpaired` : ""}.`, "success");
    await loadAll();
    setBusy(false);
  }

  async function generateSchedule(divisionId: string, isSingles: boolean) {
    setBusy(true);
    // Singles divisions never show the team-formation UI, so lock the (trivial, one-member)
    // teams in right before generating.
    if (isSingles) {
      const teamsResponse = await fetch(`/api/leagues/divisions/${divisionId}/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "AUTO_RANDOM" }) });
      if (!teamsResponse.ok) { showNotice((await teamsResponse.json()).error ?? "Unable to finalize the roster.", "error"); setBusy(false); return; }
    }
    const matchesPerPairing = matchesPerPairingByDivision[divisionId] ?? 1;
    const response = await fetch(`/api/leagues/divisions/${divisionId}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchesPerPairing }) });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to generate the schedule.", "error"); setBusy(false); return; }
    showNotice(`Generated ${data.matches} matches across ${data.weeks} week${data.weeks === 1 ? "" : "s"}.`, "success");
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

  function toggleManualPairing(divisionId: string, userId: string) {
    const pairs = manualPairsByDivision[divisionId] ?? [];
    const paired = new Set(pairs.flat());
    const pendingPartner = pendingPartnerByDivision[divisionId] ?? null;
    if (paired.has(userId)) { setManualPairsByDivision((current) => ({ ...current, [divisionId]: pairs.filter((pair) => !pair.includes(userId)) })); return; }
    if (pendingPartner === userId) { setPendingPartnerByDivision((current) => ({ ...current, [divisionId]: null })); return; }
    if (pendingPartner) { setManualPairsByDivision((current) => ({ ...current, [divisionId]: [...pairs, [pendingPartner, userId]] })); setPendingPartnerByDivision((current) => ({ ...current, [divisionId]: null })); return; }
    setPendingPartnerByDivision((current) => ({ ...current, [divisionId]: userId }));
  }

  if (loading) return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton mt-6 h-16 w-2/3 max-w-lg rounded-xl" /></div>
    </main>
  );
  if (!season) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[var(--foreground)]">Season not found.</p><Link href="/leagues" className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Back to leagues</Link></div></main>;

  const isOwner = season.isOwner;
  const isSingles = season.league.format === "SINGLES";

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/leagues" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to leagues</Link>
        <div className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">{season.league.name} · {formatLabels[season.league.format] ?? season.league.format}</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">{season.name}</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">Organized by <span className="font-bold text-[var(--foreground)]">{isOwner ? "you" : season.league.createdBy.name}</span></p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[var(--lime-deep)]"><CalendarDays size={15} />{new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#1e2b17] px-4 text-xs font-bold text-[#c7e572]"><Trophy size={13} />{statusLabels[season.status] ?? season.status}</span>
            <button onClick={toggleShare} className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]"><Share2 size={14} />Share</button>
          </div>
        </div>

        {notice && <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1e2b17] text-[#c7e572]"}`}>{notice.text}</p>}

        {showShare && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">Share this season</p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">Anyone signed in can follow this link to view divisions and register themselves while registration is open.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input readOnly value={shareUrl} onFocus={(event) => event.target.select()} className="h-11 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm text-[var(--ink-soft)] outline-none" />
              <button onClick={copyShareUrl} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-5 text-sm font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><Copy size={15} />Copy</button>
            </div>
            <label className="mt-3 block text-xs font-bold text-[#c3d0c5]">Message -- edit freely, send whenever you like
              <textarea value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--lime-deep)]" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><MessageCircle size={14} />WhatsApp</a>
              <a href={`sms:?body=${encodeURIComponent(shareMessage)}`} className="flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><MessageCircle size={14} />Text</a>
              <a href={`mailto:?subject=${encodeURIComponent(`${season.name}`)}&body=${encodeURIComponent(shareMessage)}`} className="flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><Mail size={14} />Email</a>
            </div>
          </section>
        )}

        {isOwner && (
          <section className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <h2 className="font-extrabold">Create a division</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">Optionally set a skill rating band (2.0-6.0) to keep matches competitive. Leave blank for an open division.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <input value={newDivisionName} onChange={(event) => setNewDivisionName(event.target.value)} placeholder="Division name (e.g. Open, 3.5+)" className="h-11 rounded-xl border border-[var(--line)] px-3 text-sm" />
              <input value={newDivisionMin} onChange={(event) => setNewDivisionMin(event.target.value)} placeholder="Min" type="number" step="0.1" min="2" max="6" className="h-11 w-20 rounded-xl border border-[var(--line)] px-3 text-sm" />
              <input value={newDivisionMax} onChange={(event) => setNewDivisionMax(event.target.value)} placeholder="Max" type="number" step="0.1" min="2" max="6" className="h-11 w-20 rounded-xl border border-[var(--line)] px-3 text-sm" />
              <button onClick={createDivision} disabled={busy || !newDivisionName.trim()} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60"><Plus size={14} />Add division</button>
            </div>
          </section>
        )}

        {season.divisions.length === 0 && (
          <div className="mt-6 flex items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">
            No divisions yet.{isOwner ? " Create one above to open registration." : ""}
          </div>
        )}

        {season.divisions.map((division) => {
          const registered = division.registrations.filter((registration) => registration.status === "REGISTERED");
          const myRegistration = myUserId ? registered.find((registration) => registration.id === myUserId) : undefined;
          const now = new Date();
          const registrationOpen = now >= new Date(season.registrationOpensAt) && now <= new Date(season.registrationClosesAt);
          const pairedIds = new Set(division.teams.flatMap((team) => team.members.map((member) => member.id)));
          const unpairedRegistrations = registered.filter((registration) => !pairedIds.has(registration.id));
          const manualPairs = manualPairsByDivision[division.id] ?? [];
          const manuallyPairedIds = new Set(manualPairs.flat());
          const pendingPartner = pendingPartnerByDivision[division.id] ?? null;
          const hasSchedule = division.weeks.length > 0;
          const weekNumbers = [...new Set(division.weeks.map((week) => week.weekNumber))].sort((a, b) => a - b);
          // The viewer's own unplayed matches, for the "add to calendar" export.
          const myUpcoming = myUserId ? division.weeks.filter((week) => week.scores.length === 0 && new Date(week.scheduledAt) >= now && week.players.some((player) => player.userId === myUserId)) : [];
          const calendarItems = myUpcoming.map((week) => {
            const mySide = week.players.find((player) => player.userId === myUserId)!.side;
            const partners = week.players.filter((player) => player.side === mySide && player.userId !== myUserId).map((player) => player.name);
            const opponents = week.players.filter((player) => player.side !== mySide).map((player) => player.name);
            return { uid: `leagueMatch-${week.matchId}`, title: `${season.league.name} - Week ${week.weekNumber}`, start: week.scheduledAt, durationMinutes: 90, description: `${partners.length ? `With ${partners.join(" & ")} ` : ""}vs ${opponents.join(" & ") || "TBD"}${week.courtNumber ? ` · Court ${week.courtNumber}` : ""}`, url: `/leagues/${seasonId}` };
          });
          const divisionStandings = standings.find((entry) => entry.divisionId === division.id);
          const band = division.minSkillRating || division.maxSkillRating ? `${division.minSkillRating ?? "any"}–${division.maxSkillRating ?? "any"}` : null;

          return (
            <section key={division.id} className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Award size={17} className="text-[var(--lime-deep)]" />
                <h2 className="font-extrabold">{division.name}</h2>
                {band && <span className="rounded-full bg-[#1c2a1a] px-2.5 py-1 text-[10px] font-bold text-[var(--ink-soft)]">{band} rating</span>}
              </div>

              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{registered.length} registered{!registrationOpen ? " · Registration closed" : ""}</p>
                  {registrationOpen && !hasSchedule && (myRegistration ? <button onClick={() => withdrawSelf(division.id)} disabled={busy} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]">Withdraw</button> : <button onClick={() => registerSelf(division.id)} disabled={busy} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">Register</button>)}
                </div>
                {isOwner && !hasSchedule && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input value={addEmailByDivision[division.id] ?? ""} onChange={(event) => setAddEmailByDivision((current) => ({ ...current, [division.id]: event.target.value }))} placeholder="player@email.com" type="email" className="h-11 flex-1 rounded-xl border border-[var(--line)] px-4 text-sm" />
                    <button onClick={() => addRegistration(division.id)} disabled={busy || !addEmailByDivision[division.id]?.trim()} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60"><Plus size={14} />Add player</button>
                  </div>
                )}
                {isOwner && !hasSchedule && (
                  <div className="mt-3">
                    <button onClick={() => setPickerOpenByDivision((current) => ({ ...current, [division.id]: !current[division.id] }))} className="text-xs font-bold text-[var(--lime-deep)]">{pickerOpenByDivision[division.id] ? "Hide player list" : "Or pick from all players"}</button>
                    {pickerOpenByDivision[division.id] && (() => {
                      const registeredIds = new Set(registered.map((registration) => registration.id));
                      const candidates = players.filter((player) => !registeredIds.has(player.id));
                      const selected = selectedByDivision[division.id] ?? [];
                      if (candidates.length === 0) return <p className="mt-2 text-sm text-[var(--ink-soft)]">Everyone on the platform is already registered.</p>;
                      return (
                        <>
                          <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                            {candidates.map((player) => (
                              <button key={player.id} onClick={() => togglePlayerSelected(division.id, player.id)} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${selected.includes(player.id) ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                                <span><span className="font-bold">{player.name}</span><span className="ml-2 text-xs text-[var(--ink-soft)]">{player.skillRating}</span></span>
                                {selected.includes(player.id) && <Check size={15} className="text-[var(--lime-deep)]" />}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => addSelectedPlayers(division.id)} disabled={busy || selected.length === 0} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{`Add ${selected.length || ""} to division`.trim()}</button>
                        </>
                      );
                    })()}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {registered.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No one registered yet.</p>}
                  {registered.map((registration) => (
                    <span key={registration.id} className="flex items-center gap-1.5 rounded-full bg-[#1e2b17] px-3 py-1.5 text-xs font-bold text-[#c7e572]">
                      {registration.name}
                      {isOwner && !hasSchedule && <button onClick={() => removeRegistration(division.id, registration.id)} aria-label={`Remove ${registration.name}`}><X size={12} /></button>}
                    </span>
                  ))}
                </div>
              </div>

              {isOwner && !isSingles && !hasSchedule && (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{division.teams.length} team{division.teams.length === 1 ? "" : "s"} formed · {unpairedRegistrations.length} unpaired</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => formTeams(division.id, "AUTO_BALANCED")} disabled={busy} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">Auto: balanced</button>
                    <button onClick={() => formTeams(division.id, "AUTO_RANDOM")} disabled={busy} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a] disabled:cursor-not-allowed disabled:opacity-60">Auto: random</button>
                  </div>
                  {unpairedRegistrations.length > 0 && (
                    <div className="mt-3 border-t border-[var(--line)] pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Or pair manually -- tap two players</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {unpairedRegistrations.map((registration) => {
                          const paired = manuallyPairedIds.has(registration.id);
                          const isPending = pendingPartner === registration.id;
                          return <button key={registration.id} onClick={() => toggleManualPairing(division.id, registration.id)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${paired ? "border-[var(--lime-deep)] bg-[#1e2b17] text-[#c7e572]" : isPending ? "border-[var(--lime)] bg-[var(--lime)] text-[#0f1712]" : "border-[var(--line)] text-[var(--foreground)] hover:border-[var(--lime-deep)]"}`}>{registration.name}{isPending ? " · pick a partner" : ""}</button>;
                        })}
                      </div>
                      {manualPairs.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {manualPairs.map(([a, b]) => {
                            const nameOf = (id: string) => division.registrations.find((registration) => registration.id === id)?.name ?? "Unknown";
                            return <div key={`${a}-${b}`} className="flex items-center justify-between rounded-xl bg-[#131f19] px-4 py-2.5 text-sm font-bold text-[var(--foreground)]"><span>{nameOf(a)} &amp; {nameOf(b)}</span><button onClick={() => toggleManualPairing(division.id, a)} className="text-xs font-bold text-[var(--lime-deep)]">Unpair</button></div>;
                          })}
                          <button onClick={() => formTeams(division.id, "MANUAL", manualPairs)} disabled={busy} className="mt-1 rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">Save {manualPairs.length} manual team{manualPairs.length === 1 ? "" : "s"}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isOwner && !hasSchedule && (isSingles ? registered.length >= 2 : division.teams.length >= 2) && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                  <div><h3 className="text-sm font-extrabold">Generate schedule</h3><p className="mt-1 text-xs text-[var(--ink-soft)]">Builds a full round robin, one week per round.</p></div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 rounded-full bg-[#1a2a1c] p-1">
                      {[1, 2, 3].map((count) => (
                        <button key={count} onClick={() => setMatchesPerPairingByDivision((current) => ({ ...current, [division.id]: count }))} className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${(matchesPerPairingByDivision[division.id] ?? 1) === count ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm" : "text-[var(--ink-soft)]"}`}>{count}&times;</button>
                      ))}
                    </div>
                    <button onClick={() => generateSchedule(division.id, isSingles)} disabled={busy} className="rounded-full bg-[var(--lime)] px-5 py-2.5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Working..." : "Generate matches"}</button>
                  </div>
                </div>
              )}

              {hasSchedule && (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  {calendarItems.length > 0 && <div className="mb-4 flex justify-end"><AddToCalendar items={calendarItems} label={`Add my ${calendarItems.length} match${calendarItems.length === 1 ? "" : "es"} to calendar`} fileName={`${season.league.name}-${division.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")} /></div>}
                  <div className="grid gap-6 lg:grid-cols-[1fr_.4fr]">
                    <div className="space-y-4">
                      {weekNumbers.map((weekNumber) => (
                        <div key={weekNumber}>
                          <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">Week {weekNumber}</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {division.weeks.filter((week) => week.weekNumber === weekNumber).map((week) => {
                              const isPlaying = Boolean(myUserId) && week.players.some((player) => player.userId === myUserId);
                              const matchForCard: MatchT = { id: week.matchId, courtNumber: week.courtNumber, players: week.players, scores: week.scores };
                              return <MatchCard key={`${week.matchId}:${week.scores[0]?.sideAScore ?? ""}:${week.scores[0]?.sideBScore ?? ""}`} match={matchForCard} onSave={saveScore} onDelete={deleteMatchFn} canScore={isOwner || isPlaying} canDelete={isOwner} weekNumber={weekNumber} />;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {divisionStandings && (
                      <div className="h-fit rounded-[16px] bg-[#131f19] p-4">
                        <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">Standings</p>
                        <div className="mt-3 space-y-2">
                          {divisionStandings.standings.map((entry) => (
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
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
