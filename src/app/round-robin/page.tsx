"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Crown, Dices, Layers, Shuffle, Swords, TrendingUp, Users, Waves } from "lucide-react";

type Player = { id: string; name: string; skillRating: string };
type MyRoundRobin = { id: string; name: string; format: string; partnerFormat: string; playFormat: string; status: string; matchCount: number; isOwner: boolean };

const playFormatLabels: Record<string, string> = { SINGLES: "Singles", DOUBLES: "Doubles", MIXED: "Mixed doubles" };
const partnerFormatLabels: Record<string, string> = { ROTATE: "Rotating partners", FIXED: "Fixed partners" };

const playFormats = [
  { id: "SINGLES", label: "Singles", detail: "1 vs 1, no partner." },
  { id: "DOUBLES", label: "Doubles", detail: "2 vs 2 teams." },
  { id: "MIXED", label: "Mixed doubles", detail: "2 vs 2 teams, mixed pairs." },
];

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
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [teams, setTeams] = useState<[string, string][]>([]);
  const [pendingPartner, setPendingPartner] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "Saturday Wolves Round Robin", playFormat: "DOUBLES", partnerFormat: "ROTATE", gameFormat: "POPCORN", courtCount: "2", roundCount: "4", pointsToWin: "11", winBy: "1", skillBalanced: true });
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [myRoundRobins, setMyRoundRobins] = useState<MyRoundRobin[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);

  const activeGameFormat = gameFormats.find((format) => format.id === form.gameFormat) ?? gameFormats[0];
  const minPlayers = form.playFormat === "SINGLES" ? 2 : 4;
  const needsFixedTeams = form.playFormat !== "SINGLES" && form.partnerFormat === "FIXED";
  const pairedPlayerIds = new Set(teams.flat());

  function playerName(id: string) { return players.find((player) => player.id === id)?.name ?? "Unknown"; }

  function togglePairing(playerId: string) {
    if (pairedPlayerIds.has(playerId)) {
      setTeams((current) => current.filter((team) => !team.includes(playerId)));
      return;
    }
    if (pendingPartner === playerId) { setPendingPartner(null); return; }
    if (pendingPartner) { setTeams((current) => [...current, [pendingPartner, playerId]]); setPendingPartner(null); return; }
    setPendingPartner(playerId);
  }

  function togglePlayerSelected(playerId: string) {
    setSelected((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]);
    setTeams((current) => current.filter((team) => !team.includes(playerId)));
    setPendingPartner((current) => (current === playerId ? null : current));
  }

  function showNotice(text: string, type: "success" | "error") {
    setNotice({ text, type });
    if (type === "error") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => { fetch("/api/players").then((response) => response.json()).then((data) => setPlayers(data.players ?? [])); }, []);
  useEffect(() => { fetch("/api/round-robin").then((response) => response.ok ? response.json() : null).then((data) => setMyRoundRobins(data?.roundRobins ?? [])).finally(() => setLoadingMine(false)); }, []);

  async function createAndGenerate() {
    if (selected.length < minPlayers) { showNotice(`Select at least ${minPlayers} players.`, "error"); return; }
    if (needsFixedTeams) {
      if (teams.length < 2) { showNotice("Pair up at least two teams.", "error"); return; }
      if (selected.some((id) => !pairedPlayerIds.has(id))) { showNotice("Every selected player must be paired into a team.", "error"); return; }
    }
    setGenerating(true);
    const created = await fetch("/api/round-robin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, format: form.gameFormat, partnerFormat: form.partnerFormat, playFormat: form.playFormat, courtCount: Number(form.courtCount), roundCount: Number(form.roundCount), pointsToWin: Number(form.pointsToWin), winBy: Number(form.winBy), skillBalanced: form.skillBalanced }) });
    const createdData = await created.json();
    if (!created.ok) { showNotice(createdData.error ?? "Unable to create round robin.", "error"); setGenerating(false); return; }
    const generateBody = needsFixedTeams ? { teams } : { playerIds: selected };
    const generated = await fetch(`/api/round-robin/${createdData.roundRobin.id}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(generateBody) });
    if (!generated.ok) { showNotice((await generated.json()).error ?? "Unable to generate schedule.", "error"); setGenerating(false); return; }
    router.push(`/round-robin/${createdData.roundRobin.id}`);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to dashboard</Link>
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Competition tools</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">Build a round robin.</h1>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">Choose a format, fill the player list, then run the courts from one live room.</p>
        </div>
        {notice && (
          <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1e2b17] text-[#c7e572]"}`}>
            {notice.text}
            {notice.type === "error" && notice.text.toLowerCase().includes("sign in") && <Link href="/login" className="ml-2 underline">Sign in</Link>}
          </p>
        )}

        {!loadingMine && myRoundRobins.length > 0 && (
          <section className="mt-8 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
            <h2 className="font-extrabold">Your round robins</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">Every round robin you&apos;ve created or played in, saved to your account.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {myRoundRobins.map((roundRobin) => (
                <Link key={roundRobin.id} href={`/round-robin/${roundRobin.id}`} className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 transition-colors hover:border-[var(--lime-deep)] hover:bg-[#1e2b17]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--foreground)]">{roundRobin.name}</p>
                    <p className="mt-1 truncate text-xs text-[var(--ink-soft)]">{partnerFormatLabels[roundRobin.partnerFormat] ?? roundRobin.partnerFormat} · {playFormatLabels[roundRobin.playFormat] ?? roundRobin.playFormat} · {roundRobin.matchCount} matches{!roundRobin.isOwner ? " · Playing" : ""}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${roundRobin.status === "LIVE" ? "bg-[#1e2b17] text-[#c7e572]" : "bg-[#1c2a1a] text-[var(--ink-soft)]"}`}>{roundRobin.status === "LIVE" ? "Live" : roundRobin.status === "COMPLETED" ? "Completed" : "Setup"}</span>
                  <ChevronRight size={16} className="text-[var(--ink-soft)]" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          <h2 className="font-extrabold">1. Choose your format</h2>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">Select from 8 fun formats.</p>

          <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Play format</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {playFormats.map((option) => (
              <button key={option.id} onClick={() => { setForm({ ...form, playFormat: option.id }); setTeams([]); setPendingPartner(null); }} className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors sm:flex-none sm:px-6 ${form.playFormat === option.id ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="block text-[11px] text-[var(--ink-soft)]">{option.detail}</span>
              </button>
            ))}
          </div>

          {form.playFormat !== "SINGLES" && (
            <>
              <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Partner format</p>
              <div className="mt-2 flex gap-2">
                {partnerFormats.map((option) => (
                  <button key={option.id} onClick={() => { setForm({ ...form, partnerFormat: option.id }); setTeams([]); setPendingPartner(null); }} className={`relative flex-1 rounded-xl border px-4 py-3 text-left transition-colors sm:flex-none sm:px-6 ${form.partnerFormat === option.id ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                    {option.badge && <span className="absolute -top-2 right-2 rounded-full bg-[var(--lime)] px-2 py-0.5 text-[9px] font-black text-[#0f1712]">{option.badge}</span>}
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="block text-[11px] text-[var(--ink-soft)]">{option.detail}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Game format</p>
          <div className="mt-2 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="space-y-2">
              {gameFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <button key={format.id} onClick={() => setForm({ ...form, gameFormat: format.id })} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${form.gameFormat === format.id ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                    <Icon size={18} className="shrink-0 text-[var(--lime-deep)]" />
                    <span>
                      <span className="block text-sm font-bold">{format.label}</span>
                      <span className="block text-xs text-[var(--ink-soft)]">{format.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-[20px] bg-[#131f19] p-5">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">How it works</p>
              <h3 className="mt-1 text-lg font-extrabold text-[var(--foreground)]">{activeGameFormat.label}</h3>
              <p className="mt-2 text-sm text-[#c3d0c5]">{activeGameFormat.description}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {activeGameFormat.stats.map((stat) => (
                  <div key={stat.title} className="rounded-xl bg-[var(--panel)] p-3">
                    <p className="text-xs font-bold text-[var(--foreground)]">{stat.title}</p>
                    <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-5 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#c3d0c5] sm:col-span-2">Event name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
            </label>
            <label className="text-xs font-bold text-[#c3d0c5]">Courts
              <input type="number" min="1" value={form.courtCount} onChange={(event) => setForm({ ...form, courtCount: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
            </label>
            <label className="text-xs font-bold text-[#c3d0c5]">Rounds
              <input type="number" min="1" value={form.roundCount} onChange={(event) => setForm({ ...form, roundCount: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
            </label>
            <label className="text-xs font-bold text-[#c3d0c5]">Points to win
              <select value={form.pointsToWin} onChange={(event) => setForm({ ...form, pointsToWin: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm">
                <option value="11">11</option>
                <option value="15">15</option>
                <option value="21">21</option>
              </select>
            </label>
            <label className="text-xs font-bold text-[#c3d0c5]">Win by
              <select value={form.winBy} onChange={(event) => setForm({ ...form, winBy: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm">
                <option value="1">1 point</option>
                <option value="2">2 points</option>
              </select>
            </label>
          </div>
          <label className="mt-5 flex items-center gap-3 text-sm font-bold text-[var(--foreground)]">
            <input type="checkbox" checked={form.skillBalanced} onChange={(event) => setForm({ ...form, skillBalanced: event.target.checked })} className="h-5 w-5 accent-[var(--lime)]" />
            Skill-balanced matchups
          </label>
        </section>

        <section className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Users size={18} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">2. Add players</h2></div>
            <span className="text-xs font-bold text-[var(--ink-soft)]">{selected.length} selected</span>
          </div>
          <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {players.map((player) => (
              <button key={player.id} onClick={() => togglePlayerSelected(player.id)} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left ${selected.includes(player.id) ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                <span><span className="block text-sm font-bold">{player.name}</span><span className="text-[11px] text-[var(--ink-soft)]">{player.skillRating} rating</span></span>
                {selected.includes(player.id) && <Check size={16} className="text-[var(--lime-deep)]" />}
              </button>
            ))}
          </div>
          {!needsFixedTeams && <button onClick={createAndGenerate} disabled={generating} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{generating ? "Generating..." : "Generate matches"} <ArrowRight size={16} /></button>}
        </section>

        {needsFixedTeams && (
          <section className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="flex items-center gap-2"><Users size={18} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">3. Pair up your teams</h2></div>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">Tap two players to make them a fixed team for the whole event. Tap a paired player to undo it.</p>
            {selected.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--ink-soft)]">Select players above first.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.map((playerId) => {
                    const paired = pairedPlayerIds.has(playerId);
                    const isPending = pendingPartner === playerId;
                    return (
                      <button key={playerId} onClick={() => togglePairing(playerId)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${paired ? "border-[var(--lime-deep)] bg-[#1e2b17] text-[#c7e572]" : isPending ? "border-[var(--lime)] bg-[var(--lime)] text-[#0f1712]" : "border-[var(--line)] text-[var(--foreground)] hover:border-[var(--lime-deep)]"}`}>
                        {playerName(playerId)}{isPending ? " · pick a partner" : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 space-y-2">
                  {teams.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No teams yet.</p>}
                  {teams.map(([a, b], index) => (
                    <div key={`${a}-${b}`} className="flex items-center justify-between rounded-xl bg-[#131f19] px-4 py-2.5 text-sm font-bold text-[var(--foreground)]">
                      <span>Team {index + 1}: {playerName(a)} &amp; {playerName(b)}</span>
                      <button onClick={() => togglePairing(a)} className="text-xs font-bold text-[var(--lime-deep)]">Unpair</button>
                    </div>
                  ))}
                </div>
                {selected.filter((id) => !pairedPlayerIds.has(id)).length > 0 && <p className="mt-3 text-xs font-semibold text-[var(--ink-soft)]">{selected.filter((id) => !pairedPlayerIds.has(id)).length} player{selected.filter((id) => !pairedPlayerIds.has(id)).length === 1 ? "" : "s"} not yet paired.</p>}
              </>
            )}
            <button onClick={createAndGenerate} disabled={generating} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{generating ? "Generating..." : "Generate matches"} <ArrowRight size={16} /></button>
          </section>
        )}
      </div>
    </main>
  );
}
