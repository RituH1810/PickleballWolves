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

const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;
const fitName = (text: string, roomy: number, tight: number) => (text.length > 26 ? tight : roomy);

// The whole night: champion(s) up top, the podium, and how much pickleball got played.
function RoundRobinCard({ view }: { view: Extract<BragView, { kind: "roundRobin" }> }) {
  const champions = view.champions.map((entry) => entry.name).join(" & ");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: LIME, padding: 60, color: INK, fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 800, textTransform: "uppercase", letterSpacing: 4 }}>
          <Icon name="crown" size={36} strokeWidth={2.5} />
          {view.champions.length > 1 ? "Round robin co-champions" : view.undefeated ? "Undefeated champion" : "Round robin champion"}
        </div>
        <div style={{ marginTop: 12, fontSize: fitName(champions, 92, 64), fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>{champions}</div>
        <div style={{ marginTop: 16, fontSize: 30, color: "#3c4a1e" }}>{[view.roundRobinName, view.groupName, bragDate(view.endedAt)].filter((part, index, parts): part is string => !!part && (index === 0 || !parts[0]!.includes(part))).join(" · ")}</div>
      </div>
      <div style={{ display: "flex", gap: 18 }}>
        {view.podium.map((entry) => (
          <div key={`${entry.rank}-${entry.name}`} style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: 0, background: "rgba(15,23,18,0.1)", borderRadius: 22, padding: "18px 24px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#3c4a1e" }}>{ordinal(entry.rank)}</div>
            <div style={{ marginTop: 4, fontSize: 32, fontWeight: 800, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{entry.name}</div>
            <div style={{ marginTop: 4, fontSize: 24, color: "#3c4a1e" }}>{`${entry.wins}-${entry.losses} · ${signed(entry.differential)}`}</div>
          </div>
        ))}
      </div>
      <Footer color="#3c4a1e">
        <div style={{ display: "flex" }}>{`${view.totals.players} players · ${view.totals.games} games · ${view.totals.points} points`}</div>
      </Footer>
    </div>
  );
}

// A group's month: the top five, with records and win %.
function LeaderboardCard({ view }: { view: Extract<BragView, { kind: "leaderboard" }> }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: INK, padding: "52px 60px", color: "#eef3ea", fontFamily: "Geist" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: LIME, textTransform: "uppercase", letterSpacing: 4 }}>{`${view.monthLabel} leaderboard${view.isCurrent ? " · so far" : ""}`}</div>
          <div style={{ marginTop: 8, fontSize: fitName(view.groupName, 60, 46), fontWeight: 800, letterSpacing: -2 }}>{view.groupName}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: SOFT }}>Win % · record</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {view.places.map((entry, index) => (
          <div key={`${entry.rank}-${entry.name}`} style={{ display: "flex", alignItems: "center", gap: 22, background: index === 0 ? LIME : "#1b2a20", color: index === 0 ? INK : "#eef3ea", borderRadius: 18, padding: "10px 24px" }}>
            <div style={{ display: "flex", width: 44, fontSize: 30, fontWeight: 800 }}>{String(entry.rank)}</div>
            <div style={{ display: "flex", flexGrow: 1, fontSize: 32, fontWeight: 800, overflow: "hidden", whiteSpace: "nowrap" }}>{entry.name}</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>{`${entry.winPct}%`}</div>
            <div style={{ display: "flex", width: 110, justifyContent: "flex-end", fontSize: 26, color: index === 0 ? "#3c4a1e" : SOFT }}>{`${entry.wins}-${entry.losses}`}</div>
          </div>
        ))}
      </div>
      <Footer color={SOFT} />
    </div>
  );
}

function CardFor({ view }: { view: BragView }) {
  switch (view.kind) {
    case "achievement": return <AchievementCard view={view} />;
    case "recap": return <RecapCard view={view} />;
    case "roundRobin": return <RoundRobinCard view={view} />;
    case "leaderboard": return <LeaderboardCard view={view} />;
  }
}

// The card as a PNG: the link preview for /brag/<code>, and the image players download or post.
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const card = decodeBragCode((await context.params).code, bragSecret());
  const view = card ? await loadBragView(card) : null;
  if (!view) return new Response("Card not found", { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  return new ImageResponse(<CardFor view={view} />, {
    ...SIZE,
    fonts: await loadFonts(),
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      ...(download ? { "Content-Disposition": `attachment; filename="pickleballwolves-${view.kind}.png"` } : {}),
    },
  });
}
