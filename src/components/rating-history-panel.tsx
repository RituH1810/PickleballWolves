"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { RatingChart, type RatingPoint } from "@/components/rating-chart";

/** Rating history card with current / peak / change stats. Omit userId for the signed-in player. */
export function RatingHistoryPanel({ userId }: { userId?: string }) {
  const [ratingHistory, setRatingHistory] = useState<{ start: number | null; points: RatingPoint[] } | null>(null);

  useEffect(() => {
    fetch(userId ? `/api/rating-history?userId=${encodeURIComponent(userId)}` : "/api/rating-history").then((response) => response.ok ? response.json() : null).then((historyData) => { if (historyData) setRatingHistory(historyData); });
  }, [userId]);

  if (!ratingHistory) return null;
  const ratingPoints = ratingHistory.points;
  const ratingStart = ratingHistory.start;
  const peakRating = ratingPoints.length ? Math.max(ratingStart ?? 0, ...ratingPoints.map((point) => point.rating)) : null;
  const ratingChange = ratingPoints.length && ratingStart !== null ? ratingPoints[ratingPoints.length - 1].rating - ratingStart : null;

  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2"><TrendingUp size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Rating history</h2></div>
        {ratingPoints.length > 0 && peakRating !== null && ratingChange !== null && (
          <dl className="flex gap-6 text-right">
            <div><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Current</dt><dd className="mt-1 text-lg font-black">{ratingPoints[ratingPoints.length - 1].rating.toFixed(2)}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Peak</dt><dd className="mt-1 text-lg font-black">{peakRating.toFixed(2)}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">Change</dt><dd className={`mt-1 text-lg font-black ${ratingChange > 0 ? "text-[var(--lime-deep)]" : ratingChange < 0 ? "text-[var(--coral)]" : ""}`}>{ratingChange > 0 ? "+" : ratingChange < 0 ? "−" : ""}{Math.abs(ratingChange).toFixed(2)}</dd></div>
          </dl>
        )}
      </div>
      {ratingPoints.length > 0 && ratingStart !== null
        ? <RatingChart start={ratingStart} points={ratingPoints} />
        : <p className="mt-4 text-sm text-[var(--ink-soft)]">{userId ? "No scored matches yet." : "Your rating chart starts with your first scored match."}</p>}
    </section>
  );
}
