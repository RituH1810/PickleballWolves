"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Copy, Mail, MessageCircle, Share2, Trophy, Users } from "lucide-react";
import { LivePulse } from "@/components/pickleball-art";

type Match = { id: string; courtNumber: number | null; players: { userId: string; name: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
type Round = { id: string; roundNumber: number; matches: Match[] };
type Standing = { rank: number; name: string; wins: number; losses: number; differential: number };
type JoinedPlayer = { id: string; name: string };
type RoomInfo = { name: string; format: string; partnerFormat: string; playFormat: string; status: string; isOwner: boolean; organizerName: string; hasScores: boolean; groupId: string | null; groupName: string | null; joinedPlayers: JoinedPlayer[]; joinedCount: number; myRsvpStatus: "JOINED" | "DECLINED" | null; isGroupMember: boolean; scheduledAt: string | null };

const playFormatLabels: Record<string, string> = { SINGLES: "Singles", DOUBLES: "Doubles", MIXED: "Mixed doubles" };
const partnerFormatLabels: Record<string, string> = { ROTATE: "Rotating partners", FIXED: "Fixed partners" };

export default function RoundRobinRoomPage({ params }: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = use(params);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [ending, setEnding] = useState(false);
  const [teams, setTeams] = useState<[string, string][]>([]);
  const [pendingPartner, setPendingPartner] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [loadingShare, setLoadingShare] = useState(false);

  function showNotice(text: string, type: "success" | "error") {
    setNotice({ text, type });
    if (type === "error") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadRoom() {
    const [roomResponse, standingsResponse] = await Promise.all([fetch(`/api/round-robin/${roundRobinId}`), fetch(`/api/round-robin/${roundRobinId}/standings`)]);
    if (roomResponse.ok) {
      const room = await roomResponse.json();
      setRoom(room.roundRobin ?? null);
      setRounds(room.roundRobin?.rounds ?? []);
    }
    if (standingsResponse.ok) {
      const table = await standingsResponse.json();
      setStandings(table.standings ?? []);
    }
  }

  useEffect(() => {
    Promise.all([fetch(`/api/round-robin/${roundRobinId}`), fetch(`/api/round-robin/${roundRobinId}/standings`)]).then(async ([roomResponse, standingsResponse]) => {
      if (roomResponse.ok) {
        const room = await roomResponse.json();
        setRoom(room.roundRobin ?? null);
        setRounds(room.roundRobin?.rounds ?? []);
      }
      if (standingsResponse.ok) {
        const table = await standingsResponse.json();
        setStandings(table.standings ?? []);
      }
    }).finally(() => setLoading(false));
  }, [roundRobinId]);

  async function saveScore(matchId: string, sideAScore: string, sideBScore: string) {
    const response = await fetch(`/api/matches/${matchId}/score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sideAScore: Number(sideAScore), sideBScore: Number(sideBScore), gameNumber: 1 }) });
    if (response.ok) { showNotice("Score saved and standings updated.", "success"); loadRoom(); }
    else showNotice((await response.json()).error ?? "Unable to save score.", "error");
  }

  async function endRoundRobin() {
    setEnding(true);
    const response = await fetch(`/api/round-robin/${roundRobinId}/complete`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to end this round robin.", "error"); setEnding(false); return; }
    setRoom((current) => current ? { ...current, status: "COMPLETED" } : current);
    showNotice("Round robin ended.", "success");
    setEnding(false);
  }

  async function respondRsvp(status: "JOINED" | "DECLINED") {
    const response = await fetch(`/api/round-robin/${roundRobinId}/rsvp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to update your RSVP.", "error"); return; }
    await loadRoom();
    showNotice(status === "JOINED" ? "You're in!" : "You declined this round robin.", "success");
  }

  function toggleJoinedPairing(playerId: string) {
    const pairedPlayerIds = new Set(teams.flat());
    if (pairedPlayerIds.has(playerId)) {
      setTeams((current) => current.filter((team) => !team.includes(playerId)));
      return;
    }
    if (pendingPartner === playerId) { setPendingPartner(null); return; }
    if (pendingPartner) { setTeams((current) => [...current, [pendingPartner, playerId]]); setPendingPartner(null); return; }
    setPendingPartner(playerId);
  }

  async function generateFromJoined(needsFixedTeams: boolean) {
    if (needsFixedTeams && teams.length < 2) { showNotice("Pair up at least two teams.", "error"); return; }
    setGenerating(true);
    const body = needsFixedTeams ? { teams } : {};
    const response = await fetch(`/api/round-robin/${roundRobinId}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { showNotice(data.error ?? "Unable to generate schedule.", "error"); setGenerating(false); return; }
    await loadRoom();
    showNotice("Schedule generated!", "success");
    setGenerating(false);
  }

  async function toggleShare() {
    setShowShare((current) => !current);
    if (shareUrl) return;
    setLoadingShare(true);
    if (room?.groupId) {
      const response = await fetch(`/api/groups/${room.groupId}/invite-link`, { method: "POST" });
      const data = await response.json();
      if (response.ok && data.url) setShareUrl(`${data.url}&next=${encodeURIComponent(`/round-robin/${roundRobinId}`)}`);
      else showNotice(data.error ?? "Unable to generate a share link.", "error");
    } else {
      setShareUrl(`${window.location.origin}/round-robin/${roundRobinId}`);
    }
    setLoadingShare(false);
  }

  async function copyShareUrl() {
    try { await navigator.clipboard.writeText(shareUrl); showNotice("Link copied!", "success"); } catch { showNotice("Unable to copy the link.", "error"); }
  }

  if (loading) return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton mt-6 h-16 w-2/3 max-w-lg rounded-xl" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.35fr]">
          <div className="space-y-4">{Array.from({ length: 2 }).map((_, index) => <div key={index} className="skeleton h-40 rounded-[20px]" />)}</div>
          <div className="skeleton h-64 rounded-[20px]" />
        </div>
      </div>
    </main>
  );
  if (!room) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[var(--foreground)]">Round robin not found.</p><Link href="/round-robin" className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Build a new one</Link></div></main>;

  const needsFixedTeams = room.playFormat !== "SINGLES" && room.partnerFormat === "FIXED";
  const pairedPlayerIds = new Set(teams.flat());
  function joinedPlayerName(id: string) { return room?.joinedPlayers.find((player) => player.id === id)?.name ?? "Unknown"; }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/round-robin" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to round robin builder</Link>
        <div className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">{partnerFormatLabels[room.partnerFormat] ?? room.partnerFormat} · {playFormatLabels[room.playFormat] ?? room.playFormat}</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">{room.name}</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">Organized by <span className="font-bold text-[var(--foreground)]">{room.isOwner ? "you" : room.organizerName}</span>{room.groupName && <> for <span className="font-bold text-[var(--foreground)]">{room.groupName}</span></>}</p>
            {room.scheduledAt && <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[var(--lime-deep)]"><CalendarDays size={15} />{new Date(room.scheduledAt).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${room.status === "COMPLETED" ? "bg-[#1c2a1a] text-[var(--ink-soft)]" : "bg-[#1e2b17] text-[#c7e572]"}`}>{room.status === "LIVE" ? <LivePulse color="#c7e572" size={9} /> : <Check size={15} />}{room.status === "LIVE" ? "Live schedule" : room.status === "COMPLETED" ? "Completed" : room.status}</span>
            <button onClick={toggleShare} className="flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]"><Share2 size={14} />Share</button>
            {room.isOwner && !room.hasScores && <Link href={`/round-robin/${roundRobinId}/edit`} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]">Edit round robin</Link>}
            {room.isOwner && room.status !== "COMPLETED" && <button onClick={endRoundRobin} disabled={ending} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a] disabled:cursor-not-allowed disabled:opacity-60">{ending ? "Ending..." : "End round robin"}</button>}
          </div>
        </div>
        {notice && (
          <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1e2b17] text-[#c7e572]"}`}>{notice.text}</p>
        )}

        {showShare && (
          <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">Share this round robin</p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">{room.groupId ? "Anyone who opens this link joins the group and lands right here." : "Send this link on WhatsApp, text, email, or anywhere else."}</p>
            {loadingShare ? (
              <div className="skeleton mt-3 h-11 rounded-xl" />
            ) : shareUrl ? (
              <>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={shareUrl} onFocus={(event) => event.target.select()} className="h-11 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm text-[var(--ink-soft)] outline-none" />
                  <button onClick={copyShareUrl} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-5 text-sm font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><Copy size={15} />Copy</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Join us for ${room.name} on PickleballWolves: ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><MessageCircle size={14} />WhatsApp</a>
                  <a href={`sms:?body=${encodeURIComponent(`Join us for ${room.name} on PickleballWolves: ${shareUrl}`)}`} className="flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><MessageCircle size={14} />Text</a>
                  <a href={`mailto:?subject=${encodeURIComponent(`Join us for ${room.name}`)}&body=${encodeURIComponent(`Join us for ${room.name} on PickleballWolves: ${shareUrl}`)}`} className="flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]"><Mail size={14} />Email</a>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--ink-soft)]">Unable to load a share link right now.</p>
            )}
          </section>
        )}

        {room.groupId && room.status === "SETUP" && (
          <section className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold">Who&apos;s in</h2>
                <p className="mt-1 text-xs text-[var(--ink-soft)]">{room.groupName ?? "Group"} members can join or decline. The schedule generates from who joins.</p>
              </div>
              {room.isGroupMember && (
                <div className="flex gap-2">
                  <button onClick={() => respondRsvp("JOINED")} className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${room.myRsvpStatus === "JOINED" ? "bg-[var(--lime)] text-[#0f1712]" : "border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]"}`}>{room.myRsvpStatus === "JOINED" ? "You're in" : "Join"}</button>
                  <button onClick={() => respondRsvp("DECLINED")} className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${room.myRsvpStatus === "DECLINED" ? "bg-[var(--coral)] text-[#2e1a16]" : "border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]"}`}>{room.myRsvpStatus === "DECLINED" ? "Declined" : "Decline"}</button>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {room.joinedPlayers.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No one has joined yet.</p>}
              {room.joinedPlayers.map((player) => <span key={player.id} className="rounded-full bg-[#1e2b17] px-3 py-1.5 text-xs font-bold text-[#c7e572]">{player.name}</span>)}
            </div>
            {room.isOwner && (
              <div className="mt-5 border-t border-[var(--line)] pt-5">
                {needsFixedTeams ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Pair up teams from who&apos;s joined</p>
                    {room.joinedPlayers.length === 0 ? <p className="mt-3 text-sm text-[var(--ink-soft)]">Wait for members to join first.</p> : (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {room.joinedPlayers.map((player) => {
                            const paired = pairedPlayerIds.has(player.id);
                            const isPending = pendingPartner === player.id;
                            return (
                              <button key={player.id} onClick={() => toggleJoinedPairing(player.id)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${paired ? "border-[var(--lime-deep)] bg-[#1e2b17] text-[#c7e572]" : isPending ? "border-[var(--lime)] bg-[var(--lime)] text-[#0f1712]" : "border-[var(--line)] text-[var(--foreground)] hover:border-[var(--lime-deep)]"}`}>
                                {player.name}{isPending ? " · pick a partner" : ""}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-4 space-y-2">
                          {teams.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No teams yet.</p>}
                          {teams.map(([a, b], index) => (
                            <div key={`${a}-${b}`} className="flex items-center justify-between rounded-xl bg-[#131f19] px-4 py-2.5 text-sm font-bold text-[var(--foreground)]">
                              <span>Team {index + 1}: {joinedPlayerName(a)} &amp; {joinedPlayerName(b)}</span>
                              <button onClick={() => toggleJoinedPairing(a)} className="text-xs font-bold text-[var(--lime-deep)]">Unpair</button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[var(--ink-soft)]">{room.joinedPlayers.length < 4 ? `Need at least ${4 - room.joinedPlayers.length} more member${4 - room.joinedPlayers.length === 1 ? "" : "s"} to join before generating.` : "Ready to generate the schedule."}</p>
                )}
                <button onClick={() => generateFromJoined(needsFixedTeams)} disabled={generating || (needsFixedTeams ? teams.length < 2 : room.joinedPlayers.length < 4)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{generating ? "Generating..." : "Generate matches"} <ArrowRight size={16} /></button>
              </div>
            )}
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.35fr]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight">Live matches</h2>
              <button onClick={() => loadRoom()} className="text-xs font-bold text-[var(--lime-deep)]">Refresh standings</button>
            </div>
            {rounds.length === 0 && <p className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">No matches yet.</p>}
            {rounds.map((round) => (
              <section key={round.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold">Round {round.roundNumber}</h3>
                  <span className="text-xs text-[var(--ink-soft)]">{round.matches.length} courts active</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {round.matches.map((match) => <MatchCard key={match.id} match={match} onSave={saveScore} canEdit={room.isOwner} />)}
                </div>
              </section>
            ))}
          </section>
          <aside className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
            <div className="flex items-center gap-2"><Trophy size={18} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Standings</h2></div>
            <div className="mt-4 space-y-2">
              {standings.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No results yet.</p>}
              {standings.map((player) => (
                <div key={player.name} className="flex items-center gap-2 rounded-xl bg-[#131f19] px-3 py-3">
                  <span className="w-5 text-xs font-black text-[var(--lime-deep)]">{player.rank}</span>
                  <span className="flex-1 text-xs font-bold">{player.name}</span>
                  <span className="text-xs font-black">{player.wins}W</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MatchCard({ match, onSave, canEdit }: { match: Match; onSave: (matchId: string, sideA: string, sideB: string) => void; canEdit: boolean }) {
  const [sideA, setSideA] = useState(match.scores[0]?.sideAScore?.toString() ?? "");
  const [sideB, setSideB] = useState(match.scores[0]?.sideBScore?.toString() ?? "");
  return (
    <article className="rounded-xl border border-[var(--line)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Court {match.courtNumber}</span>
        <span className="rounded-full bg-[#1c2a1a] px-2 py-1 text-[10px] font-bold"><Users size={11} className="mr-1 inline" />Ready</span>
      </div>
      <div className="space-y-2 text-sm font-bold text-[var(--foreground)]">
        <p>{match.players.filter((player) => player.side === "A").map((player) => player.name).join(" / ")}</p>
        <p className="text-[var(--ink-soft)]">vs</p>
        <p>{match.players.filter((player) => player.side === "B").map((player) => player.name).join(" / ")}</p>
      </div>
      {canEdit ? (
        <div className="mt-4 flex items-center gap-2">
          <input value={sideA} onChange={(event) => setSideA(event.target.value)} placeholder="0" type="number" className="h-10 w-16 rounded-lg border border-[var(--line)] text-center font-bold" />
          <span className="text-[var(--ink-soft)]">-</span>
          <input value={sideB} onChange={(event) => setSideB(event.target.value)} placeholder="0" type="number" className="h-10 w-16 rounded-lg border border-[var(--line)] text-center font-bold" />
          <button onClick={() => onSave(match.id, sideA, sideB)} className="ml-auto rounded-full bg-[#d8f24e] px-3 py-2 text-xs font-bold text-[#1b211e]">Save score</button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-[#131f19] px-3 py-2.5 text-xs font-semibold text-[var(--ink-soft)]">
          {match.scores[0] ? <span className="font-bold text-[var(--foreground)]">{match.scores[0].sideAScore} - {match.scores[0].sideBScore}</span> : <span>Score not entered yet</span>}
          <span>Organizer only</span>
        </div>
      )}
    </article>
  );
}
