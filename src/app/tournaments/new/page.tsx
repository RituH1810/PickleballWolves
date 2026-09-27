"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Award, Check, Users } from "lucide-react";

type Player = { id: string; name: string; rank: number | null; skillRating: string; gender: "MALE" | "FEMALE" | "UNSPECIFIED" | null };

const skillLevels = [
  { id: "BEGINNER", label: "Beginner", detail: "Rating below 3.5" },
  { id: "INTERMEDIATE", label: "Intermediate", detail: "Rating 3.5 to 4.0" },
  { id: "ADVANCED", label: "Advanced", detail: "Rating 4.0 and up" },
];
const eventTypes = [
  { id: "SINGLES", label: "Singles", detail: "1 vs 1, no partner." },
  { id: "DOUBLES", label: "Doubles", detail: "2 vs 2 fixed teams." },
  { id: "MIXED", label: "Mixed doubles", detail: "2 vs 2, one male + one female per team." },
];
const teamFormationOptions = [
  { id: "AUTO_BALANCED", label: "Auto: balanced by rating", detail: "Pairs strongest with weakest so team totals land close together." },
  { id: "AUTO_RANDOM", label: "Auto: random", detail: "Pairs players randomly." },
  { id: "MANUAL", label: "Manual", detail: "Pair teams yourself from the tournament page after creating it." },
];
function skillLevelForRating(rating: number) {
  if (rating < 3.5) return "BEGINNER";
  if (rating < 4.0) return "INTERMEDIATE";
  return "ADVANCED";
}

const stepLabels = ["Details", "Level & type", "Players", "Teams", "Review"];

