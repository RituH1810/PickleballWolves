"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";
import { isStandalonePath } from "@/lib/guest-access";

type Viewer = { signedIn: boolean; promptSignIn: () => void };
const ViewerContext = createContext<Viewer>({ signedIn: true, promptSignIn: () => {} });

/** Whether someone is signed in, and a way to ask a guest to sign in before an action. */
export function useViewer() {
  return useContext(ViewerContext);
}

const BROWSE_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/groups", label: "Groups" },
  { href: "/players", label: "Players" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/leagues", label: "Leagues" },
  { href: "/ladder", label: "Ladder" },
];

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

function requestPath(input: RequestInfo | URL) {
  const url = input instanceof Request ? input.url : input.toString();
  return new URL(url, window.location.origin).pathname;
}

/**
 * Lets signed-out visitors browse read-only: a slim bar with browse links and Sign in / Join, and
 * a prompt in place of any action (join, RSVP, score, create...). Every change goes through a
 * non-GET /api call, so a guest's is caught here and answered with the prompt -- the server
 * would refuse it anyway.
 */
export function GuestShell({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [prompting, setPrompting] = useState(false);
  const promptSignIn = useCallback(() => setPrompting(true), []);
  const guest = !signedIn && !isStandalonePath(pathname);
  // The dashboard has its own header with Sign in / Join.
  const showBar = guest && pathname !== "/dashboard";

  useEffect(() => {
    if (!guest) return;
    const original = window.fetch;
    window.fetch = (input, init) => {
      const method = requestMethod(input, init);
      if (method !== "GET" && method !== "HEAD" && requestPath(input).startsWith("/api/")) {
        setPrompting(true);
        return Promise.resolve(new Response(JSON.stringify({ error: "Sign in to do that." }), { status: 401, headers: { "Content-Type": "application/json" } }));
      }
      return original(input, init);
    };
    return () => { window.fetch = original; };
  }, [guest]);

  const next = encodeURIComponent(pathname);
  return (
    <ViewerContext.Provider value={{ signedIn, promptSignIn }}>
      {showBar && (
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#0f1712]/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6">
            <Link href="/dashboard" className="shrink-0 text-sm font-extrabold tracking-tight">Pickleball<span className="text-[var(--lime-deep)]">Wolves</span></Link>
            <nav aria-label="Browse" className="flex min-w-0 flex-1 gap-1 overflow-x-auto text-xs font-bold [scrollbar-width:none]">
              {BROWSE_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={`shrink-0 rounded-full px-2.5 py-1.5 ${pathname === link.href || pathname.startsWith(`${link.href}/`) ? "bg-[#1c2a1a] text-[var(--lime-deep)]" : "text-[var(--ink-soft)] hover:text-[var(--foreground)]"}`}>{link.label}</Link>
              ))}
            </nav>
            <Link href={`/login?next=${next}`} className="hidden shrink-0 text-xs font-bold text-[var(--foreground)] hover:text-[var(--lime-deep)] sm:block">Sign in</Link>
            <Link href={`/signup?next=${next}`} className="shrink-0 rounded-full bg-[var(--lime)] px-3.5 py-1.5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043]"><span className="sm:hidden">Sign in</span><span className="hidden sm:inline">Join free</span></Link>
          </div>
        </header>
      )}
      {children}
      {prompting && (
        <div role="dialog" aria-modal="true" aria-labelledby="sign-in-prompt-title" className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 sm:place-items-center" onClick={() => setPrompting(false)}>
          <div className="w-full max-w-sm rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--lime)] text-[#0f1712]"><LogIn size={18} /></span>
              <button type="button" onClick={() => setPrompting(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[#1c2a1a]"><X size={16} /></button>
            </div>
            <h2 id="sign-in-prompt-title" className="mt-4 text-xl font-black tracking-[-.03em]">Sign in to join in</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">You&apos;re browsing as a guest. With a free account you can join groups, RSVP to games, record scores, and start your own round robins and tournaments.</p>
            <div className="mt-6 grid gap-2">
              <Link href={`/login?next=${next}`} className="flex h-11 items-center justify-center rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">Sign in</Link>
              <Link href={`/signup?next=${next}`} className="flex h-11 items-center justify-center rounded-full border border-[var(--line)] text-sm font-bold hover:bg-[#1c2a1a]">Create a free account</Link>
              <button type="button" onClick={() => setPrompting(false)} className="h-10 text-xs font-bold text-[var(--ink-soft)] hover:text-[var(--foreground)]">Keep browsing</button>
            </div>
          </div>
        </div>
      )}
    </ViewerContext.Provider>
  );
}

