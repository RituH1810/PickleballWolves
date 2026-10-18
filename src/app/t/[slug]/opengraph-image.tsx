import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BRAND_COLOR, readableTextColor, tournamentDates } from "@/lib/branding";
import { loadPublicTournament } from "@/lib/public-tournament";

// The preview card WhatsApp, iMessage, Facebook, and X show when the public link is shared.
export const alt = "Tournament on PickleballWolves";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const tournament = await loadPublicTournament((await params).slug);
  const brand = tournament?.brandColor ?? DEFAULT_BRAND_COLOR;
  const onBrand = readableTextColor(brand);

  // Embed the logo directly so the image renders without another request.
  let logo: string | null = null;
  if (tournament?.logoAssetId) {
    const asset = await prisma.tournamentAsset.findUnique({ where: { id: tournament.logoAssetId }, select: { contentType: true, data: true } });
    if (asset && asset.contentType !== "image/webp") logo = `data:${asset.contentType};base64,${Buffer.from(asset.data).toString("base64")}`;
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0f1712", padding: 64, color: "#eef3ea" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt="" width={140} height={140} style={{ borderRadius: 28, background: "#ffffff", objectFit: "contain" }} />
            : <div style={{ width: 140, height: 140, borderRadius: 28, background: brand, color: onBrand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontWeight: 900 }}>{(tournament?.presentedBy ?? "PW").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: brand === "#0f1712" ? DEFAULT_BRAND_COLOR : brand, textTransform: "uppercase", letterSpacing: 3 }}>{tournament ? `${tournament.presentedBy} presents` : "PickleballWolves"}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: tournament && tournament.name.length > 32 ? 64 : 84, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>{tournament?.name ?? "Tournament"}</div>
          {tournament && <div style={{ marginTop: 20, fontSize: 34, color: "#93a397" }}>{`${tournamentDates(tournament.startDate, tournament.endDate)} · ${tournament.location}`}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", padding: "12px 26px", borderRadius: 999, background: brand, color: onBrand, fontSize: 28, fontWeight: 800 }}>{tournament?.champion ? `Champions: ${tournament.champion}` : tournament?.registrationOpen ? "Registration open" : tournament?.status === "LIVE" ? "Live scores" : "Follow along"}</div>
          <div style={{ fontSize: 26, color: "#93a397" }}>PickleballWolves</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
