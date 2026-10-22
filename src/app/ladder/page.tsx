"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUp, ChevronRight, Plus, Swords } from "lucide-react";
import { DashboardLink } from "@/components/guest-shell";

type Position = { id: string; position: number; userId: string; name: string; rating: string; wins: number; losses: number };
type Ladder = { id: string; name: string; challengeRange: number; responseDeadlineHours: number };
type ChallengeItem = { id: string; ladderId: string; ladderName: string; challengerId: string; challengerName: string; challengedId: string; challengedName: string; status: string; deadlineAt: string; createdAt: string; matchId: string | null; matchStatus: string | null };

export default function LadderPage() {
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [myPosition, setMyPosition] = useState<Position | null>(null);
  const [sent, setSent] = useState<ChallengeItem[]>([]);
  const [received, setReceived] = useState<ChallengeItem[]>([]);
  const [notice, setNotice] = useState("");
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { a: string; b: string }>>({});

  function loadLadder() {
    fetch("/api/ladder").then((response) => response.json()).then((data) => { setLadder(data.ladder); setPositions(data.positions ?? []); setMyPosition(data.myPosition ?? null); });
  }
  function loadChallenges() {
    fetch("/api/ladder/challenges").then((response) => response.json()).then((data) => { setSent(data.sent ?? []); setReceived(data.received ?? []); });
  }
  useEffect(() => { loadLadder(); loadChallenges(); }, []);

  async function createLadder() {
    const response = await fetch("/api/ladder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await response.json();
    setNotice(response.ok ? "Ladder created. Invite players to join." : data.error ?? "Unable to create ladder");
    if (response.ok) loadLadder();
  }
  async function joinLadder() {
    const response = await fetch("/api/ladder/join", { method: "POST" });
    const data = await response.json();
    setNotice(response.ok ? "You're on the ladder." : data.error ?? "Unable to join the ladder");
    if (response.ok) loadLadder();
  }
  async function sendChallenge(challengedId: string) {
    if (!ladder) return;
    const response = await fetch("/api/ladder/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ladderId: ladder.id, challengedId }) });
    const data = await response.json();
    setNotice(response.ok ? "Challenge sent." : data.error ?? "Unable to send challenge");
    if (response.ok) loadChallenges();
  }
  async function respondChallenge(id: string, status: "ACCEPTED" | "DECLINED") {
    const response = await fetch(`/api/ladder/challenges/${id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await response.json();
    setNotice(response.ok ? (status === "ACCEPTED" ? "Challenge accepted. Play your match, then report the score below." : "Challenge declined.") : data.error ?? "Unable to respond");
    if (response.ok) loadChallenges();
  }
  async function saveScore(matchId: string) {
    const draft = scoreDrafts[matchId] ?? { a: "", b: "" };
    const sideAScore = Number(draft.a);
    const sideBScore = Number(draft.b);
    if (!Number.isInteger(sideAScore) || !Number.isInteger(sideBScore) || sideAScore < 0 || sideBScore < 0 || sideAScore === sideBScore) { setNotice("Enter two different non-negative scores."); return; }
    const response = await fetch(`/api/matches/${matchId}/score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sideAScore, sideBScore, gameNumber: 1 }) });
    const data = await response.json();
    setNotice(response.ok ? "Score saved." : data.error ?? "Unable to save score");
    if (response.ok) { loadLadder(); loadChallenges(); }
  }

  const pendingChallengePairs = new Set([...sent, ...received].filter((challenge) => challenge.status === "PENDING").map((challenge) => [challenge.challengerId, challenge.challengedId].sort().join(":")));
  const canChallenge = (position: Position) => Boolean(ladder) && Boolean(myPosition) && position.userId !== myPosition!.userId && myPosition!.position - position.position > 0 && myPosition!.position - position.position <= (ladder?.challengeRange ?? 0) && !pendingChallengePairs.has([myPosition!.userId, position.userId].sort().join(":"));

  const myChallenges = [...received.map((challenge) => ({ ...challenge, direction: "received" as const })), ...sent.map((challenge) => ({ ...challenge, direction: "sent" as const }))]
    .filter((challenge) => (challenge.status === "PENDING") || (challenge.status === "ACCEPTED" && challenge.matchStatus !== "COMPLETED"))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-4xl">
    <DashboardLink className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to dashboard</DashboardLink>
    <div className="mt-8 flex items-end justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Challenge play</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">The ladder.</h1><p className="mt-3 text-sm text-[var(--ink-soft)]">Challenge up, defend your spot, keep climbing.</p></div>
      <div className="flex items-center gap-2">
        {ladder && !myPosition && <button onClick={joinLadder} className="flex items-center gap-2 rounded-full bg-[var(--lime)] px-5 py-3 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]"><Plus size={16} />Join ladder</button>}
        {!ladder && <button onClick={createLadder} className="flex items-center gap-2 rounded-full bg-[var(--lime)] px-5 py-3 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]"><Plus size={16} />New ladder</button>}
      </div>
    </div>
    {notice && <p className="mt-5 rounded-xl bg-[#1e2b17] px-4 py-3 text-xs font-bold text-[#c7e572]">{notice}</p>}
    <section className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-extrabold">{ladder?.name ?? "No active ladder"}</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Challenge up to {ladder?.challengeRange ?? 3} spots · {ladder?.responseDeadlineHours ?? 48} hour response window</p></div><ArrowUp className="text-[var(--lime-deep)]" /></div>
      <div className="mt-6 space-y-2">
        {positions.length ? positions.map((position) => (
          <div key={position.id} className="flex items-center gap-4 rounded-xl bg-[#131f19] px-4 py-3">
            <span className="w-6 text-center font-black text-[var(--lime-deep)]">{position.position}</span>
            <span className="flex-1 text-sm font-bold">{position.name}</span>
            <span className="text-xs font-semibold text-[var(--ink-soft)]">{position.wins} - {position.losses}</span>
            <span className="font-black">{position.rating}</span>
            {canChallenge(position) ? <button onClick={() => sendChallenge(position.userId)} className="flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3 py-1.5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]"><Swords size={13} />Challenge</button> : <ChevronRight size={16} className="text-[var(--ink-soft)]" />}
          </div>
        )) : <p className="py-8 text-center text-sm text-[var(--ink-soft)]">Create a ladder to start ranking players.</p>}
      </div>
    </section>
    {myChallenges.length > 0 && (
      <section className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
        <h2 className="text-xl font-extrabold">Your challenges</h2>
        <div className="mt-5 space-y-3">
          {myChallenges.map((challenge) => (
            <div key={challenge.id} className="rounded-xl bg-[#131f19] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{challenge.direction === "received" ? `${challenge.challengerName} challenged you` : `You challenged ${challenge.challengedName}`}</p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">{challenge.ladderName} ladder · {challenge.status === "PENDING" ? `Respond by ${new Date(challenge.deadlineAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Accepted · match scheduled"}</p>
                </div>
                {challenge.status === "PENDING" && challenge.direction === "received" && (
                  <div className="flex gap-2">
                    <button onClick={() => respondChallenge(challenge.id, "ACCEPTED")} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">Accept</button>
                    <button onClick={() => respondChallenge(challenge.id, "DECLINED")} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]">Decline</button>
                  </div>
                )}
                {challenge.status === "PENDING" && challenge.direction === "sent" && <span className="rounded-full bg-[#1c2a1a] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)]">Awaiting response</span>}
              </div>
              {challenge.status === "ACCEPTED" && challenge.matchId && challenge.matchStatus === "SCHEDULED" && (
                <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-3">
                  <input type="number" placeholder="Your score" value={scoreDrafts[challenge.matchId]?.a ?? ""} onChange={(event) => setScoreDrafts((drafts) => ({ ...drafts, [challenge.matchId!]: { a: event.target.value, b: drafts[challenge.matchId!]?.b ?? "" } }))} className="w-24 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm" />
                  <span className="text-xs font-bold text-[var(--ink-soft)]">vs</span>
                  <input type="number" placeholder="Their score" value={scoreDrafts[challenge.matchId]?.b ?? ""} onChange={(event) => setScoreDrafts((drafts) => ({ ...drafts, [challenge.matchId!]: { a: drafts[challenge.matchId!]?.a ?? "", b: event.target.value } }))} className="w-24 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm" />
                  <button onClick={() => saveScore(challenge.matchId!)} className="ml-auto rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">Save score</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    )}
  </div></main>;
}
