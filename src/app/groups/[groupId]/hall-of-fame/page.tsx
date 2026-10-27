"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Crown, Flame, Gauge, Handshake, Lock, ShieldCheck, Timer, Trophy, Zap } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Reactions } from "@/components/reactions";
import { recordTarget } from "@/lib/reactions";

type Holder = { userId: string; name: string; photoUrl: string | null };
type HallRecord = { key: string; label: string; value: string; holders: Holder[]; detail: string; roundRobin: { id: string; name: string } | null; at: string | null };

const ICONS: Record<string, typeof Trophy> = { titles: Crown, streak: Flame, biggestWin: Zap, bestNight: Trophy, undefeated: ShieldCheck, duo: Handshake, clutch: Timer, games: Gauge };

/** A group's all-time records: titles, streaks, blowouts, best nights, best duo, most clutch and most games. */
export default function HallOfFamePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [data, setData] = useState<{ groupName: string | null; records: HallRecord[]; error: string | null } | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/hall-of-fame`).then(async (response) => {
      const body = await response.json().catch(() => null);
      setData(response.ok ? { groupName: body.groupName, records: body.records, error: null } : { groupName: null, records: [], error: body?.error ?? "Unable to load the Hall of Fame." });
    });
  }, [groupId]);

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href={`/groups/${groupId}`} className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to group</Link>
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">{data?.groupName ?? "Group"} · All time</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Hall of Fame</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">Records from every ended round robin in this group. Each scored game counts as a win or loss, and guests don&apos;t hold records.</p>
        </div>

        {!data ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-36 rounded-2xl" />)}</div>
        ) : data.error ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-10 text-center">
            <Lock size={20} className="text-[var(--lime-deep)]" />
            <p className="text-sm font-bold">{data.error}</p>
          </div>
        ) : !data.records.length ? (
          <p className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-soft)]">No records yet -- they&apos;re set once the group finishes its first round robin.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {data.records.map((record) => {
              const Icon = ICONS[record.key] ?? Trophy;
              return (
                <section key={record.key} className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><Icon size={15} className="text-[var(--lime-deep)]" />{record.label}</p>
                    <p className="text-2xl font-black tracking-[-.04em] text-[var(--lime)]">{record.value}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                    {record.holders.map((holder) => (
                      <Link key={holder.userId} href={`/players/${holder.userId}`} className="flex min-w-0 items-center gap-2 font-extrabold hover:text-[var(--lime-deep)]">
                        <Avatar name={holder.name} photoUrl={holder.photoUrl} className="h-8 w-8 shrink-0 rounded-full bg-[#22331f] text-[10px] font-black text-[var(--lime)]" />
                        <span className="truncate">{holder.name}</span>
                      </Link>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-[var(--ink-soft)]">
                    {record.detail}
                    {record.roundRobin && <> · <Link href={`/round-robin/${record.roundRobin.id}`} className="font-semibold hover:text-[var(--lime-deep)] hover:underline">{record.roundRobin.name}</Link></>}
                    {record.at && <> · {new Date(record.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</>}
                  </p>
                  <Reactions targetType="RECORD" targetId={recordTarget(groupId, record)} className="mt-4" />
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
