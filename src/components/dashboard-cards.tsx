"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, CalendarDays, CheckCircle2, ClipboardList, Crown, PawPrint, Flame, Gauge, Medal, Star, Swords, TrendingDown, TrendingUp, Trophy, UserPlus, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FormDots, streakText } from "@/components/form-dots";
import { Reactions } from "@/components/reactions";
import { countdown } from "@/lib/dashboard-insights";
import type { FormResult } from "@/lib/form";
import type { FeedKind } from "@/lib/group-feed";
import type { ReactionSummary } from "@/lib/reactions";
import { CardHeading } from "@/components/card-heading";

/** Loads one dashboard card's data; null until it arrives (or if it fails). */
function useCard<T>(path: string, key: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    fetch(path).then((response) => response.ok ? response.json() : null).then((body) => setData(body?.[key] ?? null));
  }, [path, key]);
  return data;
}

const heading = (icon: LucideIcon, title: string) => <CardHeading icon={icon} title={title} />;

type Week = { rating: number; weekChange: number; form: FormResult[]; streak: { result: FormResult; length: number } | null; nextGame: { id: string; name: string; scheduledAt: string | null; groupName: string | null; location: string | null } | null };

/** "Your week": rating with its 7-day change, recent form, and a countdown to the next game you've joined. */
export function MyWeekCard() {
  const week = useCard<Week>("/api/dashboard/my-week", "week");
  if (!week) return null;
  const run = streakText(week.streak);
  const change = week.weekChange;
  const game = week.nextGame;
  return (
    <section className="panel mt-6 grid gap-4 rounded-[20px] p-5 sm:grid-cols-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Rating</p>
        <p className="mt-1 flex items-baseline gap-2"><span className="text-3xl font-black tracking-[-.04em]">{week.rating.toFixed(3)}</span>
          {change !== 0 && <span className={`flex items-center gap-0.5 text-xs font-black ${change > 0 ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"}`}>{change > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{change > 0 ? "+" : ""}{change.toFixed(3)}</span>}
        </p>
        <p className="text-xs text-[var(--ink-soft)]">{change === 0 ? "No change this week" : "this week"}</p>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Form</p>
        <div className="mt-2">{week.form.length ? <FormDots results={week.form} /> : <span className="text-xs text-[var(--ink-soft)]">No results yet</span>}</div>
        {run && <p className={`mt-1 text-xs font-bold ${week.streak!.result === "W" ? "text-[var(--lime-deep)]" : "text-[var(--coral)]"}`}>{run}</p>}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Next game</p>
        {game ? (
          <Link href={`/round-robin/${game.id}`} className="mt-1 block hover:opacity-90">
            <p className="truncate text-sm font-extrabold">{game.name}</p>
            {game.scheduledAt && <p className="flex items-center gap-1 text-xs text-[var(--ink-soft)]"><CalendarDays size={12} />{new Date(game.scheduledAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} · <span className="font-bold text-[var(--lime-deep)]">{countdown(new Date(game.scheduledAt), new Date())}</span></p>}
          </Link>
        ) : <p className="mt-1 text-xs text-[var(--ink-soft)]">Nothing joined yet -- check your round robin invites.</p>}
      </div>
    </section>
  );
}

type Todo = { id: string; kind: "score" | "vote"; label: string; detail: string; href: string };

/** "To do": scores to enter and Good Wolf votes to cast. Hidden when there's nothing to do. */
export function TodoCard() {
  const items = useCard<Todo[]>("/api/dashboard/todo", "items");
  if (!items?.length) return null;
  return (
    <section className="panel mt-6 rounded-[20px] p-5">
      {heading(ClipboardList, "To do")}
      <ul className="mt-3 divide-y divide-[var(--line)]">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="flex items-center gap-3 py-3 hover:opacity-90">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--lime-deep)]">{item.kind === "vote" ? <PawPrint size={15} /> : <CheckCircle2 size={15} />}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{item.label}</span><span className="block truncate text-xs text-[var(--ink-soft)]">{item.detail}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Rival watch": the player just ahead by rating, your monthly board place, and your top rivalry. */
export function RivalWatchCard() {
  const lines = useCard<{ id: string; text: string; href: string | null }[]>("/api/dashboard/rival-watch", "lines");
  if (!lines?.length) return null;
  const icons: Record<string, LucideIcon> = { rating: TrendingUp, monthly: Trophy, rival: Swords };
  return (
    <section className="panel mt-6 rounded-[20px] p-5">
      {heading(Swords, "Rival watch")}
      <ul className="mt-3 space-y-2.5">
        {lines.map((line) => {
          const Icon = icons[line.id] ?? Swords;
          const body = <span className="flex items-start gap-2.5 text-sm"><Icon size={15} className="mt-0.5 shrink-0 text-[var(--lime-deep)]" /><span>{line.text}</span></span>;
          return <li key={line.id}>{line.href ? <Link href={line.href} className="block hover:text-[var(--lime-deep)]">{body}</Link> : body}</li>;
        })}
      </ul>
    </section>
  );
}

type PulseItem = { id: string; kind: FeedKind; at: string; text: string; href: string | null; groupId: string; groupName: string; players: { userId: string; name: string; photoUrl: string | null }[]; reactions: ReactionSummary | null };
const PULSE_ICONS: Record<FeedKind, LucideIcon> = { champion: Crown, rating: TrendingUp, streak: Flame, games: Gauge, record: Trophy, badge: Medal, potw: Star, joined: UserPlus, goodWolf: PawPrint };

/** "Group pulse": the newest moments from all your groups' activity feeds, with reactions. */
export function GroupPulseCard() {
  const items = useCard<PulseItem[]>("/api/dashboard/group-pulse", "items");
  if (!items?.length) return null;
  return (
    <section className="panel mt-6 rounded-[20px] p-5">
      {heading(Activity, "Group pulse")}
      <ol className="mt-3 divide-y divide-[var(--line)]">
        {items.map((item) => {
          const Icon = PULSE_ICONS[item.kind] ?? Activity;
          const [first] = item.players;
          return (
            <li key={`${item.groupId}:${item.id}`} className="flex gap-3 py-3">
              <div className="relative h-9 w-9 shrink-0">
                {first && <Avatar name={first.name} photoUrl={first.photoUrl} className="h-9 w-9 rounded-full bg-[var(--avatar-bg)] text-xs font-black text-[var(--lime)]" />}
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--panel)] bg-[var(--lime)] text-[var(--on-lime)]"><Icon size={10} /></span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5">{item.href ? <Link href={item.href} className="hover:text-[var(--lime-deep)] hover:underline">{item.text}</Link> : item.text}</p>
                <p className="text-xs text-[var(--ink-soft)]"><Link href={`/groups/${item.groupId}#group-activity`} className="hover:underline">{item.groupName}</Link></p>
                {item.reactions && <Reactions targetType="FEED" targetId={`${item.groupId}:${item.id}`} initial={item.reactions} className="mt-2" />}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
