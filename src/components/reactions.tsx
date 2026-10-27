"use client";

import { useEffect, useState } from "react";
import { REACTION_EMOJIS, type ReactionSummary, type ReactionTarget } from "@/lib/reactions";

/**
 * Emoji reactions under a result: tap to add or remove yours; hover a count to see who reacted.
 * Pass `initial` when the reactions came with the page's data (a list loads them in one go);
 * otherwise they're fetched. Hidden if they can't load.
 */
export function Reactions({ targetType, targetId, initial, tone = "dark", className = "" }: { targetType: ReactionTarget; targetId: string; initial?: ReactionSummary; tone?: "dark" | "lime"; className?: string }) {
  const [reactions, setReactions] = useState<ReactionSummary | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const preloaded = initial !== undefined;

  useEffect(() => {
    if (preloaded) return;
    fetch(`/api/reactions?type=${targetType}&id=${encodeURIComponent(targetId)}`).then((response) => response.ok ? response.json() : null).then((data) => setReactions(data?.reactions ?? null));
  }, [targetType, targetId, preloaded]);

  if (!reactions) return null;

  async function toggle(emoji: string) {
    if (busy) return;
    setBusy(true);
    const response = await fetch("/api/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, emoji }) }).catch(() => null);
    const data = response?.ok ? await response.json() : null;
    if (data?.reactions) setReactions(data.reactions);
    setBusy(false);
  }

  const base = "flex h-8 items-center gap-1 rounded-full px-2.5 text-sm transition-colors disabled:cursor-wait";
  const styles = tone === "lime"
    ? { mine: "bg-[#0f1712] text-[var(--lime)]", other: "bg-[#0f1712]/10 text-[#0f1712] hover:bg-[#0f1712]/20" }
    : { mine: "border border-[var(--lime-deep)] bg-[#1e2b17] text-[#c7e572]", other: "border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[#1c2a1a]" };
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {REACTION_EMOJIS.map((emoji) => {
        const entry = reactions.find((reaction) => reaction.emoji === emoji);
        const who = entry ? entry.names.join(", ") : "";
        return (
          <button key={emoji} onClick={() => toggle(emoji)} disabled={busy} aria-pressed={entry?.mine ?? false} title={who || "React"} aria-label={entry ? `${emoji} ${entry.count}: ${who}` : `React ${emoji}`} className={`${base} ${entry?.mine ? styles.mine : styles.other}`}>
            <span>{emoji}</span>
            {entry && <span className="text-xs font-bold">{entry.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
