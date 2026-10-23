// Turns an Open-Meteo hourly forecast into what a player cares about for one game: a one-line
// summary for the game page, and the warnings worth an evening-before alert.

export type HourlyForecast = {
  time: string[]; // ISO hours in UTC, e.g. "2026-10-24T13:00"
  temperature_2m: number[]; // °F
  apparent_temperature: number[]; // °F
  precipitation_probability: (number | null)[]; // %
  weather_code: number[]; // WMO code
  wind_speed_10m: number[]; // mph
  wind_gusts_10m: number[]; // mph
};

export type WeatherIcon = "sun" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export type GameWeather = {
  icon: WeatherIcon;
  summary: string; // "Rain likely · 54°F"
  temperature: number;
  precipitationChance: number;
  warnings: string[]; // empty when the weather is fine for playing
};

// How long a game is assumed to last when checking the forecast.
export const GAME_HOURS = 2;
// Forecasts further out than this are too unreliable to show.
export const FORECAST_DAYS = 7;
export const RAIN_CHANCE_WARNING = 50;
export const HOT_FEELS_LIKE = 92;
// Freezing, not just chilly -- otherwise every winter morning game would get an alert.
export const COLD_FEELS_LIKE = 32;
export const GUST_WARNING = 30;

const CONDITIONS: { codes: number[]; icon: WeatherIcon; label: string }[] = [
  { codes: [95, 96, 99], icon: "storm", label: "Thunderstorms" },
  { codes: [71, 73, 75, 77, 85, 86], icon: "snow", label: "Snow" },
  { codes: [66, 67], icon: "rain", label: "Freezing rain" },
  { codes: [61, 63, 65, 80, 81, 82], icon: "rain", label: "Rain" },
  { codes: [51, 53, 55, 56, 57], icon: "drizzle", label: "Drizzle" },
  { codes: [45, 48], icon: "fog", label: "Fog" },
  { codes: [3], icon: "cloud", label: "Cloudy" },
  { codes: [2], icon: "cloud", label: "Partly cloudy" },
  { codes: [0, 1], icon: "sun", label: "Clear" },
];
// Worse weather wins when the game spans hours with different conditions.
const SEVERITY: WeatherIcon[] = ["sun", "cloud", "fog", "drizzle", "rain", "snow", "storm"];

function condition(code: number) {
  return CONDITIONS.find((entry) => entry.codes.includes(code)) ?? { codes: [code], icon: "cloud" as const, label: "Cloudy" };
}

function hourKey(date: Date) {
  return date.toISOString().slice(0, 13); // "2026-10-24T13"
}

/** The forecast for a game starting at `startsAt`, or null if that time isn't in the forecast. */
export function gameWeather(hourly: HourlyForecast, startsAt: Date, hours = GAME_HOURS): GameWeather | null {
  const first = hourly.time.findIndex((time) => time.slice(0, 13) === hourKey(startsAt));
  if (first === -1) return null;
  const indexes = Array.from({ length: hours }, (_, offset) => first + offset).filter((index) => index < hourly.time.length);

  const conditions = indexes.map((index) => condition(hourly.weather_code[index]));
  const worst = conditions.reduce((a, b) => (SEVERITY.indexOf(b.icon) > SEVERITY.indexOf(a.icon) ? b : a));
  const temperature = Math.round(hourly.temperature_2m[first]);
  const feelsLike = indexes.map((index) => hourly.apparent_temperature[index]);
  const precipitationChance = Math.max(0, ...indexes.map((index) => hourly.precipitation_probability[index] ?? 0));
  const gusts = Math.round(Math.max(...indexes.map((index) => hourly.wind_gusts_10m[index])));

  const warnings: string[] = [];
  if (worst.icon === "storm") warnings.push("Thunderstorms in the forecast");
  else if (worst.icon === "snow") warnings.push("Snow in the forecast");
  else if (worst.label === "Freezing rain") warnings.push("Freezing rain in the forecast");
  if (precipitationChance >= RAIN_CHANCE_WARNING && !["storm", "snow"].includes(worst.icon)) warnings.push(`${precipitationChance}% chance of rain`);
  if (Math.max(...feelsLike) >= HOT_FEELS_LIKE) warnings.push(`Feels like ${Math.round(Math.max(...feelsLike))}°F -- bring water`);
  if (Math.min(...feelsLike) <= COLD_FEELS_LIKE) warnings.push(`Feels like ${Math.round(Math.min(...feelsLike))}°F`);
  if (gusts >= GUST_WARNING) warnings.push(`Wind gusts up to ${gusts} mph`);

  // A high chance of rain reads as "rain likely" even if the hour's code is only cloudy.
  const label = precipitationChance >= RAIN_CHANCE_WARNING && SEVERITY.indexOf(worst.icon) < SEVERITY.indexOf("drizzle") ? "Rain likely" : worst.label;
  const icon = label === "Rain likely" ? "rain" : worst.icon;
  return { icon, summary: `${label} · ${temperature}°F`, temperature, precipitationChance, warnings };
}
