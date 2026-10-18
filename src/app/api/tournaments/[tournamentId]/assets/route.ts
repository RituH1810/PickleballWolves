import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { assetUrl } from "@/lib/branding";

// The browser shrinks images before upload, so anything near this is already generous.
const MAX_BYTES = 1_500_000;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const KINDS = new Set(["LOGO", "BANNER", "SPONSOR"]);

// Organizer uploads a branding image; it's only shown once saved into the branding (PATCH).
export async function POST(request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { createdById: true } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can change branding." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");
  if (!(file instanceof File) || !KINDS.has(kind)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, or WEBP image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large -- try a smaller one." }, { status: 400 });

  const asset = await prisma.tournamentAsset.create({ data: { tournamentId, kind, contentType: file.type, data: Buffer.from(await file.arrayBuffer()) }, select: { id: true } });
  return NextResponse.json({ id: asset.id, url: assetUrl(asset.id) }, { status: 201 });
}
