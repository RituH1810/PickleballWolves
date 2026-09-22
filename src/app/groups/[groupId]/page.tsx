"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Lock, MapPin, PawPrint, Trophy, UserPlus, Users } from "lucide-react";

type Player = { id: string; name: string; rank: number | null };
type Member = { id: string; name: string; skillRating: string; role: "MEMBER" | "ORGANIZER"; rank: number | null };
type LeaderboardEntry = { rank: number; id: string; name: string; rating: string; wins: number; losses: number; winPct: number; scored: number; conceded: number; avgPointDiff: number };
type RecentResult = { id: string; sideA: string; sideB: string; score: string; winnerSide: "A" | "B" | null; date: string };
type GroupEvent = { id: string; title: string; startsAt: string; location: string; format: string };
type Group = { id: string; name: string; location: string; description: string; memberCount: number; members: Member[]; leaderboard: LeaderboardEntry[]; recentResults: RecentResult[]; events: GroupEvent[]; isMember: boolean; myRole: string | null };

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSelected, setInviteSelected] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingEmailInvite, setSendingEmailInvite] = useState(false);

  async function loadGroup() {
    const response = await fetch(`/api/groups/${groupId}`);
    if (response.status === 404) { setNotFound(true); return; }
    if (!response.ok) return;
    const data = await response.json();
    setGroup(data.group ?? null);
  }

  useEffect(() => {
    fetch(`/api/groups/${groupId}`).then(async (response) => {
      if (response.status === 404) { setNotFound(true); return; }
      if (!response.ok) return;
      const data = await response.json();
      setGroup(data.group ?? null);
    }).finally(() => setLoading(false));
  }, [groupId]);
  useEffect(() => { if (showInvite && players.length === 0) fetch("/api/players").then((response) => response.json()).then((data) => setPlayers(data.players ?? [])); }, [showInvite, players.length]);

  async function inviteSelectedPlayers() {
    if (!inviteSelected.length) return;
    setInviting(true);
    const response = await fetch(`/api/groups/${groupId}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: inviteSelected }) });
    const data = await response.json();
    if (!response.ok) { setNotice({ text: data.error ?? "Unable to invite players", type: "error" }); setInviting(false); return; }
    await loadGroup();
    setInviteSelected([]);
    setShowInvite(false);
    setNotice({ text: `Added ${data.added} player${data.added === 1 ? "" : "s"} to the group.`, type: "success" });
    setInviting(false);
  }

  async function sendEmailInvite() {
    if (!inviteEmail.trim()) return;
    setSendingEmailInvite(true);
    const response = await fetch(`/api/groups/${groupId}/invite-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim() }) });
    const data = await response.json();
    if (!response.ok) { setNotice({ text: data.error ?? "Unable to send invite", type: "error" }); setSendingEmailInvite(false); return; }
    setInviteEmail("");
    setNotice({ text: `Invite email sent to ${data.invitedEmail}.`, type: "success" });
    setSendingEmailInvite(false);
  }

  async function toggleMembership() {
    if (!group) return;
    setUpdating(true);
    const response = await fetch(`/api/groups/${groupId}/membership`, { method: group.isMember ? "DELETE" : "POST" });
    const data = await response.json();
    if (!response.ok) { setNotice({ text: data.error ?? "Unable to update membership", type: "error" }); setUpdating(false); return; }
    await loadGroup();
    setNotice({ text: group.isMember ? "Left group" : "You're in! Joined the group.", type: "success" });
    setUpdating(false);
  }

  if (loading) return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton mt-6 h-40 rounded-[24px]" />
        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_.8fr]"><div className="skeleton h-56 rounded-[20px]" /><div className="skeleton h-56 rounded-[20px]" /></div>
      </div>
    </main>
  );
  if (notFound || !group) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[var(--foreground)]">Group not found.</p><Link href="/groups" className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Back to groups</Link></div></main>;

  const mark = group.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/groups" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to groups</Link>

        {notice && <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1e2b17] text-[#c7e572]"}`}>{notice.text}</p>}

        <section className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#d8f24e] text-lg font-black text-[#1b211e]">{mark}</div>
            <div className="flex-1">
              <h1 className="text-2xl font-black tracking-[-.03em] text-[var(--foreground)] sm:text-3xl">{group.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-[var(--ink-soft)]"><MapPin size={14} />{group.location}</p>
            </div>
            <div className="flex items-center gap-2">
              {group.isMember && (
                <button onClick={() => setShowInvite((current) => !current)} className="flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]">
                  <UserPlus size={15} />Invite players
                </button>
              )}
              <button onClick={toggleMembership} disabled={updating} className={`flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${group.isMember ? "bg-[#1e2b17] text-[#c7e572]" : "bg-[var(--lime)] text-[#0f1712] hover:bg-[#c3e043]"}`}>
                {group.isMember && <Check size={15} />}
                {group.isMember ? "Joined" : "Join group"}
              </button>
            </div>
          </div>
          {group.description && <p className="mt-5 text-sm leading-6 text-[#c3d0c5]">{group.description}</p>}
          <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[var(--ink-soft)]"><Users size={16} />{group.memberCount} member{group.memberCount === 1 ? "" : "s"}</p>

          {showInvite && group.isMember && (
            <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[#131f19] p-5">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">Invite by email</p>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Send a sign-in link to anyone, even if they&apos;re not on the platform yet.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" placeholder="player@example.com" className="h-11 flex-1 rounded-xl border border-[var(--line)] bg-[#0f1712] px-4 text-sm outline-none focus:border-[var(--lime-deep)]" />
                <button onClick={sendEmailInvite} disabled={sendingEmailInvite || !inviteEmail.trim()} className="flex h-11 items-center justify-center rounded-xl bg-[var(--lime)] px-5 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">
                  {sendingEmailInvite ? "Sending..." : "Send invite"}
                </button>
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[var(--lime-deep)]">Add existing players</p>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Add players who are already on the platform straight to the group.</p>
              {(() => {
                const memberIds = new Set(group.members.map((member) => member.id));
                const candidates = players.filter((player) => !memberIds.has(player.id));
                if (candidates.length === 0) return <p className="mt-4 text-sm text-[var(--ink-soft)]">Everyone on the platform is already in this group.</p>;
                return (
                  <>
                    <div className="mt-4 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                      {candidates.map((player) => (
                        <button key={player.id} onClick={() => setInviteSelected((current) => current.includes(player.id) ? current.filter((id) => id !== player.id) : [...current, player.id])} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${inviteSelected.includes(player.id) ? "border-[var(--lime-deep)] bg-[#1e2b17]" : "border-[var(--line)]"}`}>
                          <span className="font-bold">{player.name}</span>
                          {inviteSelected.includes(player.id) && <Check size={15} className="text-[var(--lime-deep)]" />}
                        </button>
                      ))}
                    </div>
                    <button onClick={inviteSelectedPlayers} disabled={inviting || inviteSelected.length === 0} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-60">
                      {inviting ? "Adding..." : `Add ${inviteSelected.length || ""} to group`.trim()}
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </section>

        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_.8fr]">
          <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
            <h2 className="font-extrabold">Members</h2>
            {group.isMember ? (
              <div className="mt-4 divide-y divide-[var(--line)]">
                {group.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#22331f] text-[10px] font-black text-[var(--lime)]">{member.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{member.name}</p>
                      <p className="text-[11px] text-[var(--ink-soft)]">{member.rank ? `#${member.rank} rank` : "Unranked"}</p>
                    </div>
                    {member.role === "ORGANIZER" && <span className="rounded-full bg-[#1c2a1a] px-2.5 py-1 text-[10px] font-bold text-[var(--ink-soft)]">Organizer</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
                <Lock size={20} className="text-[var(--lime-deep)]" />
                <p className="text-sm font-bold text-[var(--foreground)]">Join this group to see its members.</p>
                <p className="text-xs text-[var(--ink-soft)]">Member names and ranks are visible to members only.</p>
              </div>
            )}
          </section>
          <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
            <h2 className="font-extrabold">Upcoming games</h2>
            <div className="mt-4 space-y-3">
              {group.events.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No upcoming games yet.</p>}
              {group.events.map((event) => (
                <div key={event.id} className="flex items-center gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1c2a1a] text-[var(--lime-deep)]"><CalendarDays size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{event.title}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">{new Date(event.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {event.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          <div className="flex items-center gap-2"><Trophy size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Group leaderboard</h2></div>
          {group.isMember ? (
            group.leaderboard.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--ink-soft)]">No members yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead><tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><th className="pb-3">#</th><th className="pb-3">Player</th><th className="pb-3 text-center">W</th><th className="pb-3 text-center">L</th><th className="pb-3 text-center">Win%</th><th className="pb-3 text-center">Points earned</th><th className="pb-3 text-center">Points against</th><th className="pb-3 text-right">Avg pt diff</th></tr></thead>
                  <tbody>
                    {group.leaderboard.map((entry) => (
                      <tr key={entry.id} className="border-b border-[var(--line)] last:border-0">
                        <td className="py-3 font-bold text-[var(--ink-soft)]">{entry.rank}</td>
                        <td className="py-3"><span className="flex items-center gap-2 font-bold"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#22331f] text-[10px] font-black text-[var(--lime)]">{entry.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>{entry.name}</span></td>
                        <td className="py-3 text-center font-semibold">{entry.wins}</td>
                        <td className="py-3 text-center font-semibold">{entry.losses}</td>
                        <td className="py-3 text-center font-semibold">{entry.winPct}%</td>
                        <td className="py-3 text-center font-semibold">{entry.scored}</td>
                        <td className="py-3 text-center font-semibold">{entry.conceded}</td>
                        <td className={`py-3 text-right font-semibold ${entry.avgPointDiff > 0 ? "text-[var(--lime-deep)]" : entry.avgPointDiff < 0 ? "text-[#e8836a]" : "text-[var(--ink-soft)]"}`}>{entry.avgPointDiff > 0 ? "+" : ""}{entry.avgPointDiff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
              <Lock size={20} className="text-[var(--lime-deep)]" />
              <p className="text-sm font-bold text-[var(--foreground)]">Join this group to see its leaderboard.</p>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          <h2 className="font-extrabold">Recent results</h2>
          {group.isMember ? (
            group.recentResults.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
                <PawPrint size={20} className="text-[var(--lime-deep)]" />
                <p className="text-sm text-[var(--ink-soft)]">No completed matches yet.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {group.recentResults.map((result) => (
                  <div key={result.id} className="rounded-xl bg-[#131f19] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold">
                        <span className={result.winnerSide === "A" ? "text-[var(--lime-deep)]" : "text-[var(--foreground)]"}>{result.sideA}</span>
                        <span className="mx-2 font-normal text-[var(--ink-soft)]">vs</span>
                        <span className={result.winnerSide === "B" ? "text-[var(--lime-deep)]" : "text-[var(--foreground)]"}>{result.sideB}</span>
                      </p>
                      <span className="text-xs font-bold text-[var(--ink-soft)]">{new Date(result.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--ink-soft)]">{result.score}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
              <Lock size={20} className="text-[var(--lime-deep)]" />
              <p className="text-sm font-bold text-[var(--foreground)]">Join this group to see its recent results.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
