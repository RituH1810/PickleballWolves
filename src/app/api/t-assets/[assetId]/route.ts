import { prisma } from "@/lib/prisma";

// Public branding images (logos, banners, sponsor logos). Asset ids are never reused -- a new
// upload gets a new id -- so they can be cached for a long time.
export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const asset = await prisma.tournamentAsset.findUnique({ where: { id: assetId }, select: { contentType: true, data: true } });
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.data), { headers: { "Content-Type": asset.contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
