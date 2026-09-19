"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Bell } from "lucide-react";

type Notification = { id: string; title: string; body: string; createdAt: string; readAt: string | null };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  useEffect(() => { fetch("/api/notifications").then((response) => response.json()).then((data) => setNotifications(data.notifications ?? [])); }, []);
  async function markRead() { await fetch("/api/notifications", { method: "PATCH" }); setNotifications((items) => items.map((item) => ({ ...item, readAt: new Date().toISOString() }))); }
  return <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-3xl"><Link href="/" className="flex items-center gap-2 text-xs font-bold text-[#6b8f21]"><ArrowLeft size={14} />Back to dashboard</Link><div className="mt-8 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">Stay in the loop</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">Notifications.</h1></div><button onClick={markRead} className="text-xs font-bold text-[#6b8f21]">Mark all read</button></div><section className="mt-8 rounded-[20px] border border-[#e2e7e2] bg-white p-5">{notifications.length ? notifications.map((notification) => <article key={notification.id} className={`flex gap-4 border-b border-[#e2e7e2] py-4 last:border-0 ${notification.readAt ? "opacity-60" : ""}`}><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d8f24e]"><Bell size={16} /></div><div><h2 className="text-sm font-bold">{notification.title}</h2><p className="mt-1 text-sm text-[#67716a]">{notification.body}</p><p className="mt-2 text-[10px] font-semibold text-[#9aa69b]">{new Date(notification.createdAt).toLocaleString()}</p></div></article>) : <div className="py-10 text-center"><Bell size={24} className="mx-auto text-[#98ba1f]" /><p className="mt-4 text-sm font-bold">You are all caught up.</p><p className="mt-2 text-xs text-[#67716a]">Game reminders and challenges will appear here.</p></div>}</section></div></main>;
}
