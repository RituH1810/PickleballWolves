"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { History } from "lucide-react";

type Memory = { when: string; text: string; href: string | null };

/** A memory from this day in an earlier month, on the dashboard. Hidden on days with none. */
export function OnThisDay() {
  const [memory, setMemory] = useState<Memory | null>(null);

  useEffect(() => {
    fetch("/api/on-this-day").then((response) => response.ok ? response.json() : null).then((data) => setMemory(data?.memory ?? null));
  }, []);

  if (!memory) return null;
  const body = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#131f19] text-[var(--lime-deep)]"><History size={18} /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{memory.when}</p>
        <p className="mt-0.5 text-sm font-extrabold">{memory.text}</p>
      </div>
    </>
  );
  const className = "panel mt-5 flex items-center gap-4 rounded-2xl p-4";
  return memory.href ? <Link href={memory.href} className={`${className} hover:border-[var(--lime-deep)]`}>{body}</Link> : <section className={className}>{body}</section>;
}
