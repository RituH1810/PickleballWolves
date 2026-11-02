"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { STYLE_FIELDS, STYLE_MIN_GAMES, STYLE_OPTIONS, styleLabel, type StyleField } from "@/lib/play-style";

type Style = Record<StyleField, string | null>;
type Insight = { field: StyleField; value: string; label: string; wins: number; losses: number };

const FIELD_NAMES: Record<StyleField, string> = { side: "Court side", shots: "Shots", pace: "Pace" };
const EMPTY: Style = { side: null, shots: null, pace: null };
const PARTNER_LABELS: Record<string, string> = { LEFT: "Left-side players", RIGHT: "Right-side players", EITHER: "Either-side players", DINKER: "Dinkers", BANGER: "Bangers", ALL_COURT: "All-court players", STEADY: "Steady players", AGGRESSIVE: "Aggressive players" };

/** Playing style tags (editable on your own profile) and the record with partners of each style. */
export function PlayStyleCard({ userId, isMe = true, className = "mt-5" }: { userId: string; isMe?: boolean; className?: string }) {
  const [data, setData] = useState<{ ready: boolean; style: Style | null; insights: Insight[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/play-style?userId=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : null).then(setData);
  }, [userId]);

  if (!data || (!data.ready && !isMe)) return null;
  const style = data.style ?? EMPTY;
  const tags = STYLE_FIELDS.map((field) => styleLabel(field, style[field])).filter(Boolean);
  if (!isMe && !tags.length && !data.insights.length) return null;

  async function pick(field: StyleField, value: string) {
    const next = { ...style, [field]: style[field] === value ? null : value };
    setSaving(true);
    setError(null);
    const response = await fetch("/api/play-style", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    setSaving(false);
    if (!response.ok) { setError((await response.json().catch(() => null))?.error ?? "Couldn't save your style."); return; }
    setData((current) => current && { ...current, style: next });
  }

  const percent = (insight: Insight) => Math.round((insight.wins / (insight.wins + insight.losses)) * 100);
  return (
    <div className={`${className} rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6`}>
      <div className="flex items-center gap-2"><Trophy size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Playing style</h2></div>
      {isMe ? (
        <div className="mt-4 space-y-3">
          {STYLE_FIELDS.map((field) => (
            <div key={field}>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{FIELD_NAMES[field]}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STYLE_OPTIONS[field].map(([value, label]) => (
                  <button key={value} type="button" disabled={saving || !data.ready} onClick={() => pick(field, value)} aria-pressed={style[field] === value} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${style[field] === value ? "border-[var(--lime-deep)] bg-[#1e2b17] text-[var(--lime)]" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--lime-deep)]"}`}>{label}</button>
                ))}
              </div>
            </div>
          ))}
          {!data.ready && <p className="text-xs text-[var(--ink-soft)]">Playing styles are coming soon.</p>}
          {error && <p role="alert" className="text-xs font-bold text-[var(--coral)]">{error}</p>}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-1.5">{tags.length ? tags.map((tag) => <span key={tag} className="rounded-full bg-[#1e2b17] px-3 py-1.5 text-xs font-bold text-[var(--lime)]">{tag}</span>) : <span className="text-sm text-[var(--ink-soft)]">No style picked yet.</span>}</div>
      )}
      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{isMe ? "Your record" : "Record"} with…</p>
        {data.insights.length ? (
          <ul className="mt-2 space-y-1.5">
            {data.insights.slice(0, 4).map((insight) => (
              <li key={`${insight.field}:${insight.value}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold">{PARTNER_LABELS[insight.value] ?? insight.label}</span>
                <span className="text-xs text-[var(--ink-soft)]">{insight.wins}-{insight.losses} · <span className={`font-black ${percent(insight) >= 50 ? "text-[var(--lime)]" : "text-[var(--coral)]"}`}>{percent(insight)}%</span></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-[var(--ink-soft)]">Shows up once partners have picked their styles and you&apos;ve played {STYLE_MIN_GAMES}+ matches with them.</p>
        )}
      </div>
    </div>
  );
}
