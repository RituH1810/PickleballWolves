"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { RatingChart, type RatingPoint } from "@/components/rating-chart";
import { CardHeading } from "@/components/card-heading";

/** How close to the peak counts as "within reach". */
const PEAK_NUDGE_WITHIN = 0.05;

/** Rating history card with current / peak / change stats. Omit userId for the signed-in player. */
export function RatingHistoryPanel({ userId, isMe = !userId }: { userId?: string; isMe?: boolean }) {
  const [ratingHistory, setRatingHistory] = useState<{ start: number | null; points: RatingPoint[] } | null>(null);

  useEffect(() => {
    fetch(userId ? `/api/rating-history?userId=${encodeURIComponent(userId)}` : "/api/rating-history").then((response) => response.ok ? response.json() : null).then((historyData) => { if (historyData) setRatingHistory(historyData); });
  }, [userId]);

  if (!ratingHistory) return null;
  const ratingPoints = ratingHistory.points;
  const ratingStart = ratingHistory.start;
  const peakRating = ratingPoints.length ? Math.max(ratingStart ?? 0, ...ratingPoints.map((point) => point.rating)) : null;
  // When the peak was first reached (null if it's still the starting rating).
  const peakPoint = peakRating !== null ? ratingPoints.find((point) => point.rating === peakRating) ?? null : null;
  const current = ratingPoints.at(-1)?.rating ?? null;
  const belowPeak = peakRating !== null && current !== null ? peakRating - current : 0;
  const ratingChange = ratingPoints.length && ratingStart !== null ? ratingPoints[ratingPoints.length - 1].rating - ratingStart : null;

  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <CardHeading icon={TrendingUp} title="Rating history" />
        {ratingPoints.length > 0 && peakRating !== null && ratingChange !== null && (
          <dl className="flex gap-6 text-right">
            <div><dt className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Current</dt><dd className="mt-1 text-lg font-black">{ratingPoints[ratingPoints.length - 1].rating.toFixed(3)}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Peak</dt><dd className="mt-1 text-lg font-black text-[#f5c542]">{peakRating.toFixed(3)}</dd>{peakPoint && <dd className="text-xs text-[var(--ink-soft)]">{new Date(peakPoint.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</dd>}</div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Change</dt><dd className={`mt-1 text-lg font-black ${ratingChange > 0 ? "text-[var(--lime-deep)]" : ratingChange < 0 ? "text-[var(--coral)]" : ""}`}>{ratingChange > 0 ? "+" : ratingChange < 0 ? "−" : ""}{Math.abs(ratingChange).toFixed(3)}</dd></div>
          </dl>
        )}
      </div>
      {peakPoint && belowPeak < 1e-9 && ratingPoints.length > 1 && <p className="mt-3 rounded-xl bg-[#2a2510] px-3 py-2 text-xs font-bold text-[#f5c542]">{!isMe ? "At their highest rating ever." : "You're at your highest rating ever -- keep it going!"}</p>}
      {/* A gentle nudge when the peak is within reach (about one good night). */}
      {peakPoint && belowPeak >= 1e-9 && belowPeak <= PEAK_NUDGE_WITHIN && <p className="mt-3 rounded-xl bg-[#2a2510] px-3 py-2 text-xs font-bold text-[#f5c542]">{!isMe ? `${belowPeak.toFixed(3)} off their peak.` : `Just ${belowPeak.toFixed(3)} off your peak -- one good night could beat it.`}</p>}
      {ratingPoints.length > 0 && ratingStart !== null
        ? <RatingChart start={ratingStart} points={ratingPoints} />
        : <p className="mt-4 text-sm text-[var(--ink-soft)]">{userId ? "No scored matches yet." : "Your rating chart starts with your first scored match."}</p>}
    </section>
  );
}
