import { ImageResponse } from "next/og";

/**
 * The home-screen / notification icon: "PW" on the brand lime, centred with enough padding to
 * survive Android's maskable crop.
 */
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1712" }}>
        <div style={{ width: "62%", height: "62%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "22%", background: "#d8f24e", color: "#0f1712", fontSize: size * 0.27, fontWeight: 900, letterSpacing: -size * 0.01 }}>PW</div>
      </div>
    ),
    { width: size, height: size },
  );
}
