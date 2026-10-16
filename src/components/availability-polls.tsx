"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronRight, Plus, Vote, X } from "lucide-react";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/lib/poll-limits";

type PollOption = { id: string; startsAt: string; votes: number; voters: string[]; mine: boolean; leading: boolean };
type Poll = { id: string; question: string; status: "OPEN" | "SCHEDULED" | "CLOSED"; createdByName: string; scheduledRoundRobinId: string | null; voterCount: number; options: PollOption[] };

const playFormatLabels: Record<string, string> = { DOUBLES: "Doubles", SINGLES: "Singles", MIXED: "Mixed doubles" };
const partnerFormatLabels: Record<string, string> = { MANUAL: "Dink Draft", ROTATE: "Rotating partners", FIXED: "Fixed partners" };

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "Who can play Sat morning or Sun evening?" -- organizers ask, members tap what works, the winner becomes a game. */
export function AvailabilityPolls({ groupId, onScheduled }: { groupId: string; onScheduled?: () => void }) {
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [composing, setComposing] = useState(false);
  const [question, setQuestion] = useState("");
  const [times, setTimes] = useState<string[]>(["", ""]);
  const [scheduling, setScheduling] = useState<{ pollId: string; optionId: string; playFormat: string; partnerFormat: string; courtCount: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function load() {
    const response = await fetch(`/api/groups/${groupId}/polls`);
    const data = response.ok ? await response.json() : null;
    if (!data) return;
    setPolls(data.polls);
    setCanCreate(data.canCreate);
  }

  useEffect(() => {
    fetch(`/api/groups/${groupId}/polls`).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data) return;
      setPolls(data.polls);
      setCanCreate(data.canCreate);
    });
  }, [groupId]);

  function replacePoll(poll: Poll) {
    setPolls((current) => current?.map((entry) => (entry.id === poll.id ? poll : entry)) ?? null);
  }

  async function create() {
    setBusy(true);
    setMessage(null);
    const options = times.filter(Boolean).map((value) => new Date(value).toISOString());
    const response = await fetch(`/api/groups/${groupId}/polls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, options, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setMessage({ text: data?.error ?? "Couldn't create the poll.", error: true }); return; }
    setPolls((current) => [data.poll, ...(current ?? [])]);
    setComposing(false);
    setQuestion("");
    setTimes(["", ""]);
    setMessage({ text: "Poll sent -- every member was notified.", error: false });
  }

  // Each tap saves the full set of picks, so there's no separate "submit" step.
  async function toggle(poll: Poll, option: PollOption) {
    const picks = poll.options.filter((entry) => (entry.id === option.id ? !entry.mine : entry.mine)).map((entry) => entry.id);
    replacePoll({ ...poll, options: poll.options.map((entry) => (entry.id === option.id ? { ...entry, mine: !entry.mine } : entry)) });
    const response = await fetch(`/api/groups/${groupId}/polls/${poll.id}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionIds: picks }) });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.poll) replacePoll(data.poll);
    else { setMessage({ text: data?.error ?? "Couldn't save your pick.", error: true }); await load(); }
  }

  async function schedule() {
    if (!scheduling) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/groups/${groupId}/polls/${scheduling.pollId}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: scheduling.optionId, playFormat: scheduling.playFormat, partnerFormat: scheduling.partnerFormat, courtCount: Number(scheduling.courtCount) }) });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setMessage({ text: data?.error ?? "Couldn't schedule the game.", error: true }); return; }
    setScheduling(null);
    setMessage({ text: `Game scheduled -- ${data.joined} player${data.joined === 1 ? "" : "s"} who said yes ${data.joined === 1 ? "is" : "are"} already in, and the rest of the group was invited.`, error: false });
    await load();
    onScheduled?.();
  }

  async function close(poll: Poll) {
    if (!window.confirm("Close this poll without scheduling a game?")) return;
    const response = await fetch(`/api/groups/${groupId}/polls/${poll.id}`, { method: "DELETE" });
    if (response.ok) await load();
  }

  if (!polls || (!canCreate && polls.length === 0)) return null;
  const field = "h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--lime-deep)]";

  return (
    <section id="polls" className="mt-5 scroll-mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Vote size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Availability</h2></div>
        {canCreate && !composing && <button onClick={() => { setComposing(true); setMessage(null); }} className="flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]"><Plus size={14} />Ask availability</button>}
      </div>

      {composing && (
        <div className="mt-4 space-y-3 rounded-2xl border border-[var(--line)] bg-[#131f19] p-4">
          <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={120} placeholder="When can you play this weekend?" aria-label="Question" className={field} />
          {times.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <input type="datetime-local" value={value} onChange={(event) => setTimes((current) => current.map((entry, position) => (position === index ? event.target.value : entry)))} aria-label={`Option ${index + 1}`} className={field} />
              {times.length > POLL_MIN_OPTIONS && <button onClick={() => setTimes((current) => current.filter((_, position) => position !== index))} aria-label={`Remove option ${index + 1}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[#1c2a1a] hover:text-[var(--coral)]"><X size={15} /></button>}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {times.length < POLL_MAX_OPTIONS ? <button onClick={() => setTimes((current) => [...current, ""])} className="text-xs font-bold text-[var(--lime-deep)]">+ Add a time</button> : <span />}
            <div className="flex gap-2">
              <button onClick={() => setComposing(false)} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold">Cancel</button>
              <button onClick={create} disabled={busy || times.filter(Boolean).length < POLL_MIN_OPTIONS} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Sending..." : "Send poll"}</button>
            </div>
          </div>
          <p className="text-[11px] text-[var(--ink-soft)]">Every member gets a notification. Pick {POLL_MIN_OPTIONS}-{POLL_MAX_OPTIONS} times.</p>
        </div>
      )}

      {message && <p role={message.error ? "alert" : "status"} className={`mt-3 text-xs font-bold ${message.error ? "text-[var(--coral)]" : "text-[var(--lime-deep)]"}`}>{message.text}</p>}

      {polls.length === 0 && !composing && <p className="mt-4 text-sm text-[var(--ink-soft)]">Not sure when people can play? Ask the group before you schedule.</p>}
      <div className="mt-4 space-y-4">
        {polls.map((poll) => (
          <article key={poll.id} className={`rounded-2xl border border-[var(--line)] p-4 ${poll.status === "OPEN" ? "" : "opacity-75"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold">{poll.question}</h3>
                <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">Asked by {poll.createdByName} · {poll.voterCount} {poll.voterCount === 1 ? "person has" : "people have"} answered{poll.status === "OPEN" ? " · tap every time you can make" : ""}</p>
              </div>
              {poll.status === "SCHEDULED" && poll.scheduledRoundRobinId && <Link href={`/round-robin/${poll.scheduledRoundRobinId}`} className="flex items-center gap-1 rounded-full bg-[#1e2b17] px-3 py-1.5 text-[11px] font-bold text-[#c7e572]">Scheduled<ChevronRight size={13} /></Link>}
              {poll.status === "CLOSED" && <span className="rounded-full bg-[#1c2a1a] px-3 py-1.5 text-[11px] font-bold text-[var(--ink-soft)]">Closed</span>}
            </div>
            <div className="mt-3 space-y-2">
              {poll.options.map((option) => {
                const share = poll.voterCount ? option.votes / poll.voterCount : 0;
                return (
                  <div key={option.id}>
                    <button onClick={() => toggle(poll, option)} disabled={poll.status !== "OPEN"} aria-pressed={option.mine} className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-default ${option.mine ? "border-[var(--lime-deep)]" : "border-[var(--line)] hover:bg-[#1c2a1a]"}`}>
                      <span className="absolute inset-y-0 left-0 bg-[#1e2b17]" style={{ width: `${Math.round(share * 100)}%` }} aria-hidden />
                      <span className={`relative grid h-5 w-5 shrink-0 place-items-center rounded-md border ${option.mine ? "border-[var(--lime)] bg-[var(--lime)] text-[#0f1712]" : "border-[var(--line)]"}`}>{option.mine && <Check size={13} />}</span>
                      <span className="relative min-w-0 flex-1">
                        <span className="block text-sm font-bold">{when(option.startsAt)}{option.leading && poll.status === "OPEN" && <span className="ml-2 rounded-full bg-[var(--lime)] px-2 py-0.5 text-[9px] font-black uppercase text-[#0f1712]">Most popular</span>}</span>
                        {option.voters.length > 0 && <span className="block truncate text-[11px] text-[var(--ink-soft)]">{option.voters.join(", ")}</span>}
                      </span>
                      <span className="relative shrink-0 text-sm font-black">{option.votes}</span>
                    </button>
                    {canCreate && poll.status === "OPEN" && option.votes > 0 && scheduling?.optionId !== option.id && (
                      <button onClick={() => setScheduling({ pollId: poll.id, optionId: option.id, playFormat: "DOUBLES", partnerFormat: "MANUAL", courtCount: String(Math.max(1, Math.floor(option.votes / 4))) })} className="mt-1 text-[11px] font-bold text-[var(--lime-deep)] hover:underline">Schedule this time</button>
                    )}
                    {scheduling?.optionId === option.id && (
                      <div className="mt-2 grid gap-2 rounded-xl bg-[#131f19] p-3 sm:grid-cols-4">
                        <select value={scheduling.playFormat} onChange={(event) => setScheduling({ ...scheduling, playFormat: event.target.value })} aria-label="Format" className={field}>{Object.entries(playFormatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                        <select value={scheduling.partnerFormat} onChange={(event) => setScheduling({ ...scheduling, partnerFormat: event.target.value })} aria-label="Partners" className={field}>{Object.entries(partnerFormatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                        <input type="number" min="1" max="20" value={scheduling.courtCount} onChange={(event) => setScheduling({ ...scheduling, courtCount: event.target.value })} aria-label="Courts" className={field} />
                        <div className="flex gap-2">
                          <button onClick={() => setScheduling(null)} className="h-10 flex-1 rounded-full border border-[var(--line)] text-xs font-bold">Cancel</button>
                          <button onClick={schedule} disabled={busy} className="h-10 flex-1 rounded-full bg-[var(--lime)] text-xs font-bold text-[#0f1712] disabled:opacity-50">{busy ? "..." : "Create"}</button>
                        </div>
                        <p className="text-[11px] text-[var(--ink-soft)] sm:col-span-4">Creates the round robin, joins the {option.votes} who said yes, invites everyone else, and closes the poll. Courts: {scheduling.courtCount}.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {canCreate && poll.status === "OPEN" && <button onClick={() => close(poll)} className="mt-3 text-[11px] font-bold text-[var(--ink-soft)] hover:text-[var(--coral)]">Close poll without scheduling</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
