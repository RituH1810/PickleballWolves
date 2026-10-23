import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bragSecret, decodeBragCode } from "@/lib/brag";
import { bragDescription, bragHeadline, loadBragView } from "@/lib/load-brag";

async function load(code: string) {
  const card = decodeBragCode(code, bragSecret());
  const view = card ? await loadBragView(card) : null;
  return card && view ? { card, view } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const loaded = await load(code);
  if (!loaded) return { title: "PickleballWolves" };
  const title = bragHeadline(loaded.view);
  const description = bragDescription(loaded.view);
  const image = { url: `/brag/${code}/image`, width: 1200, height: 630, alt: title };
  return {
    title: `${title} · PickleballWolves`,
    description,
    openGraph: { title, description, type: "website", siteName: "PickleballWolves", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

/** A card a player shared -- public, so friends who aren't members can see it (and join). */
export default async function BragPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const loaded = await load(code);
  if (!loaded) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // For signed-in viewers: the thing the card is about (the game, the group's month), or the player.
  const { card } = loaded;
  const destination = card.kind === "roundRobin" ? { href: `/round-robin/${card.roundRobinId}`, label: "See the round robin" }
    : card.kind === "leaderboard" ? { href: `/groups/${card.groupId}?month=${card.month}#monthly-leaderboard`, label: "See the leaderboard" }
    : user?.id === card.userId ? { href: "/profile", label: "Your profile" } : { href: `/players/${card.userId}`, label: "See their profile" };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-10">
      <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--lime-deep)]">PickleballWolves</p>
      <h1 className="mt-2 text-2xl font-black tracking-[-.03em] sm:text-3xl">{bragHeadline(loaded.view)}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG, already the right size */}
      <img src={`/brag/${code}/image`} alt={bragHeadline(loaded.view)} width={1200} height={630} className="mt-6 h-auto w-full rounded-[20px] border border-[var(--line)]" />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a href={`/brag/${code}/image?download`} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-bold hover:bg-[#1c2a1a]"><Download size={15} />Download image</a>
        {user ? (
          <Link href={destination.href} className="rounded-full bg-[var(--lime)] px-4 py-2.5 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">{destination.label}</Link>
        ) : (
          <Link href="/signup" className="rounded-full bg-[var(--lime)] px-4 py-2.5 text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">Join PickleballWolves</Link>
        )}
      </div>
    </main>
  );
}