export default function NewTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    courtCount: "2",
    startDate: "",
    endDate: "",
    skillLevel: "INTERMEDIATE",
    eventType: "DOUBLES",
    registrationMode: "ROSTER" as "ROSTER" | "OPEN",
    registrationDeadline: "",
    teamFormationMethod: "AUTO_BALANCED",
    pointsToWin: "11",
    winBy: "1",
  });

  useEffect(() => { fetch("/api/players").then((response) => response.json()).then((data) => setPlayers(data.players ?? [])); }, []);

  const clampedStep = Math.min(step, stepLabels.length - 1);
  const isRoster = form.registrationMode === "ROSTER";
  const minPlayers = form.eventType === "SINGLES" ? 2 : 4;

  function showNotice(text: string, type: "success" | "error") {
    setNotice({ text, type });
    if (type === "error") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext() {
    if (clampedStep === 0 && (!form.name.trim() || !form.location.trim() || !form.startDate)) { showNotice("Fill in the tournament name, location, and start date.", "error"); return; }
    if (clampedStep === 1 && !isRoster && !form.registrationDeadline) { showNotice("Pick a registration deadline for open sign-up.", "error"); return; }
    if (clampedStep === 2 && isRoster && selected.length > 0 && selected.length < minPlayers) { showNotice(`Select at least ${minPlayers} players, or none to add players later.`, "error"); return; }
    setStep((current) => Math.min(current + 1, stepLabels.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function togglePlayer(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((playerId) => playerId !== id) : [...current, id]);
  }

  async function createTournament() {
    setCreating(true);
    const created = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        location: form.location,
        courtCount: Number(form.courtCount),
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        skillLevel: form.skillLevel,
        eventType: form.eventType,
        teamFormationMethod: form.teamFormationMethod,
        registrationMode: form.registrationMode,
        registrationDeadline: !isRoster ? new Date(form.registrationDeadline).toISOString() : undefined,
        pointsToWin: Number(form.pointsToWin),
        winBy: Number(form.winBy),
      }),
    });
    const createdData = await created.json();
    if (!created.ok) { showNotice(createdData.error ?? "Unable to create tournament.", "error"); setCreating(false); return; }
    const tournamentId = createdData.tournament.id;

    if (isRoster && selected.length > 0) {
      for (const userId of selected) {
        await fetch(`/api/tournaments/${tournamentId}/entrants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, override: true }) });
      }
      // Teams can be formed right away, but grouping always happens later on the tournament
      // page once the organizer can see the real registration count and decide how many groups
      // to split into.
      if (selected.length >= minPlayers && form.teamFormationMethod !== "MANUAL") {
        await fetch(`/api/tournaments/${tournamentId}/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: form.teamFormationMethod, override: true }) });
      }
    }

    router.push(`/tournaments/${tournamentId}`);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/tournaments" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to tournaments</Link>
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Bracket play</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">Create a tournament.</h1>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">Open to any player -- pick a level, format, and how teams and groups come together.</p>
        </div>
        {notice && <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1e2b17] text-[#c7e572]"}`}>{notice.text}</p>}

        <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-1">
          {stepLabels.map((label, index) => (
            <div key={label} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${index === clampedStep ? "bg-[var(--lime)] text-[#0f1712]" : index < clampedStep ? "bg-[#1e2b17] text-[#c7e572]" : "bg-[#1c2a1a] text-[var(--ink-soft)]"}`}>
              {index < clampedStep ? <Check size={12} /> : <span>{index + 1}</span>}{label}
            </div>
          ))}
        </div>

        <section className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          {clampedStep === 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <h2 className="font-extrabold sm:col-span-2">1. Details</h2>
              <label className="text-xs font-bold text-[#c3d0c5] sm:col-span-2">Tournament name
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Fall Smash Tournament" className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
              </label>
              <label className="text-xs font-bold text-[#c3d0c5] sm:col-span-2">Description (optional)
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm" />
              </label>
              <label className="text-xs font-bold text-[#c3d0c5] sm:col-span-2">Location
                <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Northside Courts" className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
              </label>
              <label className="text-xs font-bold text-[#c3d0c5]">Courts available
                <input type="number" min="1" value={form.courtCount} onChange={(event) => setForm({ ...form, courtCount: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
              </label>
              <label className="text-xs font-bold text-[#c3d0c5]">Start date
                <input type="datetime-local" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
              </label>
              <label className="text-xs font-bold text-[#c3d0c5]">End date (optional)
                <input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
              </label>
            </div>
          )}

          {clampedStep === 1 && (
            <div>
              <h2 className="font-extrabold">2. Level & type</h2>
              <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Skill level</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skillLevels.map((level) => (
                  <button key={level.id} onClick={() => setForm({ ...form, skillLevel: level.id })} className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors sm:flex-none sm:px-6 ${form.skillLevel === level.id ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                    <span className="block text-sm font-bold">{level.label}</span>
                    <span className="block text-[11px] text-[var(--ink-soft)]">{level.detail}</span>
                  </button>
                ))}
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Event type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {eventTypes.map((type) => (
                  <button key={type.id} onClick={() => setForm({ ...form, eventType: type.id })} className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors sm:flex-none sm:px-6 ${form.eventType === type.id ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                    <span className="block text-sm font-bold">{type.label}</span>
                    <span className="block text-[11px] text-[var(--ink-soft)]">{type.detail}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-5 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
                <label className="text-xs font-bold text-[#c3d0c5]">Points to win
                  <select value={form.pointsToWin} onChange={(event) => setForm({ ...form, pointsToWin: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm">
                    <option value="11">11</option>
                    <option value="15">15</option>
                    <option value="21">21</option>
                  </select>
                </label>
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Registration</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setForm({ ...form, registrationMode: "ROSTER" })} className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors sm:flex-none sm:px-6 ${isRoster ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                  <span className="block text-sm font-bold">Pick players myself</span>
                  <span className="block text-[11px] text-[var(--ink-soft)]">Choose from registered players now or add more later.</span>
                </button>
                <button onClick={() => setForm({ ...form, registrationMode: "OPEN" })} className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors sm:flex-none sm:px-6 ${!isRoster ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                  <span className="block text-sm font-bold">Open sign-up link</span>
                  <span className="block text-[11px] text-[var(--ink-soft)]">Share a link; anyone can register until the deadline.</span>
                </button>
              </div>
              {!isRoster && (
                <label className="mt-4 block text-xs font-bold text-[#c3d0c5] sm:w-1/2">Registration deadline
                  <input type="datetime-local" value={form.registrationDeadline} onChange={(event) => setForm({ ...form, registrationDeadline: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-4 text-sm" />
                </label>
              )}
            </div>
          )}

          {clampedStep === 2 && (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Users size={18} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">3. Players</h2></div>
                {isRoster && <span className="text-xs font-bold text-[var(--ink-soft)]">{selected.length} selected</span>}
              </div>
              {isRoster ? (
                <>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">Optional -- pick registered players now, or skip and add them from the tournament page later. Players whose rating doesn&apos;t match {skillLevels.find((level) => level.id === form.skillLevel)?.label.toLowerCase()} are flagged, but you can still add them.</p>
                  <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
                    {players.map((player) => {
                      const mismatch = skillLevelForRating(Number(player.skillRating)) !== form.skillLevel;
                      return (
                        <button key={player.id} onClick={() => togglePlayer(player.id)} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left ${selected.includes(player.id) ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                          <span><span className="block text-sm font-bold">{player.name}</span><span className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)]">Rating {player.skillRating}{mismatch && <span className="flex items-center gap-0.5 text-[#f2a08c]"><AlertTriangle size={10} />mismatch</span>}</span></span>
                          {selected.includes(player.id) && <Check size={16} className="text-[var(--lime-deep)]" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[#131f19] p-4 text-sm text-[var(--ink-soft)]">
                  <Award size={18} className="shrink-0 text-[var(--lime-deep)]" />
                  <p>Registration is open -- once this tournament is created, you&apos;ll get a shareable link for players to sign themselves up until the deadline.</p>
                </div>
              )}
            </div>
          )}

          {clampedStep === 3 && (
            <div>
              <h2 className="font-extrabold">4. Teams</h2>
              {form.eventType === "SINGLES" ? (
                <p className="mt-2 text-sm text-[var(--ink-soft)]">Singles has no team pairing -- every registered player is their own entry.</p>
              ) : (
                <>
                  <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">How should teams be formed?</p>
                  <div className="mt-2 grid gap-2">
                    {teamFormationOptions.map((option) => (
                      <button key={option.id} onClick={() => setForm({ ...form, teamFormationMethod: option.id })} className={`rounded-xl border px-4 py-3 text-left transition-colors ${form.teamFormationMethod === option.id ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                        <span className="block text-sm font-bold">{option.label}</span>
                        <span className="block text-[11px] text-[var(--ink-soft)]">{option.detail}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="mt-6 rounded-xl border border-[var(--line)] bg-[#131f19] px-4 py-3 text-xs text-[var(--ink-soft)]">Groups (A, B, C...) are set up later from the tournament page, once you can see how many players actually registered -- you&apos;ll pick how many groups to split into then.</p>
            </div>
          )}

          {clampedStep === 4 && (
            <div>
              <h2 className="font-extrabold">5. Review</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--ink-soft)]">Name</span><span className="font-bold">{form.name || "--"}</span></div>
                <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--ink-soft)]">Location</span><span className="font-bold">{form.location || "--"}</span></div>
                <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--ink-soft)]">Starts</span><span className="font-bold">{form.startDate ? new Date(form.startDate).toLocaleString() : "--"}</span></div>
                <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--ink-soft)]">Level & type</span><span className="font-bold">{skillLevels.find((l) => l.id === form.skillLevel)?.label} · {eventTypes.find((t) => t.id === form.eventType)?.label}</span></div>
                <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--ink-soft)]">Registration</span><span className="font-bold">{isRoster ? `Picking players (${selected.length} selected)` : `Open until ${form.registrationDeadline ? new Date(form.registrationDeadline).toLocaleString() : "--"}`}</span></div>
                <div className="flex justify-between pb-2"><span className="text-[var(--ink-soft)]">Team formation</span><span className="font-bold">{form.eventType === "SINGLES" ? "N/A (singles)" : teamFormationOptions.find((o) => o.id === form.teamFormationMethod)?.label}</span></div>
              </div>
              {isRoster && selected.length > 0 && selected.length >= minPlayers && form.teamFormationMethod !== "MANUAL" && (
                <p className="mt-4 rounded-xl bg-[#1e2b17] px-4 py-3 text-xs font-semibold text-[#c7e572]">Teams will be formed automatically right after creating this tournament. You&apos;ll assign groups from the tournament page afterward.</p>
              )}
              <button onClick={createTournament} disabled={creating} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">{creating ? "Creating..." : "Create tournament"} <ArrowRight size={16} /></button>
            </div>
          )}

          {clampedStep < 4 && (
            <div className="mt-8 flex items-center justify-between border-t border-[var(--line)] pt-6">
              {clampedStep > 0 ? <button onClick={goBack} className="rounded-full border border-[var(--line)] px-5 py-2.5 text-xs font-bold text-[var(--foreground)]">Back</button> : <span />}
              <button onClick={goNext} className="flex items-center gap-2 rounded-full bg-[var(--lime)] px-5 py-2.5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">Next <ArrowRight size={14} /></button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
