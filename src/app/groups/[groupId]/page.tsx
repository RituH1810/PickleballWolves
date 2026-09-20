"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Lock, MapPin, Users } from "lucide-react";

type Member = { id: string; name: string; skillRating: string; role: "MEMBER" | "ORGANIZER" };
type GroupEvent = { id: string; title: string; startsAt: string; location: string; format: string };
type Group = { id: string; name: string; location: string; description: string; memberCount: number; members: Member[]; events: GroupEvent[]; isMember: boolean; myRole: string | null };

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/${groupId}`).then(async (response) => {
      if (response.status === 404) { setNotFound(true); return; }
      if (!response.ok) return;
      const data = await response.json();
      setGroup(data.group ?? null);
    }).finally(() => setLoading(false));
  }, [groupId]);

  async function toggleMembership() {
    if (!group) return;
    setUpdating(true);
    const response = await fetch(`/api/groups/${groupId}/membership`, { method: group.isMember ? "DELETE" : "POST" });
    const data = await response.json();
    if (!response.ok) { setNotice({ text: data.error ?? "Unable to update membership", type: "error" }); setUpdating(false); return; }
    const reload = await fetch(`/api/groups/${groupId}`);
    if (reload.ok) { const reloaded = await reload.json(); setGroup(reloaded.group ?? null); }
    setNotice({ text: group.isMember ? "Left group" : "You're in! Joined the group.", type: "success" });
    setUpdating(false);
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><p className="text-sm text-[#67716a]">Loading group...</p></main>;
  if (notFound || !group) return <main className="grid min-h-screen place-items-center bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[#1b211e]">Group not found.</p><Link href="/groups" className="mt-3 inline-block text-sm font-bold text-[#6b8f21]">Back to groups</Link></div></main>;

  const mark = group.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/groups" className="flex items-center gap-2 text-xs font-bold text-[#6b8f21]"><ArrowLeft size={14} />Back to groups</Link>

        {notice && <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${notice.type === "error" ? "bg-[#fde3dd] text-[#a94f3d]" : "bg-[#e4f3a8] text-[#5c7b1a]"}`}>{notice.text}</p>}

        <section className="mt-6 rounded-[24px] border border-[#e2e7e2] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#d8f24e] text-lg font-black">{mark}</div>
            <div className="flex-1">
              <h1 className="text-2xl font-black tracking-[-.03em] text-[#1b211e] sm:text-3xl">{group.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-[#67716a]"><MapPin size={14} />{group.location}</p>
            </div>
            <button onClick={toggleMembership} disabled={updating} className={`flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${group.isMember ? "bg-[#e4f3a8] text-[#5c7b1a]" : "bg-[#1b211e] text-white hover:bg-[#344037]"}`}>
              {group.isMember && <Check size={15} />}
              {group.isMember ? "Joined" : "Join group"}
            </button>
          </div>
          {group.description && <p className="mt-5 text-sm leading-6 text-[#465247]">{group.description}</p>}
          <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#67716a]"><Users size={16} />{group.memberCount} member{group.memberCount === 1 ? "" : "s"}</p>
        </section>

        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_.8fr]">
          <section className="rounded-[20px] border border-[#e2e7e2] bg-white p-6">
            <h2 className="font-extrabold">Members</h2>
            {group.isMember ? (
              <div className="mt-4 divide-y divide-[var(--line)]">
                {group.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#dfe8db] text-[10px] font-black">{member.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{member.name}</p>
                      <p className="text-[11px] text-[#67716a]">{member.skillRating} rating</p>
                    </div>
                    {member.role === "ORGANIZER" && <span className="rounded-full bg-[#eef2ed] px-2.5 py-1 text-[10px] font-bold text-[#67716a]">Organizer</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
                <Lock size={20} className="text-[#98ba1f]" />
                <p className="text-sm font-bold text-[#1b211e]">Join this group to see its members.</p>
                <p className="text-xs text-[#67716a]">Member names and ratings are visible to members only.</p>
              </div>
            )}
          </section>
          <section className="rounded-[20px] border border-[#e2e7e2] bg-white p-6">
            <h2 className="font-extrabold">Upcoming games</h2>
            <div className="mt-4 space-y-3">
              {group.events.length === 0 && <p className="text-sm text-[#67716a]">No upcoming games yet.</p>}
              {group.events.map((event) => (
                <div key={event.id} className="flex items-center gap-3 border-b border-[#e2e7e2] pb-3 last:border-0 last:pb-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef2ed] text-[#6b8f21]"><CalendarDays size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{event.title}</p>
                    <p className="mt-0.5 truncate text-xs text-[#67716a]">{new Date(event.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {event.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
