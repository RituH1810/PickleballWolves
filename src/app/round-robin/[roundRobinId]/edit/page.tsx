"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Crown, Dices, Layers, Shuffle, Swords, TrendingUp, Users, Waves } from "lucide-react";

type Player = { id: string; name: string; rank: number | null };
type MatchPlayer = { userId: string; name: string; side: "A" | "B" };
type Match = { players: MatchPlayer[] };
type Round = { roundNumber: number; matches: Match[] };
type RoundRobinDetail = {
  name: string;
  format: string;
  partnerFormat: string;
  playFormat: string;
  courtCount: number;
  roundCount: number;
  pointsToWin: number;
  winBy: number;
  skillBalanced: boolean;
  isOwner: boolean;
  hasScores: boolean;
  rounds: Round[];
};

const playFormats = [
  { id: "SINGLES", label: "Singles", detail: "1 vs 1, no partner." },
  { id: "DOUBLES", label: "Doubles", detail: "2 vs 2 teams." },
  { id: "MIXED", label: "Mixed doubles", detail: "2 vs 2 teams, mixed pairs." },
];

const partnerFormats = [
  { id: "ROTATE", label: "Rotate", detail: "Get a new partner every round." },
  { id: "FIXED", label: "Fixed", detail: "Keep the same partner all event." },
];

const gameFormats = [
  { id: "POPCORN", label: "Dink Mixer", icon: Shuffle, blurb: "Mix in with as many players as possible." },
  { id: "GAUNTLET", label: "Challenger's Court", icon: Swords, blurb: "Battle up the ladder one challenger at a time." },
  { id: "RIVER", label: "Tidal Courts", icon: Waves, blurb: "Move up or down a court based on your result." },
  { id: "THRONE", label: "King of the Kitchen", icon: Crown, blurb: "Defend the top court or dethrone the leader." },
  { id: "CREAM", label: "Top Dill", icon: TrendingUp, blurb: "Play unlimited rounds; best win rate wins." },
  { id: "DOUBLE_HEADER", label: "Double Dink", icon: Layers, blurb: "Two games a round for double the action." },
  { id: "MIXED_MADNESS", label: "Dilly Mixer", icon: Users, blurb: "Randomized mixed-doubles pairings every round." },
  { id: "SCRAMBLE", label: "Full Pickle", icon: Dices, blurb: "Fully randomized teams and matchups." },
];

