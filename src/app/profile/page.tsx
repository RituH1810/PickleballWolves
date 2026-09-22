"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, MapPin, Pencil, Trophy } from "lucide-react";

type Profile = { id: string; name: string; skillRating: string; preferredHand: "LEFT" | "RIGHT" | "AMBIDEXTROUS"; homeCourt: string | null; record: string; winRate: string; rank: number };
type RecentResult = { opponent: string; event: string; score: string; result: "W" | "L" | "-" };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ name: "", skillRating: "", homeCourt: "", preferredHand: "RIGHT" as Profile["preferredHand"] });

  useEffect(() => {
    fetch("/api/profile").then(async (response) => {
      if (response.status === 401) { setSignedOut(true); return; }
      if (!response.ok) return;
      const data = await response.json();
      if (!data?.profile) return;
      setProfile(data.profile);
      setDraft({ name: data.profile.name, skillRating: data.profile.skillRating, homeCourt: data.profile.homeCourt ?? "", preferredHand: data.profile.preferredHand });
      const matchesResponse = await fetch("/api/matches");
      if (!matchesResponse.ok) return;
      const matchesData = await matchesResponse.json();
      setRecentResults((matchesData.matches ?? []).slice(0, 3).map((match: { players: { id: string; name: string; side: "A" | "B" }[]; event: string; scores: { sideAScore: number; sideBScore: number }[] }) => {
        const mine = match.players.find((player) => player.id === data.profile.id);
        const teammates = match.players.filter((player) => player.id !== data.profile.id && player.side === mine?.side).map((player) => player.name);
        const opposingSide = match.players.filter((player) => player.side !== mine?.side).map((player) => player.name);
        const myLabel = teammates.length ? `You & ${teammates.join(" & ")}` : "You";
        const theirLabel = opposingSide.length ? opposingSide.join(" & ") : (match.players.filter((player) => player.id !== data.profile.id).map((player) => player.name).join(" & ") || "Solo entry");
        const myScore = match.scores.reduce((total, score) => total + (mine?.side === "A" ? score.sideAScore : score.sideBScore), 0);
        const theirScore = match.scores.reduce((total, score) => total + (mine?.side === "A" ? score.sideBScore : score.sideAScore), 0);
        const margin = myScore - theirScore;
        const scoreText = match.scores.map((score) => `${mine?.side === "A" ? score.sideAScore : score.sideBScore} - ${mine?.side === "A" ? score.sideBScore : score.sideAScore}`).join(", ") || "No score";
        return { opponent: `${myLabel} vs ${theirLabel}`, event: match.event, score: scoreText, result: match.scores.length ? (margin > 0 ? "W" : margin < 0 ? "L" : "-") : "-" };
      }));
    }).finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const data = await response.json();
    if (response.ok) { setProfile((prev) => prev ? { ...prev, ...data.profile } : data.profile); setEditing(false); setNotice("Profile saved"); setTimeout(() => setNotice(""), 2500); }
    else setNotice(data.error ?? "Unable to save profile");
  }

  if (signedOut) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="text-center"><p className="font-bold text-[var(--foreground)]">Sign in to view your profile.</p><Link href="/login" className="mt-3 inline-block text-sm font-bold text-[var(--lime-deep)]">Sign in</Link></div></main>;
  if (loading || !profile) return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-8 noise sm:px-10"><p className="text-sm text-[var(--ink-soft)]">Loading profile...</p></main>;

  const initials = profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10"><div className="mx-auto max-w-4xl"><Link href="/" className="text-xs font-bold text-[var(--lime-deep)]">Back to dashboard</Link><section className="mt-8 rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-9"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="grid h-24 w-24 place-items-center rounded-[28px] bg-[#d8f24e] text-2xl font-black text-[#1b211e]">{initials}</div><div className="flex-1"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--lime-deep)]">Player profile</p>{editing ? <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-2 h-11 w-full max-w-sm rounded-xl border border-[var(--line)] px-3 text-2xl font-black outline-none focus:border-[var(--lime-deep)]" /> : <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-[var(--foreground)]">{profile.name}</h1>}<p className="mt-2 flex items-center gap-2 text-sm text-[var(--ink-soft)]"><MapPin size={15} />{profile.homeCourt || "Add your home court"} · {profile.preferredHand.toLowerCase()}-handed</p></div>{editing ? <div className="flex gap-2"><button onClick={saveProfile} className="rounded-full bg-[var(--lime)] px-4 py-2.5 text-xs font-bold text-[#0f1712]">Save</button><button onClick={() => { setDraft({ name: profile.name, skillRating: profile.skillRating, homeCourt: profile.homeCourt ?? "", preferredHand: profile.preferredHand }); setEditing(false); }} className="rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-bold">Cancel</button></div> : <button onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-bold"><Pencil size={14} />Edit profile</button>}</div>{editing && <div className="mt-6 grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-2"><label className="text-xs font-bold text-[#c3d0c5]">Skill rating<input type="number" min="2" max="6" step="0.1" value={draft.skillRating} onChange={(event) => setDraft({ ...draft, skillRating: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm" /></label><label className="text-xs font-bold text-[#c3d0c5]">Home court<input value={draft.homeCourt} onChange={(event) => setDraft({ ...draft, homeCourt: event.target.value })} placeholder="Northside Courts" className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm" /></label><label className="text-xs font-bold text-[#c3d0c5]">Preferred hand<select value={draft.preferredHand} onChange={(event) => setDraft({ ...draft, preferredHand: event.target.value as Profile["preferredHand"] })} className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm"><option value="RIGHT">Right</option><option value="LEFT">Left</option><option value="AMBIDEXTROUS">Ambidextrous</option></select></label></div>}{notice && <p role="status" className="mt-4 text-xs font-bold text-[var(--lime-deep)]">{notice}</p>}<div className="mt-9 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#131f19] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Skill rating</p><p className="mt-2 text-2xl font-black">{profile.skillRating}</p></div><div className="rounded-2xl bg-[#131f19] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Win rate</p><p className="mt-2 text-2xl font-black">{profile.winRate}</p></div><div className="rounded-2xl bg-[#1b211e] p-4 text-white"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9b6a9]">Wolves rank</p><p className="mt-2 flex items-center gap-2 text-2xl font-black">#{profile.rank} <span className="text-xs text-[#d8f24e]"><ArrowUpRight size={15} className="inline" /></span></p></div></div></section><section className="mt-5 grid gap-5 md:grid-cols-[.8fr_1.2fr]"><div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6"><div className="flex items-center gap-2"><Trophy size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Playing style</h2></div><p className="mt-5 text-sm leading-6 text-[var(--ink-soft)]">Your record and rating update automatically as you log matches. Keep playing to build out your profile.</p></div><div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6"><h2 className="font-extrabold">Latest form</h2><div className="mt-4 space-y-3">{recentResults.length === 0 ? <p className="text-sm text-[var(--ink-soft)]">No matches recorded yet.</p> : recentResults.map((result, index) => <div key={index} className="flex items-center gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"><span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-black ${result.result === "W" ? "bg-[#1e2b17] text-[#c7e572]" : result.result === "L" ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1c2a1a] text-[var(--ink-soft)]"}`}>{result.result}</span><p className="flex-1 text-sm font-semibold">{result.opponent}</p><span className="text-xs font-bold text-[var(--ink-soft)]">{result.score}</span></div>)}</div></div></section></div></main>;
}
