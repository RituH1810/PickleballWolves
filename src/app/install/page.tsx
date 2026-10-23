"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Bell, CheckCircle2, Download, EllipsisVertical, Laptop, MonitorDown, Share, Smartphone, SquarePlus } from "lucide-react";
import { useInstallApp, type Platform } from "@/lib/install-app";
import { openInChromeUrl } from "@/lib/install-browser";

type Step = { icon: typeof Share; text: React.ReactNode };

const STEPS: Record<Platform, { title: string; icon: typeof Share; note?: string; steps: Step[] }> = {
  ios: {
    title: "iPhone & iPad",
    icon: Smartphone,
    note: "Use Safari -- other iPhone browsers can't install apps with notifications.",
    steps: [
      { icon: Share, text: <>Open this site in <strong>Safari</strong> and tap the <strong>Share</strong> button at the bottom of the screen (the square with an arrow).</> },
      { icon: SquarePlus, text: <>Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</> },
      { icon: Smartphone, text: <>Open <strong>Wolves</strong> from your home screen and sign in.</> },
      { icon: Bell, text: <>For notifications: go to <strong>Notifications → settings → Phone</strong> and tap <strong>Turn on for this device</strong>. (Needs iOS 16.4 or later.)</> },
    ],
  },
  android: {
    title: "Android",
    note: "Use Google Chrome -- installs from Edge, Brave, Opera, or Samsung Internet can be blocked by Google Play Protect.",
    icon: Smartphone,
    steps: [
      { icon: Download, text: <>Tap <strong>Install app</strong> above if you see it. Otherwise open this site in <strong>Chrome</strong>.</> },
      { icon: EllipsisVertical, text: <>Tap the <strong>⋮ menu</strong> (top right), then <strong>Install app</strong> or <strong>Add to Home screen</strong>, and confirm.</> },
      { icon: Smartphone, text: <>Open <strong>Wolves</strong> from your home screen or app drawer.</> },
      { icon: Bell, text: <>Go to <strong>Notifications → settings → Phone</strong> and tap <strong>Turn on for this device</strong>, then <strong>Allow</strong>.</> },
    ],
  },
  desktop: {
    title: "Computer",
    icon: Laptop,
    steps: [
      { icon: Download, text: <>Click <strong>Install app</strong> above if you see it (Chrome or Edge).</> },
      { icon: MonitorDown, text: <>Or click the <strong>install icon</strong> at the right end of the address bar (a monitor with a down arrow), then <strong>Install</strong>.</> },
      { icon: Bell, text: <>Turn on notifications in <strong>Notifications → settings → Phone</strong>.</> },
    ],
  },
};

const ORDER: Platform[] = ["ios", "android", "desktop"];

function Guide({ which, primary }: { which: Platform; primary: boolean }) {
  const guide = STEPS[which];
  return (
    <section className={`rounded-[20px] border bg-[var(--panel)] p-6 ${primary ? "border-[var(--lime-deep)]" : "border-[var(--line)]"}`}>
      <div className="flex items-center gap-2"><guide.icon size={18} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">{guide.title}</h2>{primary && <span className="rounded-full bg-[var(--lime)] px-2 py-0.5 text-[10px] font-black uppercase text-[#0f1712]">Your device</span>}</div>
      {guide.note && <p className="mt-2 text-xs text-[var(--ink-soft)]">{guide.note}</p>}
      <ol className="mt-4 space-y-3">
        {guide.steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#131f19] text-xs font-black text-[var(--lime-deep)]">{index + 1}</span>
            <p className="pt-1 text-sm leading-6 text-[var(--ink-soft)] [&_strong]:text-[var(--foreground)]"><step.icon size={14} className="mr-1.5 inline align-[-2px] text-[var(--lime-deep)]" />{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Step-by-step "add to home screen" guide, public so it can be shared before people sign up. */
export default function InstallPage() {
  const { ready, platform, installed, iosNotSafari, androidOtherBrowser, canPrompt, install } = useInstallApp();
  const [result, setResult] = useState("");

  const current = platform ?? "android";
  const others = ORDER.filter((entry) => entry !== current);

  async function installNow() {
    const accepted = await install();
    setResult(accepted ? "Installed! Open Wolves from your home screen or app list." : "No problem -- you can install any time from this page.");
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 noise sm:px-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--lime-deep)]"><ArrowLeft size={14} />PickleballWolves</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-[var(--lime-deep)]">Get the app</p>
        <h1 className="mt-2 break-words text-3xl font-black tracking-[-.04em] text-[var(--foreground)] sm:text-4xl">Install PickleballWolves.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Put Wolves on your home screen: it opens like an app, full screen, and can send game invites, reminders, and chat as phone notifications. Nothing to download from an app store.</p>

        {ready && installed ? (
          <div className="mt-8 flex items-start gap-3 rounded-[20px] border border-[var(--lime-deep)] bg-[#1e2b17] p-5">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[var(--lime)]" />
            <div>
              <p className="font-extrabold">You&apos;re using the installed app.</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">Turn on phone notifications in <Link href="/notifications/settings#phone" className="font-bold text-[var(--lime-deep)]">notification settings</Link> if you haven&apos;t yet.</p>
            </div>
          </div>
        ) : (
          <>
            {/* iPhones never offer a one-tap install; only show it where the browser does. */}
            {canPrompt && platform !== "ios" && (
              <button onClick={installNow} className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]"><Download size={17} />Install app</button>
            )}
            {ready && androidOtherBrowser && (
              <div className="mt-6 rounded-xl bg-[#2e1a16] px-4 py-3 text-sm font-semibold text-[#f2a08c]">
                <p>You&apos;re in {androidOtherBrowser}. On Android, install from <strong className="text-[#fbd3c7]">Google Chrome</strong> -- apps installed from other browsers can be blocked by Google Play Protect (&quot;Unsafe app blocked&quot;).</p>
                <a href={openInChromeUrl(`${window.location.origin}/install`)} className="mt-3 inline-flex h-10 items-center rounded-full bg-[var(--lime)] px-4 text-xs font-bold text-[#0f1712]">Open in Chrome</a>
              </div>
            )}
            {result && <p role="status" className="mt-3 text-sm font-bold text-[var(--lime-deep)]">{result}</p>}
            {ready && iosNotSafari && <p className="mt-6 rounded-xl bg-[#2e1a16] px-4 py-3 text-sm font-semibold text-[#f2a08c]">You&apos;re in Chrome or another app on iPhone. Copy this page&apos;s link and open it in <strong>Safari</strong> to install.</p>}
            <div className="mt-6 space-y-4">
              <Guide which={current} primary={ready} />
              {others.map((entry) => <Guide key={entry} which={entry} primary={false} />)}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
