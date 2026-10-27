"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, Crown, Flame, Gauge, Medal, Star, TrendingUp, Trophy, UserPlus, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Reactions } from "@/components/reactions";
import type { FeedKind } from "@/lib/group-feed";
import type { ReactionSummary } from "@/lib/reactions";

type Item = { id: string; kind: FeedKind; at: string; players: { userId: string; name: string; photoUrl: string | null }[]; text: string; href: string | null };

const ICONS: Record<FeedKind, LucideIcon> = { champion: Crown, rating: TrendingUp, streak: Flame, games: Gauge, record: Trophy, badge: Medal, potw: Star, joined: UserPlus };
const FIRST_SHOWN = 6;

// Calendar days in the viewer's time zone, like the insights page.
function ago(iso: string) {
  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(new Date(iso))) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

/** The group's last 30 days of moments worth cheering, each with reactions. Hidden while there's nothing to show. */
export function GroupFeed({ groupId }: { groupId: string }) {
  const [feed, setFeed] = useState<{ items: Item[]; reactions: Record<string, ReactionSummary> | null } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/feed`).then((response) => response.ok ? response.json() : null).then((data) => setFeed(data?.items ? data : null));
  }, [groupId]);

  if (!feed?.items.length) return null;
  const shown = expanded ? feed.items : feed.items.slice(0, FIRST_SHOWN);
  return (
    <section id="group-activity" className="mt-5 scroll-mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
      <div className="flex items-center gap-2"><Activity size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Group activity</h2></div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">The last 30 days: champions, milestones, streaks, records and new faces.</p>
      <ol className="mt-4 divide-y divide-[var(--line)]">
        {shown.map((item) => {
          const Icon = ICONS[item.kind];
          const [first] = item.players;
          return (
            <li key={item.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
              <div className="relative h-10 w-10 shrink-0">
                {first ? <Avatar name={first.name} photoUrl={first.photoUrl} className="h-10 w-10 rounded-full bg-[#22331f] text-xs font-black text-[var(--lime)]" /> : null}
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--panel)] bg-[var(--lime)] text-[#0f1712]"><Icon size={11} /></span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5">{item.href ? <Link href={item.href} className="hover:text-[var(--lime-deep)] hover:underline">{item.text}</Link> : item.text}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{ago(item.at)}</p>
                {feed.reactions && <Reactions targetType="FEED" targetId={`${groupId}:${item.id}`} initial={feed.reactions[item.id] ?? []} className="mt-2" />}
              </div>
            </li>
          );
        })}
      </ol>
      {feed.items.length > FIRST_SHOWN && (
        <button onClick={() => setExpanded((current) => !current)} className="mt-4 text-xs font-bold text-[var(--lime-deep)] hover:underline">{expanded ? "Show less" : `Show ${feed.items.length - FIRST_SHOWN} more`}</button>
      )}
    </section>
  );
}