export default function EditRoundRobinPage({ params }: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<RoundRobinDetail | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [teams, setTeams] = useState<[string, string][]>([]);
  const [pendingPartner, setPendingPartner] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", playFormat: "DOUBLES", partnerFormat: "ROTATE", gameFormat: "POPCORN", courtCount: "2", roundCount: "4", pointsToWin: "11", winBy: "1", skillBalanced: true });
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    Promise.all([fetch(`/api/round-robin/${roundRobinId}`), fetch("/api/players")]).then(async ([roomResponse, playersResponse]) => {
      if (roomResponse.ok) {
        const data = await roomResponse.json();
        const roundRobin: RoundRobinDetail | null = data.roundRobin ?? null;
        setDetail(roundRobin);
        if (roundRobin) {
          setForm({
            name: roundRobin.name,
            playFormat: roundRobin.playFormat,
            partnerFormat: roundRobin.partnerFormat,
            gameFormat: roundRobin.format,
            courtCount: String(roundRobin.courtCount),
            roundCount: String(roundRobin.roundCount),
            pointsToWin: String(roundRobin.pointsToWin),
            winBy: String(roundRobin.winBy),
            skillBalanced: roundRobin.skillBalanced,
          });
          const firstRound = roundRobin.rounds[0];
          if (firstRound) {
            const playerIds = [...new Set(firstRound.matches.flatMap((match) => match.players.map((player) => player.userId)))];
            setSelected(playerIds);
            if (roundRobin.partnerFormat === "FIXED" && roundRobin.playFormat !== "SINGLES") {
              const derivedTeams: [string, string][] = [];
              for (const match of firstRound.matches) {
                const sideA = match.players.filter((player) => player.side === "A").map((player) => player.userId);
                const sideB = match.players.filter((player) => player.side === "B").map((player) => player.userId);
                if (sideA.length === 2) derivedTeams.push([sideA[0], sideA[1]]);
                if (sideB.length === 2) derivedTeams.push([sideB[0], sideB[1]]);
              }
              setTeams(derivedTeams);
            }
          }
        }
      }
      if (playersResponse.ok) {
        const data = await playersResponse.json();
        setPlayers(data.players ?? []);
      }
    }).finally(() => setLoading(false));
  }, [roundRobinId]);

  async function saveAndRegenerate() {
    if (selected.length < minPlayers) { showNotice(`Select at least ${minPlayers} players.`, "error"); return; }
    if (needsFixedTeams) {
      if (teams.length < 2) { showNotice("Pair up at least two teams.", "error"); return; }
      if (selected.some((id) => !pairedPlayerIds.has(id))) { showNotice("Every selected player must be paired into a team.", "error"); return; }
    }
    setSaving(true);
    const patched = await fetch(`/api/round-robin/${roundRobinId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, format: form.gameFormat, partnerFormat: form.partnerFormat, playFormat: form.playFormat, courtCount: Number(form.courtCount), roundCount: Number(form.roundCount), pointsToWin: Number(form.pointsToWin), winBy: Number(form.winBy), skillBalanced: form.skillBalanced }) });
    const patchedData = await patched.json();
    if (!patched.ok) { showNotice(patchedData.error ?? "Unable to save changes.", "error"); setSaving(false); return; }
    const generateBody = needsFixedTeams ? { teams } : { playerIds: selected };
    const generated = await fetch(`/api/round-robin/${roundRobinId}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(generateBody) });
    if (!generated.ok) { showNotice((await generated.json()).error ?? "Unable to regenerate schedule.", "error"); setSaving(false); return; }
    router.push(`/round-robin/${roundRobinId}`);
  }

  if (loading) return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton mt-6 h-16 w-2/3 max-w-lg rounded-xl" />
      </div>
    </main>
  );

  if (!detail) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[var(--foreground)]">Round robin not found.</p><Link href="/round-robin" className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Back to round robin builder</Link></div></main>;

  if (!detail.isOwner) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[var(--foreground)]">Only the organizer can edit this round robin.</p><Link href={`/round-robin/${roundRobinId}`} className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Back to room</Link></div></main>;

  if (detail.hasScores) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="max-w-sm text-center"><p className="font-bold text-[var(--foreground)]">This round robin can no longer be edited.</p><p className="mt-2 text-sm text-[var(--ink-soft)]">Scores have already been entered, so editing is locked to protect match results.</p><Link href={`/round-robin/${roundRobinId}`} className="mt-4 inline-block text-sm font-bold text-[var(--lime-deep)]">Back to room</Link></div></main>;

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href={`/round-robin/${roundRobinId}`} className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to room</Link>
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Edit round robin</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">{detail.name}</h1>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">Change the format, players, or teams. Saving regenerates the schedule from scratch.</p>
        </div>
        {notice && (
          <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1e2b17] text-[#c7e572]"}`}>{notice.text}</p>
        )}

        <section className="mt-8 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          <h2 className="font-extrabold">1. Format</h2>

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
                  <button key={option.id} onClick={() => { setForm({ ...form, partnerFormat: option.id }); setTeams([]); setPendingPartner(null); }} className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors sm:flex-none sm:px-6 ${form.partnerFormat === option.id ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="block text-[11px] text-[var(--ink-soft)]">{option.detail}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Game format</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {gameFormats.map((format) => {
              const Icon = format.icon;
              return (
                <button key={format.id} onClick={() => setForm({ ...form, gameFormat: format.id })} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${form.gameFormat === format.id ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                  <Icon size={18} className="shrink-0 text-[var(--lime-deep)]" />
                  <span>
                    <span className="block text-sm font-bold">{format.label}</span>
                    <span className="block text-xs text-[var(--ink-soft)]">{format.blurb}</span>
                  </span>
                </button>
              );
            })}
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
            <div className="flex items-center gap-2"><Users size={18} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">2. Players</h2></div>
            <span className="text-xs font-bold text-[var(--ink-soft)]">{selected.length} selected</span>
          </div>
          <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {players.map((player) => (
              <button key={player.id} onClick={() => togglePlayerSelected(player.id)} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left ${selected.includes(player.id) ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                <span><span className="block text-sm font-bold">{player.name}</span><span className="text-[11px] text-[var(--ink-soft)]">{player.rank ? `#${player.rank} rank` : "Unranked"}</span></span>
                {selected.includes(player.id) && <Check size={16} className="text-[var(--lime-deep)]" />}
              </button>
            ))}
          </div>
          {!needsFixedTeams && <button onClick={saveAndRegenerate} disabled={saving} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Save & regenerate schedule"} <ArrowRight size={16} /></button>}
        </section>

        {needsFixedTeams && (
          <section className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="flex items-center gap-2"><Users size={18} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">3. Teams</h2></div>
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
            <button onClick={saveAndRegenerate} disabled={saving} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Save & regenerate schedule"} <ArrowRight size={16} /></button>
          </section>
        )}
      </div>
    </main>
  );
}
