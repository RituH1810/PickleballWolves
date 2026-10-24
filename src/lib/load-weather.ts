import { prisma } from "@/lib/prisma";
import { FORECAST_DAYS, GAME_HOURS, gameWeather, type GameWeather, type HourlyForecast } from "@/lib/weather";

// Both services are free and keyless. Photon (OpenStreetMap) turns a game's location into
// coordinates; Open-Meteo gives the hourly forecast. Lookups are cached (a place's coordinates
// for a week, a forecast for an hour) to keep traffic light.
const PHOTON_URL = "https://photon.komoot.io/api/";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const USER_AGENT = "PickleballWolves (https://pickleballwolves.com)";
// Locations are short ("Lancaster YMCA"), so searches lean toward the club's home area: Lancaster,
// South Carolina. Unbiased (or biased elsewhere), the same names resolve to Lancaster, England or
// Lancaster, Pennsylvania -- and the forecast is for the wrong town.
const HOME_AREA = { lat: 34.72, lon: -80.77 };

async function coordinates(location: string): Promise<{ lat: number; lon: number } | null> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", location.slice(0, 120));
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(HOME_AREA.lat));
  url.searchParams.set("lon", String(HOME_AREA.lon));
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, next: { revalidate: 7 * 86_400 } });
    if (!response.ok) return null;
    const [lon, lat] = ((await response.json()) as { features?: { geometry: { coordinates: [number, number] } }[] }).features?.[0]?.geometry.coordinates ?? [];
    return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
  } catch {
    return null;
  }
}

async function hourlyForecast(lat: number, lon: number): Promise<HourlyForecast | null> {
  const url = new URL(OPEN_METEO_URL);
  // Rounded so nearby courts share one cached forecast.
  url.searchParams.set("latitude", lat.toFixed(2));
  url.searchParams.set("longitude", lon.toFixed(2));
  url.searchParams.set("hourly", "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "GMT");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS + 1));
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, next: { revalidate: 3_600 } });
    if (!response.ok) return null;
    return ((await response.json()) as { hourly?: HourlyForecast }).hourly ?? null;
  } catch {
    return null;
  }
}

/** The forecast for a game at `location` starting `startsAt`, or null when there's none to show. */
export async function weatherAt(location: string | null | undefined, startsAt: Date | null | undefined, now = new Date()): Promise<GameWeather | null> {
  if (!location?.trim() || !startsAt) return null;
  // Not for games already over, nor further out than the forecast is worth trusting.
  if (startsAt.getTime() < now.getTime() - GAME_HOURS * 3_600_000 || startsAt.getTime() > now.getTime() + FORECAST_DAYS * 86_400_000) return null;
  const place = await coordinates(location);
  if (!place) return null;
  const hourly = await hourlyForecast(place.lat, place.lon);
  return hourly ? gameWeather(hourly, startsAt) : null;
}

/** Forecasts for round robins (played at their group's location) and events, keyed by id. */
export async function loadGameWeather(roundRobinIds: string[], eventIds: string[]) {
  const [roundRobins, events] = await Promise.all([
    roundRobinIds.length ? prisma.roundRobin.findMany({ where: { id: { in: roundRobinIds } }, select: { id: true, scheduledAt: true, group: { select: { location: true } } } }) : [],
    eventIds.length ? prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, startsAt: true, location: true } }) : [],
  ]);
  const entries = await Promise.all([
    ...roundRobins.map(async (roundRobin) => [roundRobin.id, await weatherAt(roundRobin.group?.location, roundRobin.scheduledAt)] as const),
    ...events.map(async (event) => [event.id, await weatherAt(event.location, event.startsAt)] as const),
  ]);
  return Object.fromEntries(entries.filter(([, weather]) => weather)) as Record<string, GameWeather>;
}
