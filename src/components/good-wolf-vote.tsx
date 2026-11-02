"use client";

import { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { GOOD_WOLF_MIN_VOTES } from "@/lib/good-wolf";

type Person = { id: string; name: string; photoUrl: string | null };
type GoodWolf = { open: boolean; closesAt: string; totalVotes: number; canVote: boolean; candidates: Person[]; myVote: string | null; winners: (Person & { votes: number })[] };

const closing = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The anonymous Good Wolf (sportsmanship) vote under an ended round robin, then its result. */
export function GoodWolfVote({ roundRobinId }: { roundRobinId: string }) {
  const [state, setState] = useState<GoodWolf | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/round-robin/${roundRobinId}/good-wolf`).then((response) => response.ok ? response.json() : null).then((data) => setState(data?.goodWolf ?? null));
  }, [roundRobinId]);

  if (!state) return null;

  async function vote(nomineeId: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/round-robin/${roundRobinId}/good-wolf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nomineeId }) });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.goodWolf) setState(data.goodWolf); else setError(data?.error ?? "Unable to save your vote.");
    setBusy(false);
  }

  const header = <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[var(--lime-deep)]"><PawPrint size={15} />Good Wolf{state.open && " vote · anonymous"}</p>;
  if (!state.open) {
    if (!state.winners.length) return (
      <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
        {header}
        <p className="mt-2 text-xs text-[var(--ink-soft)]">No Good Wolf this time -- it takes at least {GOOD_WOLF_MIN_VOTES} votes for the same player.</p>
      </section>
    );
    return (
      <section className="mt-5 rounded-[20px] border border-[var(--lime-deep)] bg-[var(--panel)] p-5">
        {header}
        <div className="mt-3 flex flex-wrap gap-4">
          {state.winners.map((winner) => (
            <div key={winner.id} className="flex items-center gap-3">
              <Avatar name={winner.name} photoUrl={winner.photoUrl} className="h-11 w-11 rounded-full bg-[#22331f] text-sm font-black text-[var(--lime)]" />
              <div><p className="text-lg font-black">{winner.name}</p><p className="text-xs text-[var(--ink-soft)]">{winner.votes} votes for best sportsmanship</p></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
      {header}
      {state.canVote ? (
        <>
          <p className="mt-2 text-sm font-bold">Who showed the best sportsmanship tonight?</p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">Fair line calls, good attitude, helping others. Nobody sees who you picked -- only the winner is shown, after voting closes {closing(state.closesAt)}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.candidates.map((person) => (
              <button key={person.id} onClick={() => vote(person.id)} disabled={busy} aria-pressed={state.myVote === person.id} className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-bold transition-colors disabled:cursor-wait ${state.myVote === person.id ? "border-[var(--lime)] bg-[var(--lime)] text-[#0f1712]" : "border-[var(--line)] hover:bg-[#1c2a1a]"}`}>
                <Avatar name={person.name} photoUrl={person.photoUrl} className="h-6 w-6 rounded-full bg-[#22331f] text-[9px] font-black text-[var(--lime)]" />{person.name}
              </button>
            ))}
          </div>
          {state.myVote && <p className="mt-3 text-[11px] font-semibold text-[var(--lime-deep)]">Vote saved -- you can change it until voting closes.</p>}
        </>
      ) : (
        <p className="mt-2 text-xs text-[var(--ink-soft)]">Players are voting for the night&apos;s Good Wolf. The winner is shown after {closing(state.closesAt)} · {state.totalVotes} vote{state.totalVotes === 1 ? "" : "s"} so far.</p>
      )}
      {error && <p className="mt-2 text-xs font-bold text-[var(--coral)]">{error}</p>}
    </section>
  );
}
