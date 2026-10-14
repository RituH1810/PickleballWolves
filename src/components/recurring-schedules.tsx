"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, ChevronRight, Plus, X } from "lucide-react";
import { DAY_LABELS, GENERATE_AHEAD_DAYS } from "@/lib/recurring";

type Schedule = { id: string; description: string; timeZone: string; playFormat: string; partnerFormat: string; courtCount: number; pointsToWin: number; createdByName: string; nextGame: { id: string; name: string; scheduledAt: string } | null };

const playFormatLabels: Record<string, string> = { SINGLES: "Singles", DOUBLES: "Doubles", MIXED: "Mixed doubles" };
const partnerFormatLabels: Record<string, string> = { ROTATE: "Rotating partners", FIXED: "Fixed partners", MANUAL: "Dink Draft" };
const EMPTY_DRAFT = { daysOfWeek: [] as number[], timeOfDay: "18:30", courtCount: "1", playFormat: "DOUBLES", partnerFormat: "ROTATE", pointsToWin: "11" };

/** A group's standing weekly games. Organizers set them up; everyone sees what's coming. */
export function RecurringSchedules({ groupId, onGamesCreated }: { groupId: string; onGamesCreated?: () => void }) {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function load() {
    const response = await fetch(`/api/groups/${groupId}/schedules`);
    if (!response.ok) return;
    const data = await response.json();
    setSchedules(data.schedules);
    setCanManage(data.canManage);
  }

  useEffect(() => {
    fetch(`/api/groups/${groupId}/schedules`).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data) return;
      setSchedules(data.schedules);
      setCanManage(data.canManage);
    });
  }, [groupId]);

  function toggleDay(day: number) {
    setDraft((current) => ({ ...current, daysOfWeek: current.daysOfWeek.includes(day) ? current.daysOfWeek.filter((entry) => entry !== day) : [...current.daysOfWeek, day] }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`/api/groups/${groupId}/schedules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, timeZone, courtCount: Number(draft.courtCount), pointsToWin: Number(draft.pointsToWin) }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setMessage({ text: data?.error ?? "Couldn't save the schedule.", error: true }); return; }
      setComposing(false);
      setDraft(EMPTY_DRAFT);
      setMessage({ text: data.created ? `Schedule saved -- ${data.created} game${data.created === 1 ? "" : "s"} created for the next ${GENERATE_AHEAD_DAYS} days.` : "Schedule saved. Games will appear a week ahead.", error: false });
      await load();
      if (data.created) onGamesCreated?.();
    } catch {
      setMessage({ text: "Couldn't save the schedule.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function stop(schedule: Schedule) {
    if (!window.confirm(`Stop "${schedule.description}"? Games already created stay on the calendar.`)) return;
    const response = await fetch(`/api/groups/${groupId}/schedules/${schedule.id}`, { method: "DELETE" });
    if (response.ok) setSchedules((current) => current?.filter((entry) => entry.id !== schedule.id) ?? null);
    else setMessage({ text: "Couldn't stop the schedule.", error: true });
  }

  if (!schedules || (!canManage && schedules.length === 0)) return null;

  const selectClass = "mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm";
  const browserTimeZone = typeof window === "undefined" ? "" : Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><CalendarClock size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Weekly games</h2></div>
        {canManage && !composing && <button onClick={() => { setComposing(true); setMessage(null); }} className="flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]"><Plus size={14} />New schedule</button>}
      </div>

      {composing && (
        <div className="mt-4 space-y-4 rounded-2xl border border-[var(--line)] bg-[#131f19] p-4">
          <div>
            <p className="text-xs font-bold text-[var(--ink-soft)]">Days</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, day) => {
                const on = draft.daysOfWeek.includes(day);
                return <button key={label} type="button" aria-pressed={on} onClick={() => toggleDay(day)} className={`h-9 w-12 rounded-full text-xs font-bold transition-colors ${on ? "bg-[var(--lime)] text-[#0f1712]" : "border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]"}`}>{label}</button>;
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-[var(--ink-soft)]">Start time
              <input type="time" value={draft.timeOfDay} onChange={(event) => setDraft({ ...draft, timeOfDay: event.target.value })} className={selectClass} />
            </label>
            <label className="text-xs font-bold text-[var(--ink-soft)]">Courts
              <input type="number" min="1" max="20" value={draft.courtCount} onChange={(event) => setDraft({ ...draft, courtCount: event.target.value })} className={selectClass} />
            </label>
            <label className="text-xs font-bold text-[var(--ink-soft)]">Points to win
              <select value={draft.pointsToWin} onChange={(event) => setDraft({ ...draft, pointsToWin: event.target.value })} className={selectClass}>{["11", "15", "21"].map((points) => <option key={points} value={points}>{points}</option>)}</select>
            </label>
            <label className="text-xs font-bold text-[var(--ink-soft)]">Format
              <select value={draft.playFormat} onChange={(event) => setDraft({ ...draft, playFormat: event.target.value })} className={selectClass}>{Object.entries(playFormatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            <label className="text-xs font-bold text-[var(--ink-soft)] sm:col-span-2">Partners
              <select value={draft.partnerFormat} onChange={(event) => setDraft({ ...draft, partnerFormat: event.target.value })} className={selectClass}>{Object.entries(partnerFormatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] leading-5 text-[var(--ink-soft)]">Times are in {browserTimeZone}. Each game is created {GENERATE_AHEAD_DAYS} days ahead and members are notified.</p>
            <div className="flex gap-2">
              <button onClick={() => { setComposing(false); setDraft(EMPTY_DRAFT); }} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold"><X size={14} />Cancel</button>
              <button onClick={save} disabled={saving || draft.daysOfWeek.length === 0 || !draft.timeOfDay} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save schedule"}</button>
            </div>
          </div>
        </div>
      )}

      {message && <p role={message.error ? "alert" : "status"} className={`mt-3 text-xs font-bold ${message.error ? "text-[var(--coral)]" : "text-[var(--lime-deep)]"}`}>{message.text}</p>}

      {schedules.length === 0 ? (
        !composing && <p className="mt-4 text-sm text-[var(--ink-soft)]">Play at the same time every week? Set it up once and each game is created automatically.</p>
      ) : (
        <div className="mt-4 divide-y divide-[var(--line)]">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{schedule.description}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{playFormatLabels[schedule.playFormat] ?? schedule.playFormat} · {partnerFormatLabels[schedule.partnerFormat] ?? schedule.partnerFormat} · {schedule.courtCount} court{schedule.courtCount === 1 ? "" : "s"} · to {schedule.pointsToWin}{schedule.timeZone !== browserTimeZone && ` · ${schedule.timeZone}`}</p>
                <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">Set up by {schedule.createdByName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {schedule.nextGame && <Link href={`/round-robin/${schedule.nextGame.id}`} className="flex items-center gap-1 rounded-full bg-[#131f19] px-3 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]">Next: {new Date(schedule.nextGame.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}<ChevronRight size={14} /></Link>}
                {canManage && <button onClick={() => stop(schedule)} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--coral)] hover:bg-[#1c2a1a]">Stop</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
