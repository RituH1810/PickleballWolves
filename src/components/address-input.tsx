"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { placeText, type PlaceSuggestion } from "@/lib/places";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

/**
 * A location field with address suggestions (free OpenStreetMap search) as you type. Typing any
 * free text still works -- suggestions only help fill it in. Arrow keys and Enter pick one.
 */
export function AddressInput({ value, onChange, placeholder, className, ariaLabel }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string; ariaLabel?: string }) {
  const [results, setResults] = useState<{ q: string; places: PlaceSuggestion[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const q = value.trim();

  useEffect(() => {
    if (!open || q.length < MIN_CHARS) return;
    const timer = setTimeout(() => {
      fetch(`/api/places?q=${encodeURIComponent(q)}`).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setResults({ q, places: data.places ?? [] }); });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, open]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const places = open && q.length >= MIN_CHARS && results?.q === q ? results.places : [];

  function pick(place: PlaceSuggestion) {
    onChange(placeText(place));
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!places.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % places.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index <= 0 ? places.length - 1 : index - 1)); }
    else if (event.key === "Enter" && active >= 0) { event.preventDefault(); pick(places[active]); }
    else if (event.key === "Escape") setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={places.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={className}
      />
      {places.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[var(--line)] bg-[#0f1712] shadow-lg">
          <ul id={listId} role="listbox">
            {places.map((place, index) => (
              <li key={placeText(place)} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(place)} className={`flex w-full items-start gap-2 px-3 py-2.5 text-left ${index === active ? "bg-[#1c2a1a]" : "hover:bg-[#1c2a1a]"}`}>
                  <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--lime-deep)]" />
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-[var(--foreground)]">{place.label}</span>{place.detail && <span className="block truncate text-[11px] text-[var(--ink-soft)]">{place.detail}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-[var(--line)] px-3 py-1.5 text-[10px] text-[var(--ink-soft)]">Search by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap</a> contributors</p>
        </div>
      )}
    </div>
  );
}
