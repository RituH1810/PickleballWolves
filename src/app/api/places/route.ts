import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dedupePlaces, formatPlace, type PhotonFeature } from "@/lib/places";

// Photon: free OpenStreetMap search by Komoot, no API key. Its fair-use policy asks for light,
// identified traffic -- so searches go through here (signed-in players only), are cached for a
// day, and the UI credits OpenStreetMap.
const PHOTON_URL = "https://photon.komoot.io/api/";
const MAX_RESULTS = 6;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return NextResponse.json({ places: [] });

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(MAX_RESULTS + 4));
  url.searchParams.set("lang", "en");
  // Bias results toward the searcher so "YMCA" finds the local one first: an explicit lat/lon, or
  // the approximate location Vercel derives from their IP (no permission prompt needed).
  const latText = params.get("lat") ?? request.headers.get("x-vercel-ip-latitude");
  const lonText = params.get("lon") ?? request.headers.get("x-vercel-ip-longitude");
  const lat = Number(latText);
  const lon = Number(lonText);
  if (latText && lonText && Number.isFinite(lat) && Number.isFinite(lon)) {
    url.searchParams.set("lat", lat.toFixed(3));
    url.searchParams.set("lon", lon.toFixed(3));
  }

  try {
    const response = await fetch(url, { headers: { "User-Agent": `PickleballWolves (${new URL(request.url).origin})` }, next: { revalidate: 86_400 } });
    if (!response.ok) return NextResponse.json({ places: [], error: "Address search is unavailable right now -- type the address instead." });
    const data = (await response.json()) as { features?: PhotonFeature[] };
    return NextResponse.json({ places: dedupePlaces((data.features ?? []).map(formatPlace)).slice(0, MAX_RESULTS) });
  } catch {
    return NextResponse.json({ places: [], error: "Address search is unavailable right now -- type the address instead." });
  }
}
