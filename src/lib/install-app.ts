"use client";

import { useEffect, useState } from "react";

export type Platform = "ios" | "android" | "desktop";

/** Chrome/Edge's install prompt event (not in the standard DOM types yet). */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function detect() {
  const agent = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch screen gives it away.
  const ios = /iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
  const platform: Platform = ios ? "ios" : /Android/i.test(agent) ? "android" : "desktop";
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // On iPhone only Safari can add to the home screen with full app behavior.
  const iosNotSafari = ios && /CriOS|FxiOS|EdgiOS|GSA\//.test(agent);
  return { platform, installed, iosNotSafari };
}

/**
 * Where the visitor is and whether the app is already installed, plus the browser's one-tap
 * install prompt when it offers one (Chrome/Edge on Android and desktop). `install()` shows it.
 */
export function useInstallApp() {
  const [state, setState] = useState<{ platform: Platform; installed: boolean; iosNotSafari: boolean } | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) setState(detect()); });
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const onInstalled = () => { setPrompt(null); setState((current) => (current ? { ...current, installed: true } : current)); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { active = false; window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    return outcome === "accepted";
  }

  return { ...state, ready: state !== null, canPrompt: prompt !== null, install };
}
