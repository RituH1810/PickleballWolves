"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";

type Result = { id: string; name: string; skillRating: number; homeCourt: string | null };

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 6;

/**
 * Find anyone on PickleballWolves who isn't already in the list (e.g. not in the group) and add
 * them -- used to bring an outside player into a single group game.
 */
export function OutsidePlayerSearch({ excludeIds, onAdd, addingId }: { excludeIds: Set<string>; onAdd: (playerId: string) => void; addingId: string | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; players: Result[] } | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      fetch(`/api/players/search?q=${encodeURIComponent(q)}`).then((response) => response.ok ? response.json() : null).then((data) => setResults({ q, players: data?.players ?? [] }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const q = query.trim();
  const matches = q.length >= 2 && results?.q === q ? results.players.filter((player) => !excludeIds.has(player.id)).slice(0, MAX_RESULTS) : [];
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Add someone from outside the group</p>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">They join this game only -- not the group -- and can see it, chat, and be scored.</p>
      <div className="relative mt-2">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search any player by name" aria-label="Search players outside the group" className="h-10 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] pl-9 pr-3 text-sm outline-none focus:border-[var(--lime-deep)]" />
      </div>
      {q.length >= 2 && results?.q === q && matches.length === 0 && <p className="mt-2 text-xs text-[var(--ink-soft)]">No one else by that name -- they may already be in the group or this game, or need to sign up first.</p>}
      {matches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {matches.map((player) => (
            <button key={player.id} onClick={() => onAdd(player.id)} disabled={addingId === player.id} title={player.homeCourt ?? undefined} className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--lime-deep)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[#1e2b17] disabled:opacity-50">
              <UserPlus size={13} className="text-[var(--lime-deep)]" />{addingId === player.id ? "Adding..." : player.name}<span className="text-[10px] font-semibold text-[var(--ink-soft)]">{player.skillRating.toFixed(1)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
