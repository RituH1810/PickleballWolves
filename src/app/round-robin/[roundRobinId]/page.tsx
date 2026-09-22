"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Check, Trophy, Users } from "lucide-react";

type Match = { id: string; courtNumber: number | null; players: { userId: string; name: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
type Round = { id: string; roundNumber: number; matches: Match[] };
type Standing = { rank: number; name: string; wins: number; losses: number; differential: number };
type RoomInfo = { name: string; format: string; partnerFormat: string; playFormat: string; status: string };

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

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><p className="text-sm text-[#67716a]">Loading matches...</p></main>;
  if (!room) return <main className="grid min-h-screen place-items-center bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[#1b211e]">Round robin not found.</p><Link href="/round-robin" className="mt-3 inline-block text-sm font-bold text-[#6b8f21]">Build a new one</Link></div></main>;

  return (
    <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/round-robin" className="flex items-center gap-2 text-xs font-bold text-[#6b8f21]"><ArrowLeft size={14} />Back to round robin builder</Link>
        <div className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">{partnerFormatLabels[room.partnerFormat] ?? room.partnerFormat} · {playFormatLabels[room.playFormat] ?? room.playFormat}</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">{room.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${room.status === "COMPLETED" ? "bg-[#eef2ed] text-[#67716a]" : "bg-[#e4f3a8] text-[#5c7b1a]"}`}><Check size={15} />{room.status === "LIVE" ? "Live schedule" : room.status === "COMPLETED" ? "Completed" : room.status}</span>
            {room.status !== "COMPLETED" && <button onClick={endRoundRobin} disabled={ending} className="rounded-full border border-[#e2e7e2] px-4 py-2 text-xs font-bold text-[#1b211e] transition-colors hover:bg-[#f5f7f4] disabled:cursor-not-allowed disabled:opacity-60">{ending ? "Ending..." : "End round robin"}</button>}
          </div>
        </div>
        {notice && (
          <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#fde3dd] text-[#a94f3d]" : "bg-[#e4f3a8] text-[#5c7b1a]"}`}>{notice.text}</p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.35fr]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight">Live matches</h2>
              <button onClick={() => loadRoom()} className="text-xs font-bold text-[#6b8f21]">Refresh standings</button>
            </div>
            {rounds.length === 0 && <p className="rounded-[20px] border border-[#e2e7e2] bg-white p-6 text-sm text-[#67716a]">No matches yet.</p>}
            {rounds.map((round) => (
              <section key={round.id} className="rounded-[20px] border border-[#e2e7e2] bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold">Round {round.roundNumber}</h3>
                  <span className="text-xs text-[#67716a]">{round.matches.length} courts active</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {round.matches.map((match) => <MatchCard key={match.id} match={match} onSave={saveScore} />)}
                </div>
              </section>
            ))}
          </section>
          <aside className="rounded-[20px] border border-[#e2e7e2] bg-white p-5">
            <div className="flex items-center gap-2"><Trophy size={18} className="text-[#98ba1f]" /><h2 className="font-extrabold">Standings</h2></div>
            <div className="mt-4 space-y-2">
              {standings.length === 0 && <p className="text-sm text-[#67716a]">No results yet.</p>}
              {standings.map((player) => (
                <div key={player.name} className="flex items-center gap-2 rounded-xl bg-[#f3f6ef] px-3 py-3">
                  <span className="w-5 text-xs font-black text-[#98ba1f]">{player.rank}</span>
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

function MatchCard({ match, onSave }: { match: Match; onSave: (matchId: string, sideA: string, sideB: string) => void }) {
  const [sideA, setSideA] = useState(match.scores[0]?.sideAScore?.toString() ?? "");
  const [sideB, setSideB] = useState(match.scores[0]?.sideBScore?.toString() ?? "");
  return (
    <article className="rounded-xl border border-[#e2e7e2] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#67716a]">Court {match.courtNumber}</span>
        <span className="rounded-full bg-[#eef2ed] px-2 py-1 text-[10px] font-bold"><Users size={11} className="mr-1 inline" />Ready</span>
      </div>
      <div className="space-y-2 text-sm font-bold text-[#1b211e]">
        <p>{match.players.filter((player) => player.side === "A").map((player) => player.name).join(" / ")}</p>
        <p className="text-[#67716a]">vs</p>
        <p>{match.players.filter((player) => player.side === "B").map((player) => player.name).join(" / ")}</p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <input value={sideA} onChange={(event) => setSideA(event.target.value)} placeholder="0" type="number" className="h-10 w-16 rounded-lg border border-[#dfe6df] text-center font-bold" />
        <span className="text-[#67716a]">-</span>
        <input value={sideB} onChange={(event) => setSideB(event.target.value)} placeholder="0" type="number" className="h-10 w-16 rounded-lg border border-[#dfe6df] text-center font-bold" />
        <button onClick={() => onSave(match.id, sideA, sideB)} className="ml-auto rounded-full bg-[#d8f24e] px-3 py-2 text-xs font-bold">Save score</button>
      </div>
    </article>
  );
}
