"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Check, ChevronRight, Inbox, Mailbox, Send, Settings, Swords, Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Notification = { id: string; title: string; body: string; createdAt: string; readAt: string | null };
type Invite = { id: string; kind: "event" | "roundRobin" | "challenge"; startsAt: string | null; title: string; subtitle: string; count: number; cap: number | null; hostName: string; hostPhotoUrl: string | null; detailsHref: string; deadlineAt?: string };
type JoinRequest = { groupId: string; groupName: string; userId: string; name: string; photoUrl: string | null; skillRating: string };
type Tab = "invites" | "requests" | "activity";

// "Sat Oct. 31 at 6:30am EDT"
function formatWhen(iso: string) {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).replace(" AM", "am").replace(" PM", "pm");
  return `${weekday} ${month}${month.length <= 3 && month !== "May" ? "." : ""} ${date.getDate()} at ${time}`;
}

function inviteHeadline(invite: Invite) {
  if (invite.startsAt) return formatWhen(invite.startsAt);
  if (invite.kind === "challenge") return invite.deadlineAt ? `Respond by ${formatWhen(invite.deadlineAt)}` : "Ladder challenge";
  return "Date to be announced";
}

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span className="absolute -right-3 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--coral)] px-1 text-[10px] font-black text-[#0f1712]">{count}</span>;
}

function InviteCard({ invite, busy, onDecline }: { invite: Invite; busy: boolean; onDecline: () => void }) {
  const KindIcon = invite.kind === "challenge" ? Swords : Send;
  return <article className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
    <div className="flex gap-4">
      <div className="relative h-14 w-14 shrink-0">
        <Avatar name={invite.hostName} photoUrl={invite.hostPhotoUrl} className="h-14 w-14 rounded-full border-2 border-[var(--line)] bg-[#22331f] text-sm font-black text-[var(--lime)]" />
        <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--panel)] bg-[var(--lime)] text-[#0f1712]"><KindIcon size={12} /></span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm font-extrabold text-[var(--foreground)]">{inviteHeadline(invite)}</p>
          {invite.kind !== "challenge" && <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--ink-soft)]">{invite.cap ? `${invite.count}/${invite.cap}` : invite.count}<Users size={13} /></span>}
        </div>
        <p className="mt-1 truncate text-sm text-[var(--foreground)]">{invite.title}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">{invite.subtitle}</p>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <button onClick={onDecline} disabled={busy} className="flex items-center justify-between rounded-xl bg-[#131f19] px-4 py-2.5 text-sm font-bold text-[var(--coral)] transition-colors hover:bg-[#1c2a1a] disabled:opacity-50">Decline<X size={16} /></button>
      <Link href={invite.detailsHref} className="flex items-center justify-between rounded-xl bg-[#131f19] px-4 py-2.5 text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]">View Details<ChevronRight size={16} /></Link>
    </div>
  </article>;
}

