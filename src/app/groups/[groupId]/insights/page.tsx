"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, Hourglass, Lock, TrendingUp, UserMinus, Users } from "lucide-react";

type MemberRow = { id: string; name: string; played: number; possible: number; rate: number; lastPlayedAt: string | null; joinedButSatOut: number };
type Insights = {
  groupName: string;
  days: number;
  periods: number[];
  totals: { games: number; averagePlayers: number; uniquePlayers: number; activeMembers: number; members: number };
  weeks: { start: string; games: number; averagePlayers: number }[];
  slots: { label: string; games: number; averagePlayers: number }[];
  members: MemberRow[];
  fading: MemberRow[];
  notYet: MemberRow[];
};

// Calendar days in the viewer's time zone, not 24-hour periods -- a game last night at 6:30 PM is
// "Yesterday" this morning, even though fewer than 24 hours have passed.
function ago(iso: string | null) {
  if (!iso) return "Never";
  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(new Date(iso))) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function Panel({ title, icon: Icon, hint, children }: { title: string; icon: typeof Users; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-extrabold"><Icon size={17} className="text-[var(--lime-deep)]" />{title}</h2>
      {hint && <p className="mt-1 text-xs text-[var(--ink-soft)]">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Attendance insights for a group's organizers: who comes, when turnout is best, who's drifting away. */
export default function GroupInsightsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [days, setDays] = useState(90);
  const [data, setData] = useState<{ days: number; insights: Insights | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/groups/${groupId}/insights?days=${days}`).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!cancelled) setData({ days, insights: response.ok ? body : null, error: response.ok ? null : body?.error ?? "Unable to load insights." });
    });
    return () => { cancelled = true; };
  }, [groupId, days]);

  const loading = !data || data.days !== days;
  const insights = data?.insights;
  const maxWeekly = Math.max(1, ...(insights?.weeks.map((week) => week.averagePlayers) ?? []));
  const maxSlot = Math.max(1, ...(insights?.slots.map((slot) => slot.averagePlayers) ?? []));

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href={`/groups/${groupId}`} className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to group</Link>
        <div className="mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">{insights?.groupName ?? "Group"} · Organizers only</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Attendance insights</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">Based on round robins with scored games. &quot;Played&quot; means in at least one scored match.</p>
          </div>
          <div role="tablist" aria-label="Period" className="flex gap-1 rounded-full bg-[#1a2a1c] p-1">
            {(insights?.periods ?? [30, 90, 180]).map((period) => (
              <button key={period} role="tab" aria-selected={period === days} onClick={() => setDays(period)} className={`rounded-full px-3 py-2 text-xs font-bold ${period === days ? "bg-[var(--panel)] text-[var(--foreground)]" : "text-[var(--ink-soft)]"}`}>{period} days</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-24 rounded-2xl" />)}</div>
        ) : !insights ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-10 text-center">
            <Lock size={20} className="text-[var(--lime-deep)]" />
            <p className="text-sm font-bold">{data?.error}</p>
          </div>
        ) : (
          <>
            <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Games held", String(insights.totals.games)],
                ["Avg players per game", String(insights.totals.averagePlayers)],
                ["Different players", String(insights.totals.uniquePlayers)],
                ["Members who played", `${insights.totals.activeMembers} of ${insights.totals.members}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{label}</p>
                  <p className="mt-2 text-3xl font-black tracking-[-.04em]">{value}</p>
                </div>
              ))}
            </section>

            {insights.totals.games === 0 ? (
              <p className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">No scored games in the last {insights.days} days yet.</p>
            ) : (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <Panel title="Weekly turnout" icon={TrendingUp} hint="Average players per game each week (Monday start).">
                  <div className="flex h-40 items-end gap-1.5">
                    {insights.weeks.map((week) => (
                      <div key={week.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Week of ${new Date(`${week.start}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${week.games} game${week.games === 1 ? "" : "s"}, ${week.averagePlayers} avg players`}>
                        <span className="text-[10px] font-bold text-[var(--ink-soft)]">{week.games ? week.averagePlayers : ""}</span>
                        <div className={`w-full rounded-t-md ${week.games ? "bg-[var(--lime)]" : "bg-[#1c2a1a]"}`} style={{ height: week.games ? `${Math.max(6, (week.averagePlayers / maxWeekly) * 100)}%` : "4px" }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] font-semibold text-[var(--ink-soft)]">
                    <span>{new Date(`${insights.weeks[0].start}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    <span>This week</span>
                  </div>
                </Panel>

                <Panel title="Best days & times" icon={CalendarClock} hint="Average turnout for each regular time slot.">
                  <div className="space-y-3">
                    {insights.slots.map((slot) => (
                      <div key={slot.label}>
                        <div className="flex items-baseline justify-between text-sm"><span className="font-bold">{slot.label}</span><span className="text-xs text-[var(--ink-soft)]"><strong className="text-[var(--foreground)]">{slot.averagePlayers}</strong> avg · {slot.games} game{slot.games === 1 ? "" : "s"}</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#1c2a1a]"><div className="h-full rounded-full bg-[var(--lime)]" style={{ width: `${(slot.averagePlayers / maxSlot) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Drifting away" icon={UserMinus} hint="Came at least twice, but not in the last 3 weeks -- maybe worth a nudge.">
                  {insights.fading.length === 0 ? <p className="text-sm text-[var(--ink-soft)]">Nobody -- your regulars are still showing up.</p> : (
                    <ul className="divide-y divide-[var(--line)]">
                      {insights.fading.map((member) => <li key={member.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><Link href={`/players/${member.id}`} className="font-bold hover:text-[var(--lime-deep)] hover:underline">{member.name}</Link><span className="text-xs text-[var(--ink-soft)]">Last played {ago(member.lastPlayedAt)} · {member.played} games</span></li>)}
                    </ul>
                  )}
                </Panel>

                <Panel title="Haven't played yet" icon={Hourglass} hint="Members with no games in this period.">
                  {insights.notYet.length === 0 ? <p className="text-sm text-[var(--ink-soft)]">Every member has played at least once.</p> : (
                    <div className="flex flex-wrap gap-2">{insights.notYet.map((member) => <Link key={member.id} href={`/players/${member.id}`} className="rounded-full bg-[#1c2a1a] px-3 py-1.5 text-xs font-bold hover:text-[var(--lime-deep)]">{member.name}</Link>)}</div>
                  )}
                </Panel>
              </div>
            )}

            {insights.totals.games > 0 && (
              <section className="mt-5 overflow-x-auto rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
                <h2 className="flex items-center gap-2 font-extrabold"><Users size={17} className="text-[var(--lime-deep)]" />Members</h2>
                <p className="mt-1 text-xs text-[var(--ink-soft)]">Attendance counts games held since each member joined. &quot;Joined, didn&apos;t play&quot; means they RSVP&apos;d in but weren&apos;t in a scored match.</p>
                <table className="mt-4 w-full min-w-[560px] text-left text-sm">
                  <thead><tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><th className="pb-3">Member</th><th className="pb-3">Played</th><th className="pb-3">Attendance</th><th className="pb-3">Last played</th><th className="pb-3 text-right">Joined, didn&apos;t play</th></tr></thead>
                  <tbody>
                    {insights.members.map((member) => (
                      <tr key={member.id} className="border-b border-[var(--line)] last:border-0">
                        <td className="py-3 font-bold"><Link href={`/players/${member.id}`} className="hover:text-[var(--lime-deep)] hover:underline">{member.name}</Link></td>
                        <td className="py-3 text-[var(--ink-soft)]">{member.played} / {member.possible}</td>
                        <td className="py-3"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-[#1c2a1a]"><div className="h-full rounded-full bg-[var(--lime)]" style={{ width: `${member.rate}%` }} /></div><span className="text-xs font-bold">{member.rate}%</span></div></td>
                        <td className="py-3 text-xs text-[var(--ink-soft)]">{ago(member.lastPlayedAt)}</td>
                        <td className={`py-3 text-right text-xs font-bold ${member.joinedButSatOut ? "text-[var(--coral)]" : "text-[var(--ink-soft)]"}`}>{member.joinedButSatOut || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
