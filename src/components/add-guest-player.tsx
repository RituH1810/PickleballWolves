"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { GUEST_NAME_MAX, GUEST_RATING_DEFAULT, GUEST_RATING_MAX, GUEST_RATING_MIN } from "@/lib/guest-players";

type Guest = { id: string; name: string; skillRating: number };

/**
 * Organizer-only: add someone who isn't on PickleballWolves, by name and skill rating. Guests the
 * organizer has brought before are offered first so a regular keeps one history and rating.
 */
export function AddGuestPlayer({ roundRobinId, joinedIds, onAdded, onError }: { roundRobinId: string; joinedIds: Set<string>; onAdded: () => Promise<void> | void; onError: (message: string) => void }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(GUEST_RATING_DEFAULT.toFixed(1));
  const [saving, setSaving] = useState<string | null>(null);
  const [pastGuests, setPastGuests] = useState<Guest[]>([]);

  useEffect(() => {
    fetch(`/api/round-robin/${roundRobinId}/guests`).then((response) => response.ok ? response.json() : null).then((data) => setPastGuests(data?.guests ?? []));
  }, [roundRobinId]);

  async function add(body: { guestId: string } | { name: string; skillRating: number }, key: string) {
    setSaving(key);
    const response = await fetch(`/api/round-robin/${roundRobinId}/guests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    setSaving(null);
    if (!response.ok) { onError(data?.error ?? "Unable to add this guest."); return; }
    if ("name" in body) {
      setName("");
      setPastGuests((guests) => [...guests, { id: data.guestId, name: body.name, skillRating: body.skillRating }].sort((a, b) => a.name.localeCompare(b.name)));
    }
    await onAdded();
  }

  const reAddable = pastGuests.filter((guest) => !joinedIds.has(guest.id));
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Add a guest</p>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">Playing with someone who isn&apos;t on PickleballWolves? Add them by name -- their games count, but they won&apos;t be notified or listed.</p>
      {reAddable.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {reAddable.map((guest) => (
            <button key={guest.id} type="button" onClick={() => add({ guestId: guest.id }, guest.id)} disabled={saving !== null} className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] transition-colors hover:border-[var(--lime-deep)] hover:bg-[#1c2a1a] disabled:opacity-60">
              {saving === guest.id ? "Adding..." : `+ ${guest.name}`}<span className="text-[10px] font-semibold text-[var(--ink-soft)]">{guest.skillRating.toFixed(1)}</span>
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(event) => { event.preventDefault(); add({ name: name.trim(), skillRating: Number(rating) }, "new"); }} className="mt-2 flex flex-wrap gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={GUEST_NAME_MAX} placeholder="Guest's name" aria-label="Guest's name" className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm" />
        <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-xs font-bold text-[var(--ink-soft)]">
          Rating
          <input type="number" value={rating} onChange={(event) => setRating(event.target.value)} min={GUEST_RATING_MIN} max={GUEST_RATING_MAX} step={0.1} aria-label="Guest's skill rating" className="w-14 bg-transparent text-sm text-[var(--foreground)] outline-none" />
        </label>
        <button type="submit" disabled={!name.trim() || saving !== null} className="flex h-10 items-center gap-1.5 rounded-full bg-[var(--lime)] px-4 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-50"><UserPlus size={14} />{saving === "new" ? "Adding..." : "Add guest"}</button>
      </form>
    </div>
  );
}
