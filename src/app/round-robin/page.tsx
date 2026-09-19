"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Crown, Dices, Layers, Shuffle, Swords, TrendingUp, Trophy, Users, Waves } from "lucide-react";

type Player = { id: string; name: string; skillRating: string };
type Match = { id: string; courtNumber: number | null; players: { userId: string; name: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
type Round = { id: string; roundNumber: number; matches: Match[] };
type Standing = { rank: number; name: string; wins: number; losses: number; differential: number };

const partnerFormats = [
  { id: "ROTATE", label: "Rotate", detail: "Get a new partner every round." },
  { id: "FIXED", label: "Fixed", detail: "Keep the same partner all event.", badge: "NEW" },
];

const gameFormats = [
  {
    id: "POPCORN",
    label: "Popcorn",
    icon: Shuffle,
    blurb: "Mix in with as many players as possible.",
    description: "Every round generates a fresh, random matchup. Don't like the draw? Shuffle for a new one. Works with any number of players or courts.",
    stats: [
      { title: "Random matchups", detail: "Optimized so you play with and against as many different people as possible." },
      { title: "1 game per round", detail: "Everyone switches courts after each game to keep matchups fresh." },
      { title: "Win percentage", detail: "Standings rank by win rate, so anyone can jump in or drop out anytime." },
    ],
  },
  {
    id: "GAUNTLET",
    label: "Gauntlet",
    icon: Swords,
    blurb: "Battle up the ladder one challenger at a time.",
    description: "Winners move up a court and losers move down. Climb to court one and defend your spot as challengers line up.",
    stats: [
      { title: "Ladder movement", detail: "Court position shifts after every game based on results." },
      { title: "1 game per round", detail: "Quick games keep the ladder moving." },
      { title: "Top court wins", detail: "Whoever holds court one at the end takes the event." },
    ],
  },
  {
    id: "RIVER",
    label: "Up & Down the River",
    icon: Waves,
    blurb: "Move up or down a court based on your result.",
    description: "Win and you head upstream to a tougher court. Lose and you drift downstream. Skill levels even out as the rounds go on.",
    stats: [
      { title: "Self-balancing", detail: "Courts settle into skill tiers as rounds progress." },
      { title: "1 game per round", detail: "Fast turnover keeps everyone moving." },
      { title: "Court 1 wins", detail: "The player who reaches and holds the top court wins." },
    ],
  },
  {
    id: "THRONE",
    label: "Claim the Throne",
    icon: Crown,
    blurb: "Defend the top court or dethrone the leader.",
    description: "One court is the throne. Win there and you stay king or queen. Lose anywhere and a new challenger steps up to take their shot.",
    stats: [
      { title: "King court", detail: "All eyes on whoever is defending the throne court." },
      { title: "1 game per round", detail: "Short matches keep the challenges coming." },
      { title: "Longest reign wins", detail: "Standings track total rounds spent on the throne." },
    ],
  },
  {
    id: "CREAM",
    label: "Cream of the Crop",
    icon: TrendingUp,
    blurb: "Play unlimited rounds; best win rate wins.",
    description: "This format optimizes for the most unique matchups across a long session. Play as many rounds as you like and watch standings update live.",
    stats: [
      { title: "Unlimited rounds", detail: "Keep playing until you're ready to call it." },
      { title: "1 game per round", detail: "Players switch courts after every game." },
      { title: "Win percentage", detail: "The highest win percentage takes it." },
    ],
  },
  {
    id: "DOUBLE_HEADER",
    label: "Double Header",
    icon: Layers,
    blurb: "Two games a round for double the action.",
    description: "Each round pairs you up for two full games before rotating, so you get more play per matchup with fewer changeovers.",
    stats: [
      { title: "2 games per round", detail: "Play both games before the next rotation." },
      { title: "Fewer changeovers", detail: "Less standing around between games." },
      { title: "Win percentage", detail: "Standings weigh every game played." },
    ],
  },
  {
    id: "MIXED_MADNESS",
    label: "Mixed Madness",
    icon: Users,
    blurb: "Randomized mixed-doubles pairings every round.",
    description: "Best for groups with an even mix of players. Every round randomizes mixed-doubles pairings for balanced, social matchups.",
    stats: [
      { title: "Mixed pairings", detail: "Randomized every round for balanced teams." },
      { title: "1 game per round", detail: "Quick rounds keep the mixer moving." },
      { title: "Win percentage", detail: "Standings rank individual win rate." },
    ],
  },
  {
    id: "SCRAMBLE",
    label: "Scramble",
    icon: Dices,
    blurb: "Fully randomized teams and matchups.",
    description: "The most social option. Teams and opponents are reshuffled every round so no two rounds look the same.",
    stats: [
      { title: "Full reshuffle", detail: "New teams and opponents every round." },
      { title: "1 game per round", detail: "Everyone keeps moving between courts." },
      { title: "Win percentage", detail: "Individual standings track every result." },
    ],
  },
];

export default function RoundRobinPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "Saturday Wolves Round Robin", partnerFormat: "ROTATE", gameFormat: "POPCORN", courtCount: "2", roundCount: "4", pointsToWin: "11", winBy: "1", skillBalanced: true });
  const [roundRobinId, setRoundRobinId] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [notice, setNotice] = useState("");
  const justGeneratedRef = useRef(false);
  const liveMatchesRef = useRef<HTMLDivElement>(null);

  const activeGameFormat = gameFormats.find((format) => format.id === form.gameFormat) ?? gameFormats[0];

  useEffect(() => { fetch("/api/players").then((response) => response.json()).then((data) => setPlayers(data.players ?? [])); }, []);

  useEffect(() => {
    if (justGeneratedRef.current && rounds.length > 0) {
      liveMatchesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      justGeneratedRef.current = false;
    }
  }, [rounds]);

  async function createAndGenerate() {
    if (selected.length < 4) { setNotice("Select at least four players."); return; }
    const created = await fetch("/api/round-robin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, format: `${form.partnerFormat}_${form.gameFormat}`, courtCount: Number(form.courtCount), roundCount: Number(form.roundCount), pointsToWin: Number(form.pointsToWin), winBy: Number(form.winBy), skillBalanced: form.skillBalanced }) });
    const createdData = await created.json();
    if (!created.ok) { setNotice(createdData.error ?? "Unable to create round robin."); return; }
    setRoundRobinId(createdData.roundRobin.id);
    const generated = await fetch(`/api/round-robin/${createdData.roundRobin.id}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerIds: selected }) });
    if (!generated.ok) { setNotice((await generated.json()).error ?? "Unable to generate schedule."); return; }
    await loadRoom(createdData.roundRobin.id);
    setNotice("Matches generated. Courts are ready.");
    justGeneratedRef.current = true;
  }

  async function loadRoom(id = roundRobinId) {
    const [roomResponse, standingsResponse] = await Promise.all([fetch(`/api/round-robin/${id}`), fetch(`/api/round-robin/${id}/standings`)]);
    const room = await roomResponse.json();
    const table = await standingsResponse.json();
    setRounds(room.roundRobin?.rounds ?? []);
    setStandings(table.standings ?? []);
  }

  async function saveScore(matchId: string, sideAScore: string, sideBScore: string) {
    const response = await fetch(`/api/matches/${matchId}/score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sideAScore: Number(sideAScore), sideBScore: Number(sideBScore), gameNumber: 1 }) });
    setNotice(response.ok ? "Score saved and standings updated." : (await response.json()).error ?? "Unable to save score.");
    if (response.ok) loadRoom();
  }

  return (
    <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-[#6b8f21]"><ArrowLeft size={14} />Back to dashboard</Link>
        <div className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">Competition tools</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">Build a round robin.</h1>
            <p className="mt-3 text-sm text-[#67716a]">Choose a format, fill the player list, then run the courts from one live room.</p>
          </div>
          {rounds.length > 0 && <span className="flex items-center gap-2 rounded-full bg-[#e4f3a8] px-4 py-2 text-xs font-bold text-[#5c7b1a]"><Check size={15} />Live schedule</span>}
        </div>
        {notice && <p role="status" className="mt-5 rounded-xl bg-[#e4f3a8] px-4 py-3 text-xs font-bold text-[#5c7b1a]">{notice}</p>}

        <section className="mt-8 rounded-[24px] border border-[#e2e7e2] bg-white p-6 sm:p-8">
          <h2 className="font-extrabold">1. Choose your format</h2>
          <p className="mt-1 text-xs text-[#67716a]">Select from 8 fun formats.</p>

          <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[#67716a]">Partner format</p>
          <div className="mt-2 flex gap-2">
            {partnerFormats.map((option) => (
              <button key={option.id} onClick={() => setForm({ ...form, partnerFormat: option.id })} className={`relative flex-1 rounded-xl border px-4 py-3 text-left transition-colors sm:flex-none sm:px-6 ${form.partnerFormat === option.id ? "border-[#98ba1f] bg-[#f0f5d9]" : "border-[#e2e7e2]"}`}>
                {option.badge && <span className="absolute -top-2 right-2 rounded-full bg-[#1b211e] px-2 py-0.5 text-[9px] font-black text-white">{option.badge}</span>}
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="block text-[11px] text-[#67716a]">{option.detail}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[#67716a]">Game format</p>
          <div className="mt-2 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="space-y-2">
              {gameFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <button key={format.id} onClick={() => setForm({ ...form, gameFormat: format.id })} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${form.gameFormat === format.id ? "border-[#98ba1f] bg-[#f0f5d9]" : "border-[#e2e7e2]"}`}>
                    <Icon size={18} className="shrink-0 text-[#6b8f21]" />
                    <span>
                      <span className="block text-sm font-bold">{format.label}</span>
                      <span className="block text-xs text-[#67716a]">{format.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-[20px] bg-[#f7f9f4] p-5">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#98ba1f]">How it works</p>
              <h3 className="mt-1 text-lg font-extrabold text-[#1b211e]">{activeGameFormat.label}</h3>
              <p className="mt-2 text-sm text-[#465247]">{activeGameFormat.description}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {activeGameFormat.stats.map((stat) => (
                  <div key={stat.title} className="rounded-xl bg-white p-3">
                    <p className="text-xs font-bold text-[#1b211e]">{stat.title}</p>
                    <p className="mt-1 text-[11px] text-[#67716a]">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-5 border-t border-[#eef1ec] pt-6 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#465247] sm:col-span-2">Event name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[#dfe6df] px-4 text-sm" />
            </label>
            <label className="text-xs font-bold text-[#465247]">Courts
              <input type="number" min="1" value={form.courtCount} onChange={(event) => setForm({ ...form, courtCount: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[#dfe6df] px-4 text-sm" />
            </label>
            <label className="text-xs font-bold text-[#465247]">Rounds
              <input type="number" min="1" value={form.roundCount} onChange={(event) => setForm({ ...form, roundCount: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[#dfe6df] px-4 text-sm" />
            </label>
            <label className="text-xs font-bold text-[#465247]">Points to win
              <select value={form.pointsToWin} onChange={(event) => setForm({ ...form, pointsToWin: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[#dfe6df] bg-white px-4 text-sm">
                <option value="11">11</option>
                <option value="15">15</option>
                <option value="21">21</option>
              </select>
            </label>
            <label className="text-xs font-bold text-[#465247]">Win by
              <select value={form.winBy} onChange={(event) => setForm({ ...form, winBy: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[#dfe6df] bg-white px-4 text-sm">
                <option value="1">1 point</option>
                <option value="2">2 points</option>
              </select>
            </label>
          </div>
          <label className="mt-5 flex items-center gap-3 text-sm font-bold text-[#1b211e]">
            <input type="checkbox" checked={form.skillBalanced} onChange={(event) => setForm({ ...form, skillBalanced: event.target.checked })} className="h-5 w-5 accent-[#98ba1f]" />
            Skill-balanced matchups
          </label>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#e2e7e2] bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Users size={18} className="text-[#98ba1f]" /><h2 className="font-extrabold">2. Add players</h2></div>
            <span className="text-xs font-bold text-[#67716a]">{selected.length} selected</span>
          </div>
          <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {players.map((player) => (
              <button key={player.id} onClick={() => setSelected((current) => current.includes(player.id) ? current.filter((id) => id !== player.id) : [...current, player.id])} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left ${selected.includes(player.id) ? "border-[#98ba1f] bg-[#f0f5d9]" : "border-[#e2e7e2]"}`}>
                <span><span className="block text-sm font-bold">{player.name}</span><span className="text-[11px] text-[#67716a]">{player.skillRating} rating</span></span>
                {selected.includes(player.id) && <Check size={16} className="text-[#6b8f21]" />}
              </button>
            ))}
          </div>
          <button onClick={createAndGenerate} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1b211e] text-sm font-bold text-white">Generate matches <ArrowRight size={16} /></button>
        </section>

        {rounds.length > 0 && (
          <div ref={liveMatchesRef} className="mt-6 grid gap-6 scroll-mt-8 lg:grid-cols-[1fr_.35fr]">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight">Live matches</h2>
                <button onClick={() => loadRoom()} className="text-xs font-bold text-[#6b8f21]">Refresh standings</button>
              </div>
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
        )}
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
        <span className="rounded-full bg-[#eef2ed] px-2 py-1 text-[10px] font-bold">Ready</span>
      </div>
      <div className="space-y-2 text-sm font-bold">
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
