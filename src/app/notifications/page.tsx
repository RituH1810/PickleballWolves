"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Bell } from "lucide-react";

type Notification = { id: string; title: string; body: string; createdAt: string; readAt: string | null };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  useEffect(() => { fetch("/api/notifications").then((response) => response.json()).then((data) => setNotifications(data.notifications ?? [])); }, []);
  async function markRead() { await fetch("/api/notifications", { method: "PATCH" }); setNotifications((items) => items.map((item) => ({ ...item, readAt: new Date().toISOString() }))); }
  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-3xl"><Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to dashboard</Link><div className="mt-8 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Stay in the loop</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[var(--foreground)]">Notifications.</h1></div><button onClick={markRead} className="text-xs font-bold text-[var(--lime-deep)]">Mark all read</button></div><section className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">{notifications.length ? notifications.map((notification) => <article key={notification.id} className={`flex gap-4 border-b border-[var(--line)] py-4 last:border-0 ${notification.readAt ? "opacity-60" : ""}`}><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d8f24e] text-[#1b211e]"><Bell size={16} /></div><div><h2 className="text-sm font-bold">{notification.title}</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">{notification.body}</p><p className="mt-2 text-[10px] font-semibold text-[#62766a]">{new Date(notification.createdAt).toLocaleString()}</p></div></article>) : <div className="py-10 text-center"><Bell size={24} className="mx-auto text-[var(--lime-deep)]" /><p className="mt-4 text-sm font-bold">You are all caught up.</p><p className="mt-2 text-xs text-[var(--ink-soft)]">Game reminders and challenges will appear here.</p></div>}</section></div></main>;
}
