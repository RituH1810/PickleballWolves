"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";

type Nickname = { key: string; emoji: string; label: string; reason: string };

/** "Known as": nicknames earned from the player's numbers; tap one for why. Hidden until there's one. */
export function NicknamesCard({ userId, isMe = true }: { userId: string; isMe?: boolean }) {
  const [nicknames, setNicknames] = useState<Nickname[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/nicknames?userId=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then((data) => setNicknames(data?.nicknames ?? []));
  }, [userId]);

  if (!nicknames.length) return null;
  const open = nicknames.find((nickname) => nickname.key === openKey) ?? nicknames[0];
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]"><BadgeCheck size={15} className="text-[var(--lime-deep)]" />{isMe ? "You're known as" : "Known as"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {nicknames.map((nickname) => (
          <button key={nickname.key} type="button" onClick={() => setOpenKey(nickname.key)} aria-pressed={open.key === nickname.key} className={`rounded-full border px-3.5 py-2 text-sm font-extrabold transition-colors ${open.key === nickname.key ? "border-[var(--lime-deep)] bg-[#1e2b17] text-[var(--lime)]" : "border-[var(--line)] bg-[#131f19] hover:border-[var(--lime-deep)]"}`}>
            <span className="mr-1.5">{nickname.emoji}</span>{nickname.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--ink-soft)]">{open.emoji} {open.label}: {open.reason}.</p>
    </section>
  );
}
