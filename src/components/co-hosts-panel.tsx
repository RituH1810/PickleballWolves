"use client";

import { useState } from "react";
import { UserCog, X } from "lucide-react";

type Person = { id: string; name: string };

/**
 * A round robin's co-hosts: people the organizer trusts to run the game (players, rounds, scores,
 * ending it) when they can't. Only the organizer or a group organizer can change the list.
 */
export function CoHostsPanel({ roundRobinId, coHosts, candidates, canManage, onChange, onError }: { roundRobinId: string; coHosts: Person[]; candidates: Person[]; canManage: boolean; onChange: () => Promise<void> | void; onError: (message: string) => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picking, setPicking] = useState("");

  async function change(userId: string, add: boolean) {
    setBusyId(userId);
    const response = add
      ? await fetch(`/api/round-robin/${roundRobinId}/co-hosts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
      : await fetch(`/api/round-robin/${roundRobinId}/co-hosts?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    setBusyId(null);
    if (!response.ok) { onError(data?.error ?? "Unable to update co-hosts."); return; }
    setPicking("");
    await onChange();
  }

  const available = candidates.filter((person) => !coHosts.some((coHost) => coHost.id === person.id));
  if (!canManage && coHosts.length === 0) return null;
  return (
    <div className="mt-4 border-t border-[var(--line)] pt-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><UserCog size={13} />Co-hosts</p>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">Co-hosts can add players, run rounds, enter scores, and end the round robin -- handy when you can&apos;t be there.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {coHosts.length === 0 && <span className="text-sm text-[var(--ink-soft)]">No co-hosts yet.</span>}
        {coHosts.map((coHost) => (
          <span key={coHost.id} className={`flex items-center gap-1 rounded-full bg-[#1c2a1a] py-1.5 text-xs font-bold text-[var(--foreground)] ${canManage ? "pl-3 pr-1.5" : "px-3"} ${busyId === coHost.id ? "opacity-50" : ""}`}>
            {coHost.name}
            {canManage && <button type="button" onClick={() => change(coHost.id, false)} disabled={busyId !== null} aria-label={`Remove ${coHost.name} as co-host`} title={`Remove ${coHost.name} as co-host`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[var(--coral)] hover:text-[#2e1a16]"><X size={12} /></button>}
          </span>
        ))}
        {canManage && available.length > 0 && (
          <select value={picking} onChange={(event) => { setPicking(event.target.value); if (event.target.value) change(event.target.value, true); }} disabled={busyId !== null} aria-label="Add a co-host" className="h-8 rounded-full border border-[var(--line)] bg-[#0f1712] px-3 text-xs font-bold text-[var(--foreground)]">
            <option value="">+ Add co-host</option>
            {available.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
