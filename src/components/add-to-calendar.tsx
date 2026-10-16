"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Download, Repeat } from "lucide-react";
import { buildIcs, googleCalendarUrl, type CalendarItem } from "@/lib/calendar";

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "pickleball";
}

/**
 * "Add to calendar" menu: Google Calendar for a single game, plus an .ics download that Apple
 * Calendar, Outlook, and Google all import. Several items (e.g. a league schedule) only offer the
 * .ics, since Google's link adds one event at a time. `compact` renders an icon-only trigger.
 * Item urls may be app paths ("/round-robin/abc"); they're made absolute when the menu is used.
 */
export function AddToCalendar({ items, label = "Add to calendar", compact = false, fileName }: { items: CalendarItem[]; label?: string; compact?: boolean; fileName?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  if (!items.length) return null;

  const absolute = () => items.map((item) => ({ ...item, url: item.url ? new URL(item.url, window.location.origin).toString() : item.url }));

  function downloadIcs() {
    const blob = new Blob([buildIcs(absolute())], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName ?? slug(items[0].title)}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setOpen(false);
  }

  const itemClass = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-[var(--foreground)] hover:bg-[#1c2a1a]";
  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        className={compact
          ? "grid h-7 w-7 place-items-center rounded-full border border-[var(--line)] text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]"
          : "flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[#1c2a1a]"}
      >
        <CalendarPlus size={compact ? 13 : 14} />{!compact && label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[var(--line)] bg-[#0f1712] p-1.5 shadow-lg">
          {items.length === 1 && (
            <a role="menuitem" href={googleCalendarUrl(absolute()[0])} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={itemClass}>
              <CalendarPlus size={14} className="text-[var(--lime-deep)]" />Google Calendar
            </a>
          )}
          <button role="menuitem" type="button" onClick={downloadIcs} className={itemClass}>
            <Download size={14} className="text-[var(--lime-deep)]" />{items.length === 1 ? "Apple / Outlook (.ics)" : `Download ${items.length} games (.ics)`}
          </button>
          <a role="menuitem" href="/notifications/settings#calendar" onClick={() => setOpen(false)} className={`${itemClass} border-t border-[var(--line)] text-[var(--ink-soft)]`}>
            <Repeat size={14} className="text-[var(--lime-deep)]" />Subscribe to all your games
          </a>
        </div>
      )}
    </div>
  );
}
