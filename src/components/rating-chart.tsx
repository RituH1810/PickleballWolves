"use client";

import { useEffect, useRef, useState } from "react";

export type RatingPoint = { at: string; rating: number; delta: number };

const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 26, left: 34 };

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDelta(delta: number) {
  return `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${Math.abs(delta).toFixed(2)}`;
}

/**
 * Skill rating over time as a single line. The starting rating is plotted as point zero so the
 * first match's change is visible. Hover (or arrow keys when focused) snaps a crosshair to the
 * nearest match; a visually hidden table carries the same data for screen readers.
 */
export function RatingChart({ start, points }: { start: number; points: RatingPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const series = [{ at: points[0].at, rating: start, delta: 0 }, ...points];
  const ratings = series.map((point) => point.rating);
  // Clean 0.5 steps around the data, never narrower than 1.0 so small wobbles don't look dramatic.
  let min = Math.floor(Math.min(...ratings) * 2) / 2;
  let max = Math.ceil(Math.max(...ratings) * 2) / 2;
  if (max - min < 1) { const mid = (min + max) / 2; min = Math.floor((mid - 0.5) * 2) / 2; max = min + 1; }
  const ticks: number[] = [];
  for (let tick = min; tick <= max + 1e-9; tick += max - min > 2 ? 1 : 0.5) ticks.push(tick);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth);
  const y = (rating: number) => PAD.top + (1 - (rating - min) / (max - min)) * plotHeight;
  const path = series.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.rating).toFixed(1)}`).join("");

  function pick(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (clientX - rect.left - PAD.left) / plotWidth;
    setActive(Math.min(series.length - 1, Math.max(0, Math.round(ratio * (series.length - 1)))));
  }

  function handleKey(event: React.KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    setActive((current) => Math.min(series.length - 1, Math.max(0, (current ?? series.length - 1) + step)));
  }

  const point = active === null ? null : series[active];
  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active) - 70, 0), Math.max(width - 140, 0));

  return (
    <div ref={containerRef} className="relative mt-5 select-none" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Skill rating over ${points.length} matches, from ${start.toFixed(2)} to ${points[points.length - 1].rating.toFixed(2)}. Use left and right arrow keys to step through matches.`}
          tabIndex={0}
          onPointerMove={(event) => pick(event.clientX)}
          onPointerDown={(event) => pick(event.clientX)}
          onPointerLeave={() => setActive(null)}
          onKeyDown={handleKey}
          onBlur={() => setActive(null)}
          className="touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)] rounded-xl"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--ink-soft)">{tick.toFixed(1)}</text>
            </g>
          ))}
          <text x={x(0)} y={HEIGHT - 6} textAnchor="start" fontSize={10} fill="var(--ink-soft)">{formatDate(series[0].at)}</text>
          {formatDate(series[series.length - 1].at) !== formatDate(series[0].at) && <text x={x(series.length - 1)} y={HEIGHT - 6} textAnchor="end" fontSize={10} fill="var(--ink-soft)">{formatDate(series[series.length - 1].at)}</text>}

          <path d={path} fill="none" stroke="var(--lime)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Mark the latest rating; the tooltip covers every other point. */}
          <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].rating)} r={4} fill="var(--lime)" stroke="var(--panel)" strokeWidth={2} />

          {active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(active)} cy={y(series[active].rating)} r={5} fill="var(--lime)" stroke="var(--panel)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      {point && active !== null && (
        <div className="pointer-events-none absolute top-0 w-[140px] rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 py-2 shadow-lg" style={{ left: tooltipLeft }}>
          <p className="text-lg font-black leading-none">{point.rating.toFixed(2)}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
            {active === 0 ? "Starting rating" : <>{formatDate(point.at)} · <span className={point.delta > 0 ? "text-[var(--lime-deep)]" : point.delta < 0 ? "text-[var(--coral)]" : ""}>{formatDelta(point.delta)}</span></>}
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>Skill rating after each match</caption>
        <thead><tr><th>Date</th><th>Rating</th><th>Change</th></tr></thead>
        <tbody>{points.map((entry, index) => <tr key={index}><td>{formatDate(entry.at)}</td><td>{entry.rating.toFixed(2)}</td><td>{formatDelta(entry.delta)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
