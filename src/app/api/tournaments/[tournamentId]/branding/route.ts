import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isHexColor, isValidSlug, slugify } from "@/lib/branding";

const MAX_SPONSORS = 8;

async function ownedTournament(tournamentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: { sponsors: { orderBy: { position: "asc" } }, createdBy: { select: { name: true } } } });
  if (!tournament) return { error: NextResponse.json({ error: "Tournament not found." }, { status: 404 }) };
  if (tournament.createdById !== user.id) return { error: NextResponse.json({ error: "Only the organizer can change branding." }, { status: 403 }) };
  return { tournament };
}

function serialize(tournament: { isPublic: boolean; publicSlug: string | null; brandColor: string | null; presentedBy: string | null; logoAssetId: string | null; bannerAssetId: string | null; name: string; createdBy: { name: string }; sponsors: { id: string; name: string; url: string | null; logoAssetId: string | null }[] }) {
  return {
    isPublic: tournament.isPublic,
    publicSlug: tournament.publicSlug ?? slugify(tournament.name),
    brandColor: tournament.brandColor,
    presentedBy: tournament.presentedBy ?? tournament.createdBy.name,
    logoAssetId: tournament.logoAssetId,
    bannerAssetId: tournament.bannerAssetId,
    sponsors: tournament.sponsors.map(({ id, name, url, logoAssetId }) => ({ id, name, url, logoAssetId })),
  };
}

export async function GET(_request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const result = await ownedTournament(tournamentId);
  if ("error" in result) return result.error;
  return NextResponse.json({ branding: serialize(result.tournament) });
}

/**
 * Saves the organizer's branding and public-page settings. Branding can change any time, even
 * after scores are in. Images not used anymore are deleted.
 */
export async function PATCH(request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const result = await ownedTournament(tournamentId);
  if ("error" in result) return result.error;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const ownAssetIds = new Set((await prisma.tournamentAsset.findMany({ where: { tournamentId }, select: { id: true } })).map((asset) => asset.id));
  const asset = (value: unknown) => (typeof value === "string" && ownAssetIds.has(value) ? value : null);
  const isPublic = Boolean(body.isPublic);
  const publicSlug = typeof body.publicSlug === "string" ? body.publicSlug.trim().toLowerCase() : "";
  if (isPublic && !isValidSlug(publicSlug)) return NextResponse.json({ error: "The page link can use lowercase letters, numbers, and dashes (3-60 characters)." }, { status: 400 });
  if (publicSlug && isValidSlug(publicSlug)) {
    const taken = await prisma.tournament.findFirst({ where: { publicSlug, id: { not: tournamentId } }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "That page link is taken -- try adding the year or your club name." }, { status: 409 });
  }
  if (body.brandColor && !isHexColor(body.brandColor)) return NextResponse.json({ error: "Pick a color like #d8f24e." }, { status: 400 });

  const sponsors = (Array.isArray(body.sponsors) ? body.sponsors : []).slice(0, MAX_SPONSORS).flatMap((sponsor: { name?: unknown; url?: unknown; logoAssetId?: unknown }, position: number) => {
    const name = typeof sponsor?.name === "string" ? sponsor.name.trim().slice(0, 60) : "";
    if (!name) return [];
    const rawUrl = typeof sponsor.url === "string" ? sponsor.url.trim() : "";
    const url = rawUrl ? (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).slice(0, 300) : null;
    return [{ tournamentId, name, url, logoAssetId: asset(sponsor.logoAssetId), position }];
  });

  const presentedBy = typeof body.presentedBy === "string" ? body.presentedBy.trim().slice(0, 80) || null : null;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.tournamentSponsor.deleteMany({ where: { tournamentId } });
    if (sponsors.length) await tx.tournamentSponsor.createMany({ data: sponsors });
    return tx.tournament.update({
      where: { id: tournamentId },
      data: { isPublic, publicSlug: isValidSlug(publicSlug) ? publicSlug : null, brandColor: body.brandColor || null, presentedBy, logoAssetId: asset(body.logoAssetId), bannerAssetId: asset(body.bannerAssetId) },
      include: { sponsors: { orderBy: { position: "asc" } }, createdBy: { select: { name: true } } },
    });
  });

  // Drop uploads that ended up unused (replaced logo, removed sponsor...).
  const inUse = [updated.logoAssetId, updated.bannerAssetId, ...updated.sponsors.map((sponsor) => sponsor.logoAssetId)].filter((id): id is string => Boolean(id));
  await prisma.tournamentAsset.deleteMany({ where: { tournamentId, id: { notIn: inUse } } });
  return NextResponse.json({ branding: serialize(updated) });
}
