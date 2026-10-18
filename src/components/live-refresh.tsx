"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches a server-rendered page every `seconds` while it's visible (live scores). */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
