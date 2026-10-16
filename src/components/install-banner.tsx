"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useInstallApp } from "@/lib/install-app";

const DISMISSED_KEY = "pw:installBannerDismissed";

/** "Get the app" nudge on the dashboard, until the player installs it or dismisses it. */
export function InstallBanner() {
  const { ready, installed, canPrompt, install } = useInstallApp();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      let seen = false;
      try { seen = window.localStorage.getItem(DISMISSED_KEY) === "1"; } catch { /* storage blocked: just show it */ }
      if (active) setDismissed(seen);
    });
    return () => { active = false; };
  }, []);

  function dismiss() {
    try { window.localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* fine */ }
    setDismissed(true);
  }

  if (!ready || installed || dismissed) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--lime)] text-xs font-black text-[#0f1712]">PW</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">Get the app</p>
        <p className="text-xs text-[var(--ink-soft)]">Add Wolves to your home screen for one-tap access and game notifications.</p>
      </div>
      <div className="flex items-center gap-2">
        {canPrompt
          ? <button onClick={() => install()} className="flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]"><Download size={14} />Install</button>
          : <Link href="/install" className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]">How to install</Link>}
        <button onClick={dismiss} aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[#1c2a1a]"><X size={15} /></button>
      </div>
    </div>
  );
}
