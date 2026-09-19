"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, MapPin, Plus, Users, X } from "lucide-react";
import { groups as demoGroups } from "@/lib/demo";

type LiveGroup = { id: string; name: string; location: string; members: number; next: string; mark: string };

export default function GroupsPage() {
  const [groups, setGroups] = useState<LiveGroup[]>(demoGroups.map((group) => ({ id: group.name, name: group.name, location: group.location, members: group.members, next: group.next, mark: group.mark })));
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", location: "", description: "" });

  useEffect(() => { fetch("/api/groups").then((response) => response.ok ? response.json() : null).then((data) => data?.groups && setGroups(data.groups)); }, []);

  async function createGroup() {
    const response = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error ?? "Unable to create group"); return; }
    setGroups((current) => [{ id: data.group.id, name: data.group.name, location: data.group.location, members: 1, next: "No upcoming games", mark: data.group.name.split(" ").map((word: string) => word[0]).join("").slice(0, 2) }, ...current]);
    setCreating(false);
    setForm({ name: "", location: "", description: "" });
    setNotice("Group created");
  }

  return <main className="min-h-screen bg-[#f3f5f2] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-5xl"><div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><Link href="/" className="text-xs font-bold text-[#6b8f21]">Back to dashboard</Link><p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-[#98ba1f]">Community</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-[#1b211e]">Find your groups.</h1><p className="mt-3 text-sm text-[#67716a]">Play regularly with people who make the game better.</p></div><button onClick={() => setCreating(!creating)} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1b211e] px-5 text-sm font-bold text-white">{creating ? <X size={17} /> : <Plus size={17} />}{creating ? "Close" : "Create group"}</button></div>{notice && <p role="status" className="mb-4 rounded-xl bg-[#e4f3a8] px-4 py-3 text-xs font-bold text-[#5c7b1a]">{notice}</p>}{creating && <section className="mb-6 rounded-[20px] border border-[#e2e7e2] bg-white p-6"><h2 className="text-lg font-extrabold">Create a group</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Group name" className="h-11 rounded-xl border border-[#dfe6df] px-3 text-sm" /><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location" className="h-11 rounded-xl border border-[#dfe6df] px-3 text-sm" /><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Short description" className="h-11 rounded-xl border border-[#dfe6df] px-3 text-sm sm:col-span-2" /><button onClick={createGroup} className="h-11 rounded-full bg-[#d8f24e] text-sm font-bold text-[#1b211e] sm:w-fit sm:px-6">Create group</button></div></section>}<div className="grid gap-4 md:grid-cols-2">{groups.map((group) => <article key={group.id} className="rounded-[20px] border border-[#e2e7e2] bg-white p-6 transition-transform hover:-translate-y-1"><div className="flex items-start gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d8f24e] text-sm font-black">{group.mark}</div><div className="flex-1"><h2 className="text-lg font-extrabold tracking-tight text-[#1b211e]">{group.name}</h2><p className="mt-1 flex items-center gap-1 text-xs text-[#67716a]"><MapPin size={13} />{group.location}</p></div><ChevronRight size={18} className="text-[#a0aaa1]" /></div><p className="mt-6 flex items-center gap-2 text-sm text-[#67716a]"><Users size={16} />{group.members} members</p><div className="mt-5 border-t border-[#e2e7e2] pt-4 text-xs font-semibold text-[#67716a]">Next up <span className="ml-2 text-[#1b211e]">{group.next}</span></div></article>)}</div></div></main>;
}
