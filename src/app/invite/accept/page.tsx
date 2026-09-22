"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PawPrint } from "lucide-react";

function AcceptInvite() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"working" | "error">("working");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/groups/invites/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(async (response) => {
      if (response.status === 401) { router.push(`/signup?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`); return; }
      const data = await response.json();
      if (!response.ok) { setStatus("error"); setError(data.error ?? "Unable to accept this invite."); return; }
      router.push(`/groups/${data.groupId}`);
    }).catch(() => { setStatus("error"); setError("Unable to accept this invite."); });
  }, [token, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 noise">
      <section className="w-full max-w-md rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-8 text-center shadow-[0_18px_50px_rgba(0,0,0,.35)]">
        <PawPrint size={22} className="mx-auto text-[var(--lime-deep)]" />
        {status === "working" ? (
          <>
            <h1 className="mt-4 text-xl font-black tracking-[-.03em] text-[var(--foreground)]">Joining the group...</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">Hang tight while we add you.</p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-black tracking-[-.03em] text-[var(--foreground)]">Couldn&apos;t accept this invite</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">{error}</p>
            <Link href="/dashboard" className="mt-5 inline-block text-sm font-bold text-[var(--lime-deep)]">Go to dashboard</Link>
          </>
        )}
      </section>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 noise"><div className="skeleton h-40 w-full max-w-md rounded-[24px]" /></main>}>
      <AcceptInvite />
    </Suspense>
  );
}
