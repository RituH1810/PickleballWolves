"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Copy, RefreshCw } from "lucide-react";

type Links = { https: string; webcal: string; google: string };

/**
 * The player's private calendar feed: subscribe once in Google / Apple / Outlook and every game
 * they join shows up and stays in sync. The link is the credential, so it can be reset.
 */
export function CalendarSubscription() {
  const [links, setLinks] = useState<Links | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/link").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.https) setLinks(data); });
  }, []);

  async function copy() {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.https);
      setMessage({ text: "Link copied. Paste it into your calendar app's \"subscribe\" / \"from URL\" option.", error: false });
    } catch {
      setMessage({ text: "Couldn't copy -- select the link above instead.", error: true });
    }
  }

  async function reset() {
    if (!window.confirm("Reset your calendar link? Calendars subscribed with the old link will stop updating until you subscribe again.")) return;
    setResetting(true);
    const response = await fetch("/api/calendar/link", { method: "POST" });
    const data = await response.json().catch(() => null);
    setResetting(false);
    if (!response.ok || !data?.https) { setMessage({ text: "Couldn't reset the link.", error: true }); return; }
    setLinks(data);
    setMessage({ text: "New link ready. The old one no longer works -- subscribe again with this one.", error: false });
  }

  const button = "flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition-colors";
  return (
    <section id="calendar" className="mt-6 scroll-mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-2">
      <h2 className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Calendar</h2>
      <div className="px-4 pb-4">
        <p className="text-sm font-extrabold text-[var(--foreground)]">Subscribe to your games</p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--ink-soft)]">Add this once and every round robin, event, and league match you join appears in your calendar -- and updates when times change or games are cancelled. Calendar apps usually refresh every few hours.</p>
        {!links ? <p className="mt-3 text-xs text-[var(--ink-soft)]">Loading your link...</p> : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a href={links.google} target="_blank" rel="noopener noreferrer" className={`${button} bg-[var(--lime)] text-[#0f1712] hover:bg-[#c3e043]`}><CalendarPlus size={14} />Add to Google Calendar</a>
              <a href={links.webcal} className={`${button} border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]`}><CalendarPlus size={14} />Apple / Outlook</a>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[#0f1712] p-1.5 pl-3">
              <input readOnly value={links.https} onFocus={(event) => event.currentTarget.select()} aria-label="Your private calendar link" className="min-w-0 flex-1 bg-transparent text-xs text-[var(--ink-soft)] outline-none" />
              <button onClick={copy} className={`${button} shrink-0 border border-[var(--line)] py-1.5 text-[var(--foreground)] hover:bg-[#1c2a1a]`}><Copy size={13} />Copy</button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--ink-soft)]">Keep this link private -- anyone with it can see your schedule.</p>
              <button onClick={reset} disabled={resetting} className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--coral)] hover:underline disabled:opacity-50"><RefreshCw size={12} />{resetting ? "Resetting..." : "Reset link"}</button>
            </div>
          </>
        )}
        {message && <p role={message.error ? "alert" : "status"} className={`mt-2 text-xs font-bold ${message.error ? "text-[var(--coral)]" : "text-[var(--lime-deep)]"}`}>{message.text}</p>}
      </div>
    </section>
  );
}
