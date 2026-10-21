import { createElement } from "react";
import { ImageResponse } from "next/og";
import { bragSecret, decodeBragCode } from "@/lib/brag";
import { bragDate, loadBragView, type BragView } from "@/lib/load-brag";
import { ordinal } from "@/lib/round-robin-recap";
import { TIER_COLORS } from "@/lib/achievement-icons";
import { ICON_SHAPES } from "@/lib/achievement-icon-shapes";

const SIZE = { width: 1200, height: 630 };
const INK = "#0f1712";
const LIME = "#d8f24e";
const SOFT = "#93a397";

// The site's font, fetched once per server instance. Card images fall back to the default font if
// Google Fonts can't be reached.
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(([500, 800] as const).map(async (weight) => {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`).then((response) => response.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) throw new Error("No font file");
    return { name: "Geist", data: await fetch(url).then((response) => response.arrayBuffer()), weight, style: "normal" as const };
  })).catch(() => {
    fonts = null;
    return [];
  });
  return fonts;
}

function Icon({ name, size, strokeWidth = 2 }: { name: string; size: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {(ICON_SHAPES[name] ?? ICON_SHAPES.award).map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs }))}
    </svg>
  );
}

function Footer({ color, children }: { color: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 26, color }}>
      <div style={{ display: "flex" }}>{children}</div>
      <div style={{ display: "flex", fontWeight: 800 }}>PickleballWolves</div>
    </div>
  );
}

function AchievementCard({ view }: { view: Extract<BragView, { kind: "achievement" }> }) {
  const { achievement } = view;
  const [badge, onBadge] = TIER_COLORS[achievement.tier];
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: INK, padding: 64, color: "#eef3ea", fontFamily: "Geist" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 56, flexGrow: 1 }}>
        <div style={{ width: 300, height: 300, borderRadius: 999, background: badge, color: onBadge, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={achievement.icon} size={150} strokeWidth={2.2} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 716 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: LIME, textTransform: "uppercase", letterSpacing: 4 }}>Achievement unlocked</div>
          <div style={{ marginTop: 10, fontSize: achievement.name.length > 14 ? 68 : achievement.name.length > 10 ? 78 : 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{achievement.name}</div>
          <div style={{ marginTop: 16, fontSize: 34, color: SOFT, maxWidth: 680 }}>{achievement.description}</div>
          <div style={{ marginTop: 34, fontSize: 40, fontWeight: 800 }}>{view.playerName}</div>
        </div>
      </div>
      <Footer color={SOFT}>
        <div style={{ display: "flex", padding: "8px 22px", borderRadius: 999, background: badge, color: onBadge, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, fontSize: 22 }}>{`${achievement.tier} badge`}</div>
        <div style={{ display: "flex", marginLeft: 20 }}>{`Earned ${bragDate(achievement.unlockedAt)}`}</div>
      </Footer>
    </div>
  );
}

function RecapCard({ view }: { view: Extract<BragView, { kind: "recap" }> }) {
  const { recap } = view;
  const champion = recap.champion;
  const fg = champion ? INK : "#eef3ea";
  const soft = champion ? "#3c4a1e" : SOFT;
  const tile = champion ? "rgba(15,23,18,0.1)" : "#1b2a20";
  const place = champion ? (recap.tiedWith ? "Round robin co-champion" : "Round robin champion") : `Finished ${recap.tiedWith ? "tied " : ""}${ordinal(recap.rank)} of ${recap.players}`;
  const stats: [string, string][] = [
    ["Record", `${recap.wins}-${recap.losses}`],
    ["Win %", `${recap.winPct}%`],
    ["Points", `${recap.differential > 0 ? "+" : ""}${recap.differential}`],
  ];
  // It's a brag -- a rating that went down stays off the card.
  if (recap.ratingChange !== null && recap.ratingChange > 0) stats.push(["Rating", `+${recap.ratingChange.toFixed(2)}`]);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: champion ? LIME : INK, padding: 64, color: fg, fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 800, textTransform: "uppercase", letterSpacing: 4, color: champion ? INK : LIME }}>
          {champion && <Icon name="crown" size={38} strokeWidth={2.5} />}
          {place}
        </div>
        <div style={{ marginTop: 14, fontSize: view.playerName.length > 18 ? 84 : 104, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>{view.playerName}</div>
        <div style={{ marginTop: 18, fontSize: 32, color: soft }}>{[view.roundRobinName, view.groupName, bragDate(view.endedAt)].filter((part, index, parts): part is string => !!part && (index === 0 || !parts[0]!.includes(part))).join(" · ")}</div>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: 0, background: tile, borderRadius: 24, padding: "22px 28px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: soft }}>{label}</div>
            <div style={{ marginTop: 6, fontSize: 60, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>
      <Footer color={soft} />
    </div>
  );
}

// The card as a PNG: the link preview for /brag/<code>, and the image players download or post.
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const card = decodeBragCode((await context.params).code, bragSecret());
  const view = card ? await loadBragView(card) : null;
  if (!view) return new Response("Card not found", { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  return new ImageResponse(view.kind === "achievement" ? <AchievementCard view={view} /> : <RecapCard view={view} />, {
    ...SIZE,
    fonts: await loadFonts(),
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      ...(download ? { "Content-Disposition": `attachment; filename="pickleballwolves-${view.kind}.png"` } : {}),
    },
  });
}
