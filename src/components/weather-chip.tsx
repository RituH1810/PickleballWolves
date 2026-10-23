"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, Snowflake, Sun, type LucideIcon } from "lucide-react";
import { useViewer } from "@/components/guest-shell";
import type { GameWeather, WeatherIcon } from "@/lib/weather";

const ICONS: Record<WeatherIcon, LucideIcon> = { sun: Sun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: Snowflake, storm: CloudLightning };

/** A game's forecast in one line; warnings (rain, heat, wind...) turn it coral and are listed on hover. */
export function WeatherChip({ weather, className = "" }: { weather: GameWeather; className?: string }) {
  const Icon = ICONS[weather.icon];
  const warn = weather.warnings.length > 0;
  return (
    <span title={warn ? weather.warnings.join("\n") : "Forecast for game time"} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${warn ? "bg-[#2e1a16] text-[#f2a08c]" : "bg-[#1c2a1a] text-[var(--ink-soft)]"} ${className}`}>
      <Icon size={13} className="shrink-0" />{weather.summary}{warn && <span className="font-semibold">· {weather.warnings[0]}</span>}
    </span>
  );
}

/** Loads and shows one game's forecast (nothing for guests, past games, or games over a week out). */
export function GameWeatherChip({ roundRobinId, eventId, className }: { roundRobinId?: string; eventId?: string; className?: string }) {
  const { signedIn } = useViewer();
  const [weather, setWeather] = useState<GameWeather | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    const query = roundRobinId ? `roundRobinIds=${encodeURIComponent(roundRobinId)}` : `eventIds=${encodeURIComponent(eventId ?? "")}`;
    fetch(`/api/weather?${query}`).then((response) => response.ok ? response.json() : null).then((data) => setWeather(data?.weather?.[roundRobinId ?? eventId ?? ""] ?? null));
  }, [signedIn, roundRobinId, eventId]);
  return weather ? <WeatherChip weather={weather} className={className} /> : null;
}
