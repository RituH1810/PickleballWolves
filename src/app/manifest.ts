import type { MetadataRoute } from "next";

// Lets PickleballWolves install to a phone's home screen and open like an app (no browser bar).
// iPhones also need this installed to receive push notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PickleballWolves",
    short_name: "Wolves",
    description: "Organize your games, track your progress, and find your pack.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1712",
    theme_color: "#0f1712",
    icons: [
      { src: "/api/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/api/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/api/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
