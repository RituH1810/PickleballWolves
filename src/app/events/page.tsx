"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, MapPin, PawPrint, Plus, Repeat, X } from "lucide-react";
import { LivePulse } from "@/components/pickleball-art";

type LiveEvent = { id: string; title: string; startsAt: string; location: string; format: string; playerCap: number; going: number; group: string };
type MyRoundRobin = { id: string; name: string; groupName: string | null; playFormat: string; partnerFormat: string; status: string; scheduledAt: string | null; isOrganizer: boolean; myRsvpStatus: "JOINED" | "DECLINED" | null };
type RecentResult = { id: string; opponent: string; score: string; result: "W" | "L" | "-"; date: string };
type RawMatch = { id: string; players: { id: string; name: string; side: "A" | "B" }[]; event: string; scores: { sideAScore: number; sideBScore: number }[]; scheduledAt: string | null };

const partnerFormatLabels: Record<string, string> = { ROTATE: "Rotating partners", FIXED: "Fixed partners" };

export default function EventsPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ title: "", startsAt: "", location: "", playerCap: "16", format: "DOUBLES" });
  const [myRoundRobins, setMyRoundRobins] = useState<MyRoundRobin[]>([]);
  const [loadingRoundRobins, setLoadingRoundRobins] = useState(true);
  const [rawMatches, setRawMatches] = useState<RawMatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => { fetch("/api/events").then((response) => response.ok ? response.json() : null).then((data) => data?.events && setEvents(data.events)).finally(() => setLoading(false)); }, []);

  useEffect(() => {
    fetch("/api/dashboard").then((response) => response.ok ? response.json() : null).then((data) => {
      setMyUserId(data?.userId ?? null);
      if (data?.myRoundRobins) setMyRoundRobins(data.myRoundRobins);
    }).finally(() => setLoadingRoundRobins(false));
  }, []);

  useEffect(() => {
    fetch("/api/matches").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.matches) setRawMatches(data.matches.slice(0, 8)); }).finally(() => setLoadingHistory(false));
  }, []);

  const history: RecentResult[] = rawMatches.map((match) => {
    const mine = match.players.find((player) => player.id === myUserId);
    const teammates = match.players.filter((player) => player.id !== myUserId && player.side === mine?.side).map((player) => player.name);
    const opposingSide = match.players.filter((player) => player.side !== mine?.side).map((player) => player.name);
    const myLabel = teammates.length ? `You & ${teammates.join(" & ")}` : "You";
    const theirLabel = opposingSide.length ? opposingSide.join(" & ") : (match.players.filter((player) => player.id !== myUserId).map((player) => player.name).join(" & ") || "Unknown");
    const myScore = match.scores.reduce((total, score) => total + (mine?.side === "A" ? score.sideAScore : score.sideBScore), 0);
    const theirScore = match.scores.reduce((total, score) => total + (mine?.side === "A" ? score.sideBScore : score.sideAScore), 0);
    const margin = myScore - theirScore;
    const scoreText = match.scores.map((score) => `${mine?.side === "A" ? score.sideAScore : score.sideBScore} - ${mine?.side === "A" ? score.sideBScore : score.sideAScore}`).join(", ") || "No score";
    return { id: match.id, opponent: `${myLabel} vs ${theirLabel}`, score: scoreText, result: match.scores.length ? (margin > 0 ? "W" : margin < 0 ? "L" : "-") : "-", date: match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString() : "Recently" };
  });

  async function createGame() {
    const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, playerCap: Number(form.playerCap) }) });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error ?? "Unable to create game"); return; }
    setEvents((current) => [{ ...data.event, startsAt: data.event.startsAt, going: 0, group: "Open play" }, ...current]);
    setCreating(false);
    setForm({ title: "", startsAt: "", location: "", playerCap: "16", format: "DOUBLES" });
    setNotice("Game created");
  }

  async function joinGame(eventId: string) {
    const response = await fetch(`/api/events/${eventId}/rsvp`, { method: "POST" });
    const data = await response.json();
    setNotice(response.ok ? `RSVP status: ${data.status.toLowerCase()}` : data.error ?? "Sign in to join this game");
    if (response.ok && data.status === "GOING") setEvents((current) => current.map((event) => event.id === eventId ? { ...event, going: event.going + 1 } : event));
  }

  async function respondRoundRobin(id: string, status: "JOINED" | "DECLINED") {
    const response = await fetch(`/api/round-robin/${id}/rsvp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) return;
    setMyRoundRobins((items) => items
      .map((item) => item.id === id ? { ...item, myRsvpStatus: status } : item)
      .filter((item) => item.id !== id || status === "JOINED" || item.isOrganizer));
  }

  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-5xl"><Link href="/" className="text-xs font-bold text-[var(--lime-deep)]">Back to dashboard</Link><div className="mt-8 flex items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Open play</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">Games worth showing up for.</h1><p className="mt-3 text-sm text-[var(--ink-soft)]">Browse sessions hosted by your groups and local organizers.</p></div><button onClick={() => setCreating(!creating)} className="flex min-h-11 items-center gap-2 rounded-full bg-[var(--lime)] px-5 py-3 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">{creating ? <X size={17} /> : <Plus size={17} />}{creating ? "Close" : "Create a game"}</button></div>{notice && <p role="status" className="mt-4 rounded-xl bg-[#1e2b17] px-4 py-3 text-xs font-bold text-[#c7e572]">{notice}</p>}{creating && <section className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6"><h2 className="text-lg font-extrabold">Create a game</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Game title" className="h-11 rounded-xl border border-[var(--line)] px-3 text-sm" /><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location" className="h-11 rounded-xl border border-[var(--line)] px-3 text-sm" /><input value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} type="datetime-local" className="h-11 rounded-xl border border-[var(--line)] px-3 text-sm" /><input value={form.playerCap} onChange={(event) => setForm({ ...form, playerCap: event.target.value })} type="number" min="2" max="100" placeholder="Player cap" className="h-11 rounded-xl border border-[var(--line)] px-3 text-sm" /><select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })} className="h-11 rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm"><option value="DOUBLES">Doubles</option><option value="SINGLES">Singles</option><option value="MIXED">Mixed doubles</option></select><button onClick={createGame} className="h-11 rounded-full bg-[#d8f24e] text-sm font-bold text-[#1b211e]">Publish game</button></div></section>}<div className="mt-9 space-y-3">{loading ? <p className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">Loading games...</p> : events.length === 0 ? <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-8 text-center"><p className="font-bold text-[var(--foreground)]">No open games right now.</p><p className="mt-2 text-sm text-[var(--ink-soft)]">Create one to get the pack together.</p></div> : events.map((event) => { const date = new Date(event.startsAt); const validDate = !Number.isNaN(date.getTime()); return <article key={event.id} className="flex flex-col gap-4 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:flex-row sm:items-center sm:p-6"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#1c2a1a] text-center text-xs font-black leading-4 text-[var(--lime-deep)]">{validDate ? date.toLocaleDateString(undefined, { weekday: "short" }) : "OPEN"}<br />{validDate ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "PLAY"}</div><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold tracking-tight text-[var(--foreground)]">{event.title}</h2><p className="mt-1 text-xs text-[var(--ink-soft)]">{event.group}</p><div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--ink-soft)]"><span className="flex items-center gap-1"><CalendarDays size={14} />{validDate ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : event.startsAt}</span><span className="flex items-center gap-1"><MapPin size={14} />{event.location}</span></div></div><div className="flex items-center gap-4"><span className="text-xs font-bold text-[var(--ink-soft)]"><strong className="text-[var(--foreground)]">{Math.max(0, event.playerCap - event.going)}</strong> spots left</span><button onClick={() => joinGame(event.id)} className="grid h-10 w-10 place-items-center rounded-full bg-[#d8f24e] text-[#1b211e]" aria-label={`Join ${event.title}`}><ChevronRight size={18} /></button></div></article>; })}</div>

    <section className="mt-10">
      <h2 className="text-xl font-extrabold tracking-tight">Your round robins</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Upcoming and live round robins across every group you&apos;re in.</p>
      <div className="mt-4 space-y-3">
        {loadingRoundRobins ? Array.from({ length: 2 }).map((_, index) => <div key={index} className="skeleton h-16 rounded-[20px]" />) : myRoundRobins.length === 0 ? <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">No round robins yet. <Link href="/round-robin" className="font-bold text-[var(--lime-deep)]">Build one</Link> to get started.</div> : myRoundRobins.map((roundRobin) => (
          <div key={roundRobin.id} className="flex flex-col gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4 sm:flex-row sm:items-center sm:p-5">
            <Link href={`/round-robin/${roundRobin.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1c2a1a] text-[var(--lime-deep)]"><Repeat size={18} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--foreground)]">{roundRobin.name}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">{roundRobin.groupName ? `${roundRobin.groupName} · ` : ""}{roundRobin.scheduledAt ? new Date(roundRobin.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : (partnerFormatLabels[roundRobin.partnerFormat] ?? roundRobin.partnerFormat)}</p>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              {roundRobin.isOrganizer && <span className="rounded-full bg-[#1c2a1a] px-2 py-1 text-[10px] font-bold text-[var(--ink-soft)]">Organizing</span>}
              {roundRobin.status === "SETUP" ? (
                <>
                  <button onClick={() => respondRoundRobin(roundRobin.id, "JOINED")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${roundRobin.myRsvpStatus === "JOINED" ? "bg-[var(--lime)] text-[#0f1712]" : "border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]"}`}>{roundRobin.myRsvpStatus === "JOINED" ? "You're in" : "Join"}</button>
                  <button onClick={() => respondRoundRobin(roundRobin.id, "DECLINED")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${roundRobin.myRsvpStatus === "DECLINED" ? "bg-[var(--coral)] text-[#2e1a16]" : "border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]"}`}>Decline</button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-[#1e2b17] px-2.5 py-1 text-[10px] font-bold text-[#c7e572]"><LivePulse color="#c7e572" size={6} />Live</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="mt-10">
      <h2 className="text-xl font-extrabold tracking-tight">Recent history</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Your completed matches, most recent first.</p>
      <div className="mt-4 space-y-2">
        {loadingHistory ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-14 rounded-xl" />) : history.length === 0 ? <div className="flex items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]"><PawPrint size={18} className="shrink-0 text-[var(--lime-deep)]" /><p>No completed matches yet.</p></div> : history.map((result) => (
          <div key={result.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#131f19] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">{result.opponent}</p>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{result.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold ${result.result === "W" ? "text-[var(--lime-deep)]" : result.result === "L" ? "text-[var(--coral)]" : "text-[var(--ink-soft)]"}`}>{result.score}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${result.result === "W" ? "bg-[var(--lime)] text-[#0f1712]" : result.result === "L" ? "bg-[var(--coral)] text-[#2e1a16]" : "bg-[#1c2a1a] text-[var(--ink-soft)]"}`}>{result.result}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  </div></main>;
}
