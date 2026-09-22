"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowRight, Bell, CalendarDays, ChevronRight, CircleHelp, Grid2X2, LayoutDashboard, MapPin, Menu, PawPrint, Plus, Repeat, Search, Settings, Trophy, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LivePulse, PaddleIcon, PickleballIcon } from "@/components/pickleball-art";

type DashboardEvent = { id: string; title: string; dateLabel: string; timeLabel: string; location: string; format: string; spotsLeft: number; totalSpots: number; group: string; accent: "lime" | "coral" | "blue"; attending?: boolean };
type DashboardGroup = { id: string; name: string; members: number; next: string; mark: string; color?: string };
type LeaderboardEntry = { rank: number; name: string; initials: string; rating: string; wins: number; losses: number; winPct: number; scored: number; conceded: number; avgPointDiff: number; movement: number };
type RecentResult = { opponent: string; event: string; score: string; result: string; points: string; date: string };
type PendingRoundRobin = { id: string; name: string; groupName: string; organizerName: string; playFormat: string; partnerFormat: string; joinedCount: number; scheduledAt: string | null };
type MyRoundRobin = { id: string; name: string; groupName: string | null; playFormat: string; partnerFormat: string; status: string; scheduledAt: string | null; isOrganizer: boolean; myRsvpStatus: "JOINED" | "DECLINED" | null };

const pendingPlayFormatLabels: Record<string, string> = { SINGLES: "Singles", DOUBLES: "Doubles", MIXED: "Mixed doubles" };
const pendingPartnerFormatLabels: Record<string, string> = { ROTATE: "Rotating partners", FIXED: "Fixed partners" };

function Logo() {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1b211e] text-sm font-black tracking-tight text-[var(--lime)]">PW</div><div><p className="text-[15px] font-extrabold tracking-tight">Pickleball<span className="text-[var(--lime-deep)]">Wolves</span></p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--ink-soft)]">Find your pack</p></div></div>;
}

