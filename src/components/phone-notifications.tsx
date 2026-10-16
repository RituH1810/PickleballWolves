"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone } from "lucide-react";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/lib/push-client";

type State = "loading" | "unsupported" | "install-first" | "off" | "on";

/**
 * Turn phone notifications on/off for this device. On iPhone, push only works once the app is on
 * the home screen, so it shows how to install it first.
 */
export function PhoneNotifications() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // What this device can do is only knowable in the browser, so work it out after mounting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const support = pushSupport();
      let next: State;
      if (support.ios && !support.installed) next = "install-first";
      else if (!support.supported) next = "unsupported";
      else next = await currentSubscription().then((subscription) => (subscription && Notification.permission === "granted" ? "on" : "off"), () => "off" as const);
      if (!cancelled) setState(next);
    })();
    return () => { cancelled = true; };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      await enablePush();
      setState("on");
      setMessage({ text: "Phone notifications are on for this device.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Couldn't turn on notifications.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    await disablePush().catch(() => undefined);
    setBusy(false);
    setState("off");
    setMessage({ text: "Phone notifications are off for this device.", error: false });
  }

  async function test() {
    setMessage(null);
    const response = await fetch("/api/push/test", { method: "POST" });
    setMessage(response.ok ? { text: "Test sent -- it should arrive in a few seconds.", error: false } : { text: "Couldn't send a test.", error: true });
  }

  const button = "rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50";
  return (
    <section id="phone" className="mt-6 scroll-mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-2">
      <h2 className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-[.14em] text-[var(--ink-soft)]">Phone</h2>
      <div className="flex items-start gap-4 px-4 pb-4 pt-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#131f19] text-[var(--lime-deep)]"><Smartphone size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[var(--foreground)]">Phone notifications</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--ink-soft)]">Get invites, reminders, game chat, and recaps as real notifications on this device. Your choices above still apply.</p>

          {state === "install-first" && (
            <div className="mt-3 rounded-xl bg-[#131f19] p-3 text-xs leading-5 text-[var(--foreground)]">
              <p className="font-bold">First, add PickleballWolves to your home screen:</p>
              <p className="mt-1 text-[var(--ink-soft)]">In Safari, tap <Share size={12} className="inline align-[-2px]" /> <strong className="text-[var(--foreground)]">Share</strong>, then <strong className="text-[var(--foreground)]">Add to Home Screen</strong>. Open Wolves from your home screen and come back here to turn notifications on.</p>
            </div>
          )}
          {state === "unsupported" && <p className="mt-3 text-xs text-[var(--ink-soft)]">This browser can&apos;t receive push notifications. Try Chrome, Edge, Firefox, or Safari on a recent device.</p>}
          {(state === "off" || state === "on") && (
            <div className="mt-3 flex flex-wrap gap-2">
              {state === "off"
                ? <button onClick={turnOn} disabled={busy} className={`${button} bg-[var(--lime)] text-[#0f1712] hover:bg-[#c3e043]`}>{busy ? "Turning on..." : "Turn on for this device"}</button>
                : <>
                    <button onClick={test} className={`${button} bg-[var(--lime)] text-[#0f1712] hover:bg-[#c3e043]`}>Send a test</button>
                    <button onClick={turnOff} disabled={busy} className={`${button} border border-[var(--line)] text-[var(--foreground)] hover:bg-[#1c2a1a]`}>Turn off</button>
                  </>}
            </div>
          )}
          {message && <p role={message.error ? "alert" : "status"} className={`mt-2 text-xs font-bold ${message.error ? "text-[var(--coral)]" : "text-[var(--lime-deep)]"}`}>{message.text}</p>}
        </div>
      </div>
    </section>
  );
}
