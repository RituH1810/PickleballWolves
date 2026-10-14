"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Bell, Mail, Swords, type LucideIcon } from "lucide-react";

type PreferenceKey = "emailReminders" | "inAppReminders" | "challengeAlerts" | "scoreDisputeAlerts";
type Preferences = Record<PreferenceKey, boolean>;

const SECTIONS: { title: string; items: { key: PreferenceKey; label: string; detail: string; icon: LucideIcon }[] }[] = [
  {
    title: "Game reminders",
    items: [
      { key: "emailReminders", label: "Email reminders", detail: "An email about an hour before a game or round robin you've joined.", icon: Mail },
      { key: "inAppReminders", label: "In-app reminders", detail: "The same reminder in your notifications inbox.", icon: Bell },
    ],
  },
  {
    title: "Alerts",
    items: [
      { key: "challengeAlerts", label: "Ladder challenges", detail: "When someone challenges you, or accepts or declines your challenge.", icon: Swords },
      { key: "scoreDisputeAlerts", label: "Score disputes", detail: "When someone disputes the score of a match you played.", icon: AlertTriangle },
    ],
  },
];

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState<PreferenceKey | null>(null);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences").then(async (response) => {
      if (!response.ok) { setFailed(true); return; }
      const data = await response.json();
      setPreferences(data.preferences);
    }).catch(() => setFailed(true));
  }, []);

  function showNotice(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 2500);
  }

  // Optimistic: flip immediately, roll back if the save fails.
  async function toggle(key: PreferenceKey) {
    if (!preferences || saving) return;
    const next = !preferences[key];
    setPreferences({ ...preferences, [key]: next });
    setSaving(key);
    try {
      const response = await fetch("/api/notifications/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: next }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPreferences(data.preferences);
      showNotice("Saved");
    } catch {
      setPreferences((current) => current ? { ...current, [key]: !next } : current);
      showNotice("Couldn't save -- try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 noise sm:px-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/notifications" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />Back to notifications</Link>
        <h1 className="mt-6 text-3xl font-black tracking-[-.04em] text-[var(--lime)]">Notification settings</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">Choose what PickleballWolves sends you. Changes save automatically.</p>

        {failed ? (
          <p className="mt-8 text-sm text-[var(--ink-soft)]">Couldn&apos;t load your settings. Refresh to try again.</p>
        ) : !preferences ? (
          <p className="mt-8 text-sm text-[var(--ink-soft)]">Loading settings...</p>
        ) : (
          <>
            {SECTIONS.map((section) => (
              <section key={section.title} className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-2">
                <h2 className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">{section.title}</h2>
                {section.items.map(({ key, label, detail, icon: Icon }) => {
                  const on = preferences[key];
                  return (
                    <label key={key} className="flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-4 hover:bg-[#1c2a1a]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#131f19] text-[var(--lime-deep)]"><Icon size={18} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-[var(--foreground)]">{label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-[var(--ink-soft)]">{detail}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={label}
                        disabled={saving === key}
                        onClick={() => toggle(key)}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-[var(--lime)]" : "bg-[#2c4234]"}`}
                      >
                        <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${on ? "left-6 bg-[#0f1712]" : "left-1 bg-[var(--ink-soft)]"}`} />
                      </button>
                    </label>
                  );
                })}
              </section>
            ))}
            <p className="mt-5 px-1 text-xs leading-5 text-[var(--ink-soft)]">Group updates -- new games, join approvals, scores added to your matches, and being added to an event -- always appear in your inbox.</p>
          </>
        )}

        {notice && <p role="status" className="mt-4 text-xs font-bold text-[var(--lime-deep)]">{notice}</p>}
      </div>
    </main>
  );
}
