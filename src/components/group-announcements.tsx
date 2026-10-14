"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX } from "@/lib/announcements";

type Announcement = { id: string; title: string; body: string; createdAt: string; author: { id: string; name: string; photoUrl: string | null }; canDelete: boolean };

const COLLAPSED_COUNT = 3;

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Organizer posts for a group, newest first. Rendered only for active members. */
export function GroupAnnouncements({ groupId }: { groupId: string }) {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/groups/${groupId}/announcements`).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data) return;
      setAnnouncements(data.announcements);
      setCanPost(data.canPost);
    });
  }, [groupId]);

  async function post() {
    setPosting(true);
    setError("");
    try {
      const response = await fetch(`/api/groups/${groupId}/announcements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Couldn't post the announcement."); return; }
      setAnnouncements((current) => [data.announcement, ...(current ?? [])]);
      setDraft({ title: "", body: "" });
      setComposing(false);
    } catch {
      setError("Couldn't post the announcement.");
    } finally {
      setPosting(false);
    }
  }

  async function remove(announcement: Announcement) {
    if (!window.confirm(`Delete "${announcement.title}"?`)) return;
    const response = await fetch(`/api/groups/${groupId}/announcements/${announcement.id}`, { method: "DELETE" });
    if (response.ok) setAnnouncements((current) => current?.filter((entry) => entry.id !== announcement.id) ?? null);
    else setError("Couldn't delete the announcement.");
  }

  // Hide the whole card for regular members until there's something to read.
  if (!announcements || (!canPost && announcements.length === 0)) return null;
  const visible = expanded ? announcements : announcements.slice(0, COLLAPSED_COUNT);

  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Megaphone size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Announcements</h2></div>
        {canPost && !composing && <button onClick={() => setComposing(true)} className="flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]"><Plus size={14} />New</button>}
      </div>

      {composing && (
        <div className="mt-4 space-y-3 rounded-2xl border border-[var(--line)] bg-[#131f19] p-4">
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={ANNOUNCEMENT_TITLE_MAX} placeholder="Title, e.g. Courts 3-4 closed Saturday" aria-label="Announcement title" className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold outline-none focus:border-[var(--lime-deep)]" />
          <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} maxLength={ANNOUNCEMENT_BODY_MAX} rows={4} placeholder="What should the group know?" aria-label="Announcement message" className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--lime-deep)]" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-[var(--ink-soft)]">Every member gets a notification.</p>
            <div className="flex gap-2">
              <button onClick={() => { setComposing(false); setError(""); }} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold"><X size={14} />Cancel</button>
              <button onClick={post} disabled={posting || !draft.title.trim() || !draft.body.trim()} className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-50">{posting ? "Posting..." : "Post"}</button>
            </div>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-xs font-bold text-[var(--coral)]">{error}</p>}

      {announcements.length === 0 ? (
        !composing && <p className="mt-4 text-sm text-[var(--ink-soft)]">No announcements yet. Post schedule changes, court closures, or reminders here.</p>
      ) : (
        <div className="mt-4 divide-y divide-[var(--line)]">
          {visible.map((announcement) => (
            <article key={announcement.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">{announcement.title}</h3>
                {announcement.canDelete && <button onClick={() => remove(announcement)} aria-label={`Delete ${announcement.title}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[#1c2a1a] hover:text-[var(--coral)]"><Trash2 size={14} /></button>}
              </div>
              <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-6 text-[var(--ink-soft)]">{announcement.body}</p>
              <p className="mt-2 flex items-center gap-2 text-[11px] text-[var(--ink-soft)]">
                <Avatar name={announcement.author.name} photoUrl={announcement.author.photoUrl} className="h-5 w-5 rounded-full bg-[#22331f] text-[8px] font-black text-[var(--lime)]" />
                <Link href={`/players/${announcement.author.id}`} className="font-bold hover:text-[var(--lime-deep)] hover:underline">{announcement.author.name}</Link>
                <span>·</span>
                <time dateTime={announcement.createdAt} title={new Date(announcement.createdAt).toLocaleString()}>{timeAgo(announcement.createdAt)}</time>
              </p>
            </article>
          ))}
        </div>
      )}

      {announcements.length > COLLAPSED_COUNT && (
        <button onClick={() => setExpanded((value) => !value)} className="mt-4 text-xs font-bold text-[var(--lime-deep)]">{expanded ? "Show less" : `Show all ${announcements.length}`}</button>
      )}
    </section>
  );
}
