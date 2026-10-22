"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, PawPrint, Search, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useViewer } from "@/components/guest-shell";

type PlayerResult = { id: string; name: string; photoUrl: string | null; homeCourt: string | null; skillRating: number; matches: number; rank: number | null; isMe: boolean };
type Filters = { q: string; court: string; minRating: string; maxRating: string; groupId: string; sort: string };

const EMPTY_FILTERS: Filters = { q: "", court: "", minRating: "", maxRating: "", groupId: "", sort: "name" };
const RATING_STEPS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0"];
// Typing in the name/court boxes waits this long before searching.
const DEBOUNCE_MS = 250;

export default function PlayersPage() {
  const { signedIn } = useViewer();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [results, setResults] = useState<{ players: PlayerResult[]; total: number; key: string } | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/players/search?${query}`).then((response) => response.ok ? response.json() : null).then((data) => {
        if (!data) return;
        setResults({ players: data.players, total: data.total, key: query });
        setGroups(data.groups);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const set = (key: keyof Filters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const filtered = Object.entries(filters).some(([key, value]) => key !== "sort" && value);
  const searching = results?.key !== query;
  const fieldClass = "h-11 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm outline-none focus:border-[var(--lime-deep)]";

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to dashboard</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">PickleballWolves</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">Find players.</h1>
        <p className="mt-3 text-sm text-[var(--ink-soft)]">Look up a partner, scout an opponent, or find someone at your level.</p>

        <section className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            <input value={filters.q} onChange={set("q")} placeholder="Search by name" aria-label="Search by name" autoFocus className="h-12 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] pl-11 pr-4 text-sm outline-none focus:border-[var(--lime-deep)]" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {signedIn && <input value={filters.court} onChange={set("court")} placeholder="Home court" aria-label="Home court" className={fieldClass} />}
            <select value={filters.minRating} onChange={set("minRating")} aria-label="Minimum rating" className={fieldClass}><option value="">Min rating</option>{RATING_STEPS.map((step) => <option key={step} value={step}>{step}+</option>)}</select>
            <select value={filters.maxRating} onChange={set("maxRating")} aria-label="Maximum rating" className={fieldClass}><option value="">Max rating</option>{RATING_STEPS.map((step) => <option key={step} value={step}>Up to {step}</option>)}</select>
            <select value={filters.groupId} onChange={set("groupId")} aria-label="Group" className={fieldClass}><option value="">All groups</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
            <select value={filters.sort} onChange={set("sort")} aria-label="Sort by" className={fieldClass}><option value="name">Sort: Name</option><option value="rating">Sort: Rating</option><option value="matches">Sort: Most matches</option></select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[var(--ink-soft)]">
            <span aria-live="polite">{results ? (results.total > results.players.length ? `Showing ${results.players.length} of ${results.total} players` : `${results.total} player${results.total === 1 ? "" : "s"}`) : "Loading players..."}</span>
            {filtered && <button onClick={() => setFilters(EMPTY_FILTERS)} className="flex items-center gap-1 font-bold text-[var(--lime-deep)]"><X size={13} />Clear filters</button>}
          </div>
        </section>

        <section className={`mt-5 transition-opacity ${searching && results ? "opacity-60" : ""}`}>
          {!results ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-24 rounded-[20px]" />)}</div>
          ) : results.players.length === 0 ? (
            <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] py-12 text-center"><PawPrint size={22} className="mx-auto text-[var(--lime-deep)]" /><p className="mt-3 text-sm text-[var(--ink-soft)]">No players match those filters.</p></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.players.map((player) => (
                <Link key={player.id} href={`/players/${player.id}`} className="flex items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4 transition-colors hover:border-[var(--lime-deep)] hover:bg-[#1c2a1a]">
                  <Avatar name={player.name} photoUrl={player.photoUrl} className="h-12 w-12 shrink-0 rounded-full bg-[#22331f] text-sm font-black text-[var(--lime)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-[var(--foreground)]">{player.name}{player.isMe && <span className="ml-1.5 text-[10px] font-bold text-[var(--ink-soft)]">(you)</span>}</p>
                    {signedIn && <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--ink-soft)]"><MapPin size={12} className="shrink-0" />{player.homeCourt || "No home court"}</p>}
                    <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{player.matches} match{player.matches === 1 ? "" : "es"}{player.rank && <> · <span className="font-bold text-[var(--lime-deep)]">#{player.rank}</span></>}</p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-[#131f19] px-2.5 py-1.5 text-center"><span className="block text-base font-black leading-none">{player.skillRating.toFixed(1)}</span><span className="text-[9px] font-bold uppercase tracking-[.1em] text-[var(--ink-soft)]">rating</span></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