function EventCard({ event, onToggle }: { event: DashboardEvent; onToggle: (id: string) => void }) {
  const color = event.accent === "lime" ? "#d8f24e" : event.accent === "coral" ? "#f17e62" : "#8cc9df";
  return <article className="panel group relative overflow-hidden rounded-[20px] p-5 transition-transform hover:-translate-y-1 sm:p-6">
    <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">{event.dateLabel}</p><h3 className="text-[17px] font-bold tracking-tight">{event.title}</h3></div><span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${color}33`, color }}>{event.format}</span></div>
    <div className="space-y-2 text-sm text-[var(--ink-soft)]"><p className="flex items-center gap-2"><CalendarDays size={15} />{event.timeLabel}</p><p className="flex items-center gap-2"><MapPin size={15} />{event.location}</p></div>
    <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="text-xs font-semibold text-[var(--ink-soft)]"><strong className="text-[var(--foreground)]">{event.spotsLeft}</strong> spots left</span><button onClick={() => onToggle(event.id)} className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${event.attending ? "bg-[var(--lime)] text-[#0f1712]" : "bg-[var(--lime)] text-[#0f1712] hover:bg-[#c3e043]"}`}>{event.attending ? "You’re in" : "Join game"}</button></div>
  </article>;
}

export function DashboardPage() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [eventList, setEventList] = useState<DashboardEvent[]>([]);
  const [groupList, setGroupList] = useState<DashboardGroup[]>([]);
  const [leaderboardList, setLeaderboardList] = useState<LeaderboardEntry[]>([]);
  const [recentResultsList, setRecentResultsList] = useState<RecentResult[]>([]);
  const [pendingRoundRobins, setPendingRoundRobins] = useState<PendingRoundRobin[]>([]);
  const [myRoundRobins, setMyRoundRobins] = useState<MyRoundRobin[]>([]);
  const [profileSummary, setProfileSummary] = useState({ name: "Player", rating: "-", initials: "PW", record: "0 - 0", winRate: "0.0%", rank: "-" as number | string });
  const [filter, setFilter] = useState<"All" | "Doubles" | "Mixed doubles">("All");
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [todayLabel, setTodayLabel] = useState("");
  // Dashboard is statically prerendered at build time, so computing this during render would freeze
  // it at the build date. Compute it client-side, from the viewer's own clock, after mount instead.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setTodayLabel(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })); }, []);
  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "My games", icon: CalendarDays, count: eventList.filter((event) => event.attending).length },
    { label: "Groups", icon: Users },
    { label: "Round robin", icon: Repeat },
    { label: "Leaderboards", icon: Trophy },
    { label: "Match history", icon: Activity },
  ];
  useEffect(() => {
    const dashboardPromise = fetch("/api/dashboard").then((response) => response.ok ? response.json() : null);
    const matchesPromise = fetch("/api/matches").then((response) => response.ok ? response.json() : null);
    dashboardPromise.then((data) => {
      if (data?.events) setEventList(data.events);
      if (data?.groups) setGroupList(data.groups);
      if (data?.pendingRoundRobins) setPendingRoundRobins(data.pendingRoundRobins);
      if (data?.myRoundRobins) setMyRoundRobins(data.myRoundRobins);
    }).finally(() => setLoadingDashboard(false));
    Promise.all([dashboardPromise, matchesPromise]).then(([dashboardData, matchData]) => {
      if (!matchData?.matches) return;
      const userId: string | null = dashboardData?.userId ?? null;
      setRecentResultsList(matchData.matches.slice(0, 3).map((match: { players: { id: string; name: string; side: "A" | "B" }[]; event: string; scores: { sideAScore: number; sideBScore: number }[]; scheduledAt: string | null }) => {
        const mine = match.players.find((player) => player.id === userId);
        const teammates = match.players.filter((player) => player.id !== userId && player.side === mine?.side).map((player) => player.name);
        const opposingSide = match.players.filter((player) => player.side !== mine?.side).map((player) => player.name);
        const myLabel = teammates.length ? `You & ${teammates.join(" & ")}` : "You";
        const theirLabel = opposingSide.length ? opposingSide.join(" & ") : (match.players.filter((player) => player.id !== userId).map((player) => player.name).join(" & ") || "Unknown");
        const myScore = match.scores.reduce((total, score) => total + (mine?.side === "A" ? score.sideAScore : score.sideBScore), 0);
        const theirScore = match.scores.reduce((total, score) => total + (mine?.side === "A" ? score.sideBScore : score.sideAScore), 0);
        const margin = myScore - theirScore;
        const scoreText = match.scores.map((score) => `${mine?.side === "A" ? score.sideAScore : score.sideBScore} - ${mine?.side === "A" ? score.sideBScore : score.sideAScore}`).join(", ") || "No score";
        return { opponent: `${myLabel} vs ${theirLabel}`, event: match.event, score: scoreText, result: match.scores.length ? (margin > 0 ? "W" : margin < 0 ? "L" : "-") : "-", points: "", date: match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString() : "Recently" };
      }));
    }).finally(() => setLoadingMatches(false));
    fetch("/api/leaderboard").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.leaderboard) setLeaderboardList(data.leaderboard.map((entry: { rank: number; name: string; rating: string; wins: number; losses: number; winPct: number; scored: number; conceded: number; avgPointDiff: number; movement: number }) => ({ ...entry, initials: entry.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() }))); }).finally(() => setLoadingLeaderboard(false));
    fetch("/api/profile").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.profile) { const name = data.profile.name; setProfileSummary({ name, rating: data.profile.skillRating, initials: name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(), record: data.profile.record, winRate: data.profile.winRate, rank: data.profile.rank }); } });
  }, []);
  useEffect(() => { const routes: Record<string, string> = { "My games": "/events", Groups: "/groups", "Round robin": "/round-robin", Leaderboards: "/leaderboards", "Match history": "/matches" }; const handlers: Array<[Element, EventListener]> = []; document.querySelectorAll("button").forEach((button) => { const label = button.textContent?.replace(/\d+$/, "").trim() ?? ""; const route = routes[label]; if (route) { const handler = () => router.push(route); button.addEventListener("click", handler); handlers.push([button, handler]); } }); const notification = document.querySelector('button[aria-label="Notifications"]'); if (notification) { const handler = () => router.push("/notifications"); notification.addEventListener("click", handler); handlers.push([notification, handler]); } const createGame = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Create a game")); if (createGame) { const handler = () => router.push("/events"); createGame.addEventListener("click", handler); handlers.push([createGame, handler]); } const signOut = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Sign out"); if (signOut) { const handler = async () => { await createClient().auth.signOut(); router.push("/login"); }; signOut.addEventListener("click", handler); handlers.push([signOut, handler]); } return () => handlers.forEach(([element, handler]) => element.removeEventListener("click", handler)); }, [router]);
  const toggleEvent = async (id: string) => { const event = eventList.find((item) => item.id === id); if (!event || event.id.length < 20) return; const response = await fetch(`/api/events/${id}/rsvp`, { method: event.attending ? "DELETE" : "POST" }); if (response.ok) setEventList((items) => items.map((item) => item.id === id ? { ...item, attending: !item.attending, spotsLeft: item.attending ? item.spotsLeft + 1 : Math.max(0, item.spotsLeft - 1) } : item)); };
  const respondRoundRobin = async (id: string, status: "JOINED" | "DECLINED") => {
    const response = await fetch(`/api/round-robin/${id}/rsvp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) setPendingRoundRobins((items) => items.filter((item) => item.id !== id));
  };
  const respondMyRoundRobin = async (id: string, status: "JOINED" | "DECLINED") => {
    const response = await fetch(`/api/round-robin/${id}/rsvp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) return;
    setMyRoundRobins((items) => items
      .map((item) => item.id === id ? { ...item, myRsvpStatus: status } : item)
      .filter((item) => item.id !== id || status === "JOINED" || item.isOrganizer));
  };
  const visibleEvents = eventList.filter((event) => filter === "All" || event.format === filter);

  return <div className="min-h-screen bg-[var(--background)] noise lg:flex">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-[var(--line)] bg-[var(--panel)] p-5 transition-transform lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between"><Logo /><button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 lg:hidden" aria-label="Close menu"><X size={20} /></button></div>
      <div className="mt-10 flex flex-1 flex-col"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--ink-soft)]">Your court</p><nav className="space-y-1">{navItems.map(({ label, icon: Icon, count }) => <button key={label} onClick={() => { setActiveNav(label); setMobileOpen(false); }} className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold transition-colors ${activeNav === label ? "bg-[#1b211e] text-[var(--lime)]" : "text-[var(--ink-soft)] hover:bg-[#1c2a1a]"}`}><span className="flex items-center gap-3"><Icon size={18} />{label}</span>{Boolean(count) && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] ${activeNav === label ? "bg-[var(--lime)] text-[#0f1712]" : "bg-[#22331f] text-[var(--lime-deep)]"}`}>{count}</span>}</button>)}</nav><p className="mb-3 mt-9 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--ink-soft)]">Explore</p><nav className="space-y-1"><a href="#groups" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--ink-soft)] hover:bg-[#1c2a1a]"><Grid2X2 size={18} />Browse groups</a><a href="#leaderboard" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--ink-soft)] hover:bg-[#1c2a1a]"><Trophy size={18} />Site leaderboard</a></nav></div>
      <div className="rounded-2xl bg-[#1a2a1c] p-4"><div className="mb-3 flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--lime)] text-xs font-extrabold text-[#0f1712]">{profileSummary.initials}</span><span className="rounded-full bg-[#0f1712] px-2 py-1 text-[10px] font-bold text-[var(--ink-soft)]">{profileSummary.rating} rating</span></div><p className="text-sm font-bold">Ready for a game?</p><p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">Your next win is probably closer than you think.</p></div>
      <div className="mt-5 flex items-center justify-between px-1 text-[var(--ink-soft)]"><button aria-label="Settings" className="rounded-lg p-2 hover:bg-[#1c2a1a]"><Settings size={18} /></button><button aria-label="Help" className="rounded-lg p-2 hover:bg-[#1c2a1a]"><CircleHelp size={18} /></button><button aria-label="Sign out" className="text-xs font-semibold hover:text-[var(--foreground)]">Sign out</button></div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <main className="min-w-0 flex-1"><header className="flex h-[76px] items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-5 sm:px-8 lg:px-10"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 lg:hidden" aria-label="Open menu"><Menu size={22} /></button><div className="hidden items-center gap-2 text-sm text-[var(--ink-soft)] sm:flex"><span className="font-semibold text-[var(--foreground)]">{activeNav}</span></div><div className="ml-auto flex items-center gap-3"><button className="hidden rounded-full border border-[var(--line)] p-2.5 text-[var(--ink-soft)] hover:bg-[#1c2a1a] sm:block" aria-label="Search"><Search size={18} /></button><button className="relative rounded-full border border-[var(--line)] p-2.5 text-[var(--ink-soft)] hover:bg-[#1c2a1a]" aria-label="Notifications"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--amber)]" /></button><div className="grid h-9 w-9 place-items-center rounded-full bg-[#22331f] text-xs font-extrabold text-[var(--lime)]">{profileSummary.initials}</div></div></header>
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10 lg:px-10"><section className="fade-up relative flex flex-col justify-between gap-6 md:flex-row md:items-end"><PickleballIcon className="animate-float pointer-events-none absolute -top-6 right-8 hidden h-12 w-12 opacity-70 lg:block" /><div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">{todayLabel}</p><h1 className="max-w-[680px] text-3xl font-black tracking-[-.04em] sm:text-5xl">Welcome back to the pack, {profileSummary.name}<span className="text-[var(--lime-deep)]">.</span></h1><p className="mt-3 max-w-lg text-sm leading-6 text-[var(--ink-soft)]">The courts are calling. Here’s your playbook for the week ahead.</p></div><button className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-5 text-sm font-bold text-[#0f1712] shadow-[0_8px_20px_rgba(216,242,78,.18)] transition-transform hover:-translate-y-0.5 hover:bg-[#c3e043]"><Plus size={18} />Create a game</button></section>
        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Leagues & ladders", detail: "Run a season with standings or climb a challenge ladder.", icon: Trophy, href: "/leagues" },
            { label: "Round robins", detail: "Pick a format and get courts running in minutes.", icon: Repeat, href: "/round-robin" },
            { label: "Open play games", detail: "Host drop-in sessions with caps, spots, and RSVPs.", icon: CalendarDays, href: "/events" },
            { label: "Groups & community", detail: "Find your people or build your own court crew.", icon: Users, href: "/groups" },
          ].map((item) => (
            <a key={item.label} href={item.href} className="panel flex flex-col gap-3 rounded-2xl p-5 transition-transform hover:-translate-y-1">
              <item.icon size={20} className="text-[var(--lime-deep)]" />
              <div><p className="text-sm font-extrabold text-[var(--foreground)]">{item.label}</p><p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">{item.detail}</p></div>
            </a>
          ))}
        </section>
        <section className="mt-8 grid gap-3 sm:grid-cols-3"><div className="panel rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">My record</p><p className="mt-3 text-3xl font-black tracking-[-.04em]">{profileSummary.record}</p><p className="mt-1 text-xs font-semibold text-[var(--lime-deep)]">{profileSummary.winRate} win rate</p></div><div className="panel rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Current rank</p><p className="mt-3 flex items-center gap-2 text-3xl font-black tracking-[-.04em]">#{profileSummary.rank} <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--lime-deep)]"><LivePulse />live</span></p><p className="mt-1 text-xs font-semibold text-[var(--ink-soft)]">Across PickleballWolves</p></div><div className="rounded-2xl bg-[#1b211e] p-5 text-white"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a9b6a9]">Playing this week</p><p className="mt-3 text-3xl font-black tracking-[-.04em]">{eventList.filter((event) => event.attending).length} <span className="text-base font-semibold text-[#a9b6a9]">games</span></p><p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--lime)]"><LivePulse />Live from your events</p></div></section>
        <section className="mt-10" id="events"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-extrabold tracking-tight">Your upcoming games</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Keep your edge sharp with the right competition.</p></div><div className="flex gap-1 rounded-full bg-[#1a2a1c] p-1">{(["All", "Doubles", "Mixed doubles"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${filter === item ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm" : "text-[var(--ink-soft)]"}`}>{item}</button>)}</div></div><div className="grid gap-4 lg:grid-cols-3">{loadingDashboard ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-[220px] rounded-[20px]" />) : visibleEvents.length === 0 ? <div className="flex items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)] lg:col-span-3"><PawPrint size={18} className="shrink-0 text-[var(--lime-deep)]" /><p>No upcoming games yet. <a href="/events" className="font-bold text-[var(--lime-deep)]">Create one</a> to get the pack together.</p></div> : visibleEvents.map((event) => <EventCard key={event.id} event={event} onToggle={toggleEvent} />)}</div></section>

        {!loadingDashboard && pendingRoundRobins.length > 0 && (
          <section className="mt-10" id="round-robin-invites">
            <div className="mb-5"><h2 className="text-xl font-extrabold tracking-tight">Round robin invites</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Round robins your groups are setting up. Join in or pass.</p></div>
            <div className="grid gap-3 lg:grid-cols-2">
              {pendingRoundRobins.map((roundRobin) => (
                <div key={roundRobin.id} className="panel rounded-[20px] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/round-robin/${roundRobin.id}`} className="truncate text-sm font-extrabold text-[var(--foreground)] hover:text-[var(--lime-deep)]">{roundRobin.name}</Link>
                      {roundRobin.scheduledAt && <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[var(--lime-deep)]"><CalendarDays size={13} />{new Date(roundRobin.scheduledAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">{roundRobin.groupName} · {pendingPartnerFormatLabels[roundRobin.partnerFormat] ?? roundRobin.partnerFormat} · {pendingPlayFormatLabels[roundRobin.playFormat] ?? roundRobin.playFormat}</p>
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">Organized by {roundRobin.organizerName} · {roundRobin.joinedCount} joined</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => respondRoundRobin(roundRobin.id, "JOINED")} className="flex-1 rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] transition-colors hover:bg-[#c3e043]">Join</button>
                    <button onClick={() => respondRoundRobin(roundRobin.id, "DECLINED")} className="flex-1 rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="mt-10 grid gap-5 xl:grid-cols-2">
          <section className="panel rounded-[20px] p-5 sm:p-6" id="groups"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-extrabold tracking-tight">Your groups</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Your communities, all in one place.</p></div><Link href="/groups" className="text-xs font-bold text-[var(--lime-deep)]">View all</Link></div><div className="divide-y divide-[var(--line)]">{loadingDashboard ? Array.from({ length: 2 }).map((_, index) => <div key={index} className="flex items-center gap-3 py-4 first:pt-0"><div className="skeleton h-11 w-11 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-3.5 w-2/3 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div></div>) : groupList.length === 0 ? <p className="py-6 text-sm text-[var(--ink-soft)]">No groups yet. Join or create one to see it here.</p> : groupList.map((group) => <Link key={group.id} href={`/groups/${group.id}`} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-black text-[#0f1712] ${group.color === "lime" ? "bg-[var(--lime)]" : group.color === "blue" ? "bg-[var(--blue)]" : "bg-[var(--coral)]"}`}>{group.mark}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{group.name}</p><p className="mt-1 truncate text-xs text-[var(--ink-soft)]">{group.members} members · {group.next}</p></div><ChevronRight size={17} className="text-[var(--ink-soft)]" /></Link>)}</div></section>
          <section className="panel rounded-[20px] p-5 sm:p-6" id="my-round-robins">
            <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-extrabold tracking-tight">Your round robins</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Round robins you&apos;re organizing or playing in.</p></div><Link href="/round-robin" className="text-xs font-bold text-[var(--lime-deep)]">View all</Link></div>
            <div className="divide-y divide-[var(--line)]">
              {loadingDashboard ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="flex items-center gap-3 py-3 first:pt-0"><div className="skeleton h-10 w-10 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-3.5 w-2/3 rounded" /><div className="skeleton h-3 w-1/3 rounded" /></div></div>) : myRoundRobins.length === 0 ? <p className="py-6 text-sm text-[var(--ink-soft)]">No round robins yet. <Link href="/round-robin" className="font-bold text-[var(--lime-deep)]">Build one</Link> to get started.</p> : myRoundRobins.map((roundRobin) => (
                <div key={roundRobin.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Link href={`/round-robin/${roundRobin.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1c2a1a] text-[var(--lime-deep)]"><Repeat size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{roundRobin.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">{roundRobin.groupName ? `${roundRobin.groupName} · ` : ""}{roundRobin.scheduledAt ? new Date(roundRobin.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : (pendingPartnerFormatLabels[roundRobin.partnerFormat] ?? roundRobin.partnerFormat)}</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {roundRobin.isOrganizer && <span className="rounded-full bg-[#1c2a1a] px-2 py-1 text-[10px] font-bold text-[var(--ink-soft)]">Organizing</span>}
                    {roundRobin.status === "SETUP" ? (
                      <>
                        <button onClick={() => respondMyRoundRobin(roundRobin.id, "JOINED")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${roundRobin.myRsvpStatus === "JOINED" ? "bg-[var(--lime)] text-[#0f1712]" : "border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]"}`}>{roundRobin.myRsvpStatus === "JOINED" ? "You're in" : "Join"}</button>
                        <button onClick={() => respondMyRoundRobin(roundRobin.id, "DECLINED")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${roundRobin.myRsvpStatus === "DECLINED" ? "bg-[var(--coral)] text-[#2e1a16]" : "border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]"}`}>Decline</button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full bg-[#1e2b17] px-2.5 py-1 text-[10px] font-bold text-[#c7e572]"><LivePulse color="#c7e572" size={6} />Live</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="panel mt-5 overflow-x-auto rounded-[20px] p-5 sm:p-6" id="leaderboard">
          <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-extrabold tracking-tight">Community leaderboard</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Ranked by win % and point differential across every recorded match.</p></div></div>
          {loadingLeaderboard ? (
            <div className="space-y-3 py-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-10 rounded-xl" />)}</div>
          ) : leaderboardList.length === 0 ? <p className="py-6 text-sm text-[var(--ink-soft)]">Play a match to appear on the leaderboard.</p> : (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead><tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><th className="pb-3">#</th><th className="pb-3">Player</th><th className="pb-3 text-center">W</th><th className="pb-3 text-center">L</th><th className="pb-3 text-center">Win%</th><th className="pb-3 text-center">Points earned</th><th className="pb-3 text-center">Points against</th><th className="pb-3 text-right">Avg pt diff</th></tr></thead>
              <tbody>
                {leaderboardList.map((player) => (
                  <tr key={player.name} className={`border-b border-[var(--line)] last:border-0 ${player.name === profileSummary.name ? "bg-[#1e2b17]" : ""}`}>
                    <td className="py-3 font-bold text-[var(--ink-soft)]">{player.rank}</td>
                    <td className="py-3"><span className="flex items-center gap-2 font-bold"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#22331f] text-[10px] font-black text-[var(--lime)]">{player.initials}</span>{player.name}</span></td>
                    <td className="py-3 text-center font-semibold">{player.wins}</td>
                    <td className="py-3 text-center font-semibold">{player.losses}</td>
                    <td className="py-3 text-center font-semibold">{player.winPct}%</td>
                    <td className="py-3 text-center font-semibold">{player.scored}</td>
                    <td className="py-3 text-center font-semibold">{player.conceded}</td>
                    <td className={`py-3 text-right font-semibold ${player.avgPointDiff > 0 ? "text-[var(--lime-deep)]" : player.avgPointDiff < 0 ? "text-[#e8836a]" : "text-[var(--ink-soft)]"}`}>{player.avgPointDiff > 0 ? "+" : ""}{player.avgPointDiff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel mt-5 rounded-[20px] p-5 sm:p-6"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-extrabold tracking-tight">Recent results</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Your last three matches</p></div><a href="#history" className="text-xs font-bold text-[var(--lime-deep)]">Match history</a></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><th className="pb-3">Match</th><th className="pb-3">Event</th><th className="pb-3">Score</th><th className="pb-3">Result</th><th className="pb-3 text-right">Rating change</th></tr></thead><tbody>{loadingMatches ? <tr><td colSpan={5} className="py-4"><div className="skeleton h-8 rounded-xl" /></td></tr> : recentResultsList.length === 0 ? <tr><td colSpan={5} className="py-6 text-sm text-[var(--ink-soft)]">No matches recorded yet.</td></tr> : null}{recentResultsList.map((result) => <tr key={`${result.opponent}-${result.date}`} className="border-b border-[var(--line)] last:border-0"><td className="py-4 font-bold">{result.opponent}<span className="ml-2 text-xs font-normal text-[var(--ink-soft)]">{result.date}</span></td><td className="py-4 text-[var(--ink-soft)]">{result.event}</td><td className={`py-4 font-semibold ${result.result === "W" ? "text-[var(--lime-deep)]" : result.result === "L" ? "text-[var(--coral)]" : ""}`}>{result.score}</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${result.result === "W" ? "bg-[var(--lime)] text-[#0f1712]" : result.result === "L" ? "bg-[var(--coral)] text-[#2e1a16]" : "bg-[#1c2a1a] text-[var(--ink-soft)]"}`}>{result.result}</span></td><td className={`py-4 text-right font-bold ${result.points.startsWith("+") ? "text-[var(--lime-deep)]" : result.points.startsWith("-") ? "text-[#e8836a]" : "text-[var(--ink-soft)]"}`}>{result.points || "—"}</td></tr>)}</tbody></table></div></section>
      </div>
    </main>
  </div>;
}

export default function Home() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { const supabase = createClient(); const code = new URLSearchParams(window.location.search).get("code"); if (code) { supabase.auth.exchangeCodeForSession(code).then(({ error }) => { if (!error) router.replace("/dashboard"); }); } supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user))); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session))); return () => listener.subscription.unsubscribe(); }, [router]);
  return <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] noise">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10"><Logo /><div className="hidden items-center gap-7 text-sm font-semibold text-[var(--ink-soft)] md:flex"><a href="#how-it-works" className="hover:text-[var(--foreground)]">How it works</a><a href="#play" className="hover:text-[var(--foreground)]">Find your game</a><a href="#pack" className="hover:text-[var(--foreground)]">For groups</a></div><div className="flex items-center gap-2">{!signedIn && <a href="/login" className="hidden rounded-full px-4 py-2 text-sm font-bold text-[var(--ink-soft)] sm:block">Sign in</a>}<a href="/dashboard" className="rounded-full bg-[var(--lime)] px-4 py-2.5 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">{signedIn ? "Go to dashboard" : "Open dashboard"}</a></div></nav>
    <section className="court-texture relative mx-auto grid max-w-7xl gap-10 overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-10 lg:pb-28"><div className="fade-up"><p className="mb-5 inline-flex rounded-full bg-[#1e2b17] px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-[#c7e572]">Your court. Your pack. Your game.</p><h1 className="max-w-3xl text-5xl font-black leading-[.94] tracking-[-.07em] sm:text-7xl lg:text-[92px]">Play sharper.<br /><span className="text-[var(--lime)]">Stay wilder.</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">PickleballWolves brings your games, groups, scores, and progress into one place built for the moments between the first serve and the last point.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href="/signup" className="flex min-h-12 items-center justify-center rounded-full bg-[var(--lime)] px-6 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">Find your pack <ArrowRight size={16} className="ml-2" /></a><a href="#how-it-works" className="flex min-h-12 items-center justify-center rounded-full border border-[var(--line)] px-6 text-sm font-bold">See how it works</a></div><div className="mt-10 flex items-center gap-5 text-xs font-semibold text-[var(--ink-soft)]"><span><strong className="text-2xl font-black text-[var(--foreground)]">20+</strong><br />players ready</span><span className="h-9 w-px bg-[var(--line)]" /><span><strong className="text-2xl font-black text-[var(--foreground)]">2</strong><br />local groups</span><span className="h-9 w-px bg-[var(--line)]" /><span><strong className="text-2xl font-black text-[var(--foreground)]">∞</strong><br />games to play</span></div></div><div className="relative min-h-[420px] lg:min-h-[560px]"><div className="absolute inset-0 rounded-[36px] bg-[#1b211e]" /><div className="absolute -right-4 -top-4 h-24 w-24 rounded-full border-[18px] border-[#d8f24e] opacity-90" /><PaddleIcon className="animate-float absolute -right-2 top-20 h-14 w-14 drop-shadow-[0_8px_16px_rgba(0,0,0,.35)] sm:-right-6 sm:h-20 sm:w-20" /><PickleballIcon className="animate-bob absolute -left-3 bottom-24 h-8 w-8 drop-shadow-[0_6px_12px_rgba(0,0,0,.35)] sm:-left-6 sm:h-12 sm:w-12" /><div className="absolute bottom-8 left-8 right-8 top-8 rounded-[28px] border border-white/15 p-5 sm:p-8"><div className="flex items-start justify-between text-white"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a9b6a9]">Saturday social</p><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Northside Wolves</h2></div><span className="rounded-full bg-[#d8f24e] px-3 py-1.5 text-xs font-black text-[#1b211e]">8:00 AM</span></div><div className="mt-12 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-[#a9b6a9]">Players in</p><p className="mt-2 text-3xl font-black">13<span className="text-base text-[#a9b6a9]"> / 16</span></p></div><div className="rounded-2xl bg-[#d8f24e] p-4 text-[#1b211e]"><p className="text-xs font-bold text-[#5f771d]">Skill range</p><p className="mt-2 text-3xl font-black">3.0<span className="text-base"> - 4.5</span></p></div></div><div className="mt-4 rounded-2xl bg-white p-4 text-[#1b211e]"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Court 3 · Rotating partners</p><span className="flex items-center gap-1.5 text-xs font-bold text-[#6b8f21]"><LivePulse color="#6b8f21" size={7} />Live</span></div><div className="mt-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#c8d6b8] text-[10px] font-black">MC</span><span className="grid h-9 w-9 place-items-center rounded-full bg-[#f17e62] text-[10px] font-black">JP</span><span className="mx-1 text-xs font-bold text-[#98a49a]">vs</span><span className="grid h-9 w-9 place-items-center rounded-full bg-[#8cc9df] text-[10px] font-black">ER</span><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e5d08b] text-[10px] font-black">PD</span></div></div></div></div></section>
    <section id="how-it-works" className="court-texture border-y border-[var(--line)] bg-[var(--panel)]"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:px-10"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime-deep)]">Built for the whole rhythm</p><h2 className="mt-3 max-w-md text-4xl font-black leading-none tracking-[-.06em]">From “who’s playing?” to “great game.”</h2></div><div className="grid gap-px overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3"><div className="bg-[#131f19] p-6"><span className="text-4xl font-black text-[var(--lime-deep)]">01</span><h3 className="mt-10 font-extrabold">Find your people</h3><p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Join public groups or create a private court community that plays on your schedule.</p></div><div className="bg-[#131f19] p-6"><span className="text-4xl font-black text-[#f17e62]">02</span><h3 className="mt-10 font-extrabold">Show up ready</h3><p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">See the format, skill range, courts, and open spots before you leave home.</p></div><div className="bg-[#131f19] p-6"><span className="text-4xl font-black text-[#8cc9df]">03</span><h3 className="mt-10 font-extrabold">Track the story</h3><p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Scores become history, ratings, rankings, and better games next time.</p></div></div></div></section>
    <section id="play" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime-deep)]">Everything on court</p><h2 className="mt-3 text-4xl font-black leading-none tracking-[-.06em] sm:text-5xl">A better game starts before the serve.</h2><p className="mt-6 text-base leading-7 text-[var(--ink-soft)]">No more scattered group chats, mystery scorekeeping, or wondering where you stand. PickleballWolves keeps every detail close enough to act on.</p><a href="/events" className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[var(--lime-deep)]">Browse open games <ArrowRight size={16} /></a></div><div className="grid gap-4 sm:grid-cols-2"><article className="rounded-[24px] bg-[#1b211e] p-6 text-white sm:translate-y-8"><CalendarDays className="text-[#d8f24e]" size={25} /><h3 className="mt-12 text-xl font-extrabold">Open play, organized</h3><p className="mt-3 text-sm leading-6 text-[#a9b6a9]">Create games with courts, caps, skill ranges, formats, and waitlists built in.</p></article><article className="rounded-[24px] bg-[#d8f24e] p-6"><Trophy className="text-[#1b211e]" size={25} /><h3 className="mt-12 text-xl font-extrabold">Progress you can feel</h3><p className="mt-3 text-sm leading-6 text-[#53631e]">Ratings, ladders, match history, and leaderboards make every point count.</p></article><article className="rounded-[24px] bg-[#8cc9df] p-6"><Users className="text-[#1b211e]" size={25} /><h3 className="mt-12 text-xl font-extrabold">Find your pack</h3><p className="mt-3 text-sm leading-6 text-[#365a68]">Make a home court community or discover the next group worth joining.</p></article><article className="rounded-[24px] bg-[#f17e62] p-6"><Activity className="text-[#1b211e]" size={25} /><h3 className="mt-12 text-xl font-extrabold">Scores that stay</h3><p className="mt-3 text-sm leading-6 text-[#703b2e]">Record matches once and build a permanent, searchable playing history.</p></article></div></div></section>
    <section id="pack" className="bg-[var(--panel)]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center lg:px-10 lg:py-24"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime-deep)]">For organizers and players</p><h2 className="mt-3 max-w-2xl text-4xl font-black leading-none tracking-[-.06em] sm:text-6xl">Run the court.<br />Keep the pack moving.</h2></div><div className="rounded-[24px] bg-[var(--background)] p-6 sm:p-8"><p className="text-sm leading-6 text-[var(--ink-soft)]">Start with one game. Grow into a group, a league, a ladder, or a whole season of better play.</p><a href="/dashboard" className="mt-7 flex min-h-12 items-center justify-center rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">Go to dashboard <ArrowRight size={16} className="ml-2" /></a></div></div></section>
    <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><Logo /><div className="flex gap-5 text-xs font-bold text-[var(--ink-soft)]"><Link href="/groups">Groups</Link><Link href="/events">Games</Link><Link href="/login">Sign in</Link></div><p className="text-xs text-[#5c6e60]">© 2026 PickleballWolves</p></footer>
  </main>;
}