function RequestCard({ request, busy, onRespond }: { request: JoinRequest; busy: boolean; onRespond: (status: "ACTIVE" | "DECLINED") => void }) {
  return <article className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
    <div className="flex items-center gap-4">
      <Avatar name={request.name} photoUrl={request.photoUrl} className="h-14 w-14 shrink-0 rounded-full border-2 border-[var(--line)] bg-[#22331f] text-sm font-black text-[var(--lime)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{request.name} <span className="font-semibold text-[var(--ink-soft)]">· {request.skillRating}</span></p>
        <p className="mt-1 truncate text-sm text-[var(--ink-soft)]">Wants to join <Link href={`/groups/${request.groupId}`} className="font-bold text-[var(--lime-deep)]">{request.groupName}</Link></p>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <button onClick={() => onRespond("DECLINED")} disabled={busy} className="flex items-center justify-between rounded-xl bg-[#131f19] px-4 py-2.5 text-sm font-bold text-[var(--coral)] transition-colors hover:bg-[#1c2a1a] disabled:opacity-50">Decline<X size={16} /></button>
      <button onClick={() => onRespond("ACTIVE")} disabled={busy} className="flex items-center justify-between rounded-xl bg-[var(--lime)] px-4 py-2.5 text-sm font-bold text-[#0f1712] transition-colors hover:bg-[#c3e043] disabled:opacity-50">Approve<Check size={16} /></button>
    </div>
  </article>;
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Bell; title: string; body: string }) {
  return <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] py-12 text-center"><Icon size={24} className="mx-auto text-[var(--lime-deep)]" /><p className="mt-4 text-sm font-bold">{title}</p><p className="mt-2 text-xs text-[var(--ink-soft)]">{body}</p></div>;
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("invites");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/notifications/inbox").then((response) => response.ok ? response.json() : null).then((data) => { setInvites(data?.invites ?? []); setRequests(data?.requests ?? []); }),
      fetch("/api/notifications").then((response) => response.json()).then((data) => setNotifications(data.notifications ?? [])),
    ]).finally(() => setLoading(false));
  }, []);

  async function markRead() { await fetch("/api/notifications", { method: "PATCH" }); setNotifications((items) => items.map((item) => ({ ...item, readAt: new Date().toISOString() }))); }

  async function declineInvite(invite: Invite) {
    const key = `${invite.kind}:${invite.id}`;
    setBusyKey(key);
    const response = invite.kind === "event" ? await fetch(`/api/events/${invite.id}/rsvp`, { method: "DELETE" })
      : invite.kind === "roundRobin" ? await fetch(`/api/round-robin/${invite.id}/rsvp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DECLINED" }) })
      : await fetch(`/api/ladder/challenges/${invite.id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DECLINED" }) });
    setBusyKey(null);
    if (response.ok) { setInvites((items) => items.filter((item) => `${item.kind}:${item.id}` !== key)); setNotice("Invite declined."); }
    else setNotice((await response.json().catch(() => null))?.error ?? "Unable to decline this invite.");
  }

  async function respondRequest(request: JoinRequest, status: "ACTIVE" | "DECLINED") {
    const key = `${request.groupId}:${request.userId}`;
    setBusyKey(key);
    const response = await fetch(`/api/groups/${request.groupId}/requests/${request.userId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setBusyKey(null);
    if (response.ok) { setRequests((items) => items.filter((item) => `${item.groupId}:${item.userId}` !== key)); setNotice(status === "ACTIVE" ? `${request.name} is in.` : "Request declined."); }
    else setNotice((await response.json().catch(() => null))?.error ?? "Unable to respond to this request.");
  }

  const unread = notifications.filter((notification) => !notification.readAt).length;
  const tabs: { id: Tab; label: string; icon: typeof Bell; count: number }[] = [
    { id: "invites", label: "Invites", icon: Send, count: invites.length },
    { id: "requests", label: "Requests", icon: Mailbox, count: requests.length },
    { id: "activity", label: "Activity", icon: Bell, count: unread },
  ];

  return <main className="min-h-screen bg-[var(--background)] px-4 py-8 noise sm:px-10"><div className="mx-auto max-w-2xl">
    <div className="flex items-center justify-between"><h1 className="text-3xl font-black tracking-[-.04em] text-[var(--lime)]">Notifications</h1><div className="flex gap-2"><Link href="/notifications/settings" aria-label="Notification settings" className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--panel)] text-[var(--foreground)] hover:bg-[#1c2a1a]"><Settings size={20} /></Link><Link href="/" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--panel)] text-[var(--foreground)] hover:bg-[#1c2a1a]"><X size={20} /></Link></div></div>

    <nav className="mt-6 grid grid-cols-3 border-b border-[var(--line)]">
      {tabs.map(({ id, label, icon: Icon, count }) => <button key={id} onClick={() => setTab(id)} className={`relative flex flex-col items-center gap-2 pb-3 pt-2 text-sm font-bold ${tab === id ? "text-[var(--foreground)]" : "text-[var(--ink-soft)]"}`}>
        <span className="relative"><Icon size={24} /><CountBadge count={count} /></span>{label}
        {tab === id && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[var(--lime)]" />}
      </button>)}
    </nav>

    {notice && <p className="mt-4 rounded-xl bg-[#1e2b17] px-4 py-2.5 text-xs font-bold text-[#c7e572]">{notice}</p>}

    <section className="mt-5 space-y-4">
      {loading ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-[150px] rounded-[20px]" />)
        : tab === "invites" ? (invites.length ? invites.map((invite) => <InviteCard key={`${invite.kind}:${invite.id}`} invite={invite} busy={busyKey === `${invite.kind}:${invite.id}`} onDecline={() => declineInvite(invite)} />) : <EmptyState icon={Send} title="No open invites." body="Games, round robins and ladder challenges from your groups will show up here." />)
        : tab === "requests" ? (requests.length ? requests.map((request) => <RequestCard key={`${request.groupId}:${request.userId}`} request={request} busy={busyKey === `${request.groupId}:${request.userId}`} onRespond={(status) => respondRequest(request, status)} />) : <EmptyState icon={Inbox} title="No pending requests." body="When someone asks to join one of your groups, you can approve them here." />)
        : <>
          {unread > 0 && <div className="flex justify-end"><button onClick={markRead} className="text-xs font-bold text-[var(--lime-deep)]">Mark all read</button></div>}
          {notifications.length ? <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">{notifications.map((notification) => <article key={notification.id} className={`flex gap-4 border-b border-[var(--line)] py-4 first:pt-0 last:border-0 last:pb-0 ${notification.readAt ? "opacity-60" : ""}`}><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d8f24e] text-[#1b211e]"><Bell size={16} /></div><div><h2 className="text-sm font-bold">{notification.title}</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">{notification.body}</p><p className="mt-2 text-[10px] font-semibold text-[#62766a]">{new Date(notification.createdAt).toLocaleString()}</p></div></article>)}</div> : <EmptyState icon={Bell} title="You are all caught up." body="Game reminders and challenge results will appear here." />}
        </>}
    </section>
  </div></main>;
}
