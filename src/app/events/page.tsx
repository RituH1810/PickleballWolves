"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, MapPin, Plus, X } from "lucide-react";

type LiveEvent = { id: string; title: string; startsAt: string; location: string; format: string; playerCap: number; going: number; group: string };

export default function EventsPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ title: "", startsAt: "", location: "", playerCap: "16", format: "DOUBLES" });

  useEffect(() => { fetch("/api/events").then((response) => response.ok ? response.json() : null).then((data) => data?.events && setEvents(data.events)).finally(() => setLoading(false)); }, []);

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

  return <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-5xl"><Link href="/" className="text-xs font-bold text-[#6b8f21]">Back to dashboard</Link><div className="mt-8 flex items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">Open play</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">Games worth showing up for.</h1><p className="mt-3 text-sm text-[#67716a]">Browse sessions hosted by your groups and local organizers.</p></div><button onClick={() => setCreating(!creating)} className="flex min-h-11 items-center gap-2 rounded-full bg-[#1b211e] px-5 py-3 text-sm font-bold text-white">{creating ? <X size={17} /> : <Plus size={17} />}{creating ? "Close" : "Create a game"}</button></div>{notice && <p role="status" className="mt-4 rounded-xl bg-[#e4f3a8] px-4 py-3 text-xs font-bold text-[#5c7b1a]">{notice}</p>}{creating && <section className="mt-6 rounded-[20px] border border-[#e2e7e2] bg-white p-6"><h2 className="text-lg font-extrabold">Create a game</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Game title" className="h-11 rounded-xl border border-[#dfe6df] px-3 text-sm" /><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location" className="h-11 rounded-xl border border-[#dfe6df] px-3 text-sm" /><input value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} type="datetime-local" className="h-11 rounded-xl border border-[#dfe6df] px-3 text-sm" /><input value={form.playerCap} onChange={(event) => setForm({ ...form, playerCap: event.target.value })} type="number" min="2" max="100" placeholder="Player cap" className="h-11 rounded-xl border border-[#dfe6df] px-3 text-sm" /><select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })} className="h-11 rounded-xl border border-[#dfe6df] bg-white px-3 text-sm"><option value="DOUBLES">Doubles</option><option value="SINGLES">Singles</option><option value="MIXED">Mixed doubles</option></select><button onClick={createGame} className="h-11 rounded-full bg-[#d8f24e] text-sm font-bold text-[#1b211e]">Publish game</button></div></section>}<div className="mt-9 space-y-3">{loading ? <p className="rounded-[20px] border border-[#e2e7e2] bg-white p-6 text-sm text-[#67716a]">Loading games...</p> : events.length === 0 ? <div className="rounded-[20px] border border-[#e2e7e2] bg-white p-8 text-center"><p className="font-bold text-[#1b211e]">No open games right now.</p><p className="mt-2 text-sm text-[#67716a]">Create one to get the pack together.</p></div> : events.map((event) => { const date = new Date(event.startsAt); const validDate = !Number.isNaN(date.getTime()); return <article key={event.id} className="flex flex-col gap-4 rounded-[20px] border border-[#e2e7e2] bg-white p-5 sm:flex-row sm:items-center sm:p-6"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#eef2ed] text-center text-xs font-black leading-4 text-[#5c721e]">{validDate ? date.toLocaleDateString(undefined, { weekday: "short" }) : "OPEN"}<br />{validDate ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "PLAY"}</div><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold tracking-tight text-[#1b211e]">{event.title}</h2><p className="mt-1 text-xs text-[#67716a]">{event.group}</p><div className="mt-3 flex flex-wrap gap-4 text-xs text-[#67716a]"><span className="flex items-center gap-1"><CalendarDays size={14} />{validDate ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : event.startsAt}</span><span className="flex items-center gap-1"><MapPin size={14} />{event.location}</span></div></div><div className="flex items-center gap-4"><span className="text-xs font-bold text-[#67716a]"><strong className="text-[#1b211e]">{Math.max(0, event.playerCap - event.going)}</strong> spots left</span><button onClick={() => joinGame(event.id)} className="grid h-10 w-10 place-items-center rounded-full bg-[#d8f24e] text-[#1b211e]" aria-label={`Join ${event.title}`}><ChevronRight size={18} /></button></div></article>; })}</div></div></main>;
}
