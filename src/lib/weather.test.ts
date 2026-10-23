import { describe, expect, it } from "vitest";
import { gameWeather, type HourlyForecast } from "./weather";

type Hour = { code: number; temp: number; feels?: number; rain?: number; gusts?: number };

function forecast(startHour: string, hours: Hour[]): HourlyForecast {
  const start = new Date(`${startHour}:00:00Z`).getTime();
  return {
    time: hours.map((_, index) => new Date(start + index * 3_600_000).toISOString().slice(0, 16)),
    temperature_2m: hours.map((hour) => hour.temp),
    apparent_temperature: hours.map((hour) => hour.feels ?? hour.temp),
    precipitation_probability: hours.map((hour) => hour.rain ?? 0),
    weather_code: hours.map((hour) => hour.code),
    wind_speed_10m: hours.map(() => 5),
    wind_gusts_10m: hours.map((hour) => hour.gusts ?? 10),
  };
}

const at = new Date("2026-10-24T10:30:00Z");

describe("gameWeather", () => {
  it("is quiet on a nice day", () => {
    const result = gameWeather(forecast("2026-10-24T09", [{ code: 2, temp: 60 }, { code: 0, temp: 64 }, { code: 1, temp: 67 }]), at);
    expect(result).toEqual({ icon: "sun", summary: "Clear · 64°F", temperature: 64, precipitationChance: 0, warnings: [] });
  });

  it("warns about rain anywhere in the game window", () => {
    const result = gameWeather(forecast("2026-10-24T10", [{ code: 3, temp: 55, rain: 20 }, { code: 3, temp: 54, rain: 70 }]), at)!;
    expect(result.summary).toBe("Rain likely · 55°F");
    expect(result.icon).toBe("rain");
    expect(result.warnings).toEqual(["70% chance of rain"]);
  });

  it("lets the worst condition win and flags heat, cold, and gusts", () => {
    const storm = gameWeather(forecast("2026-10-24T10", [{ code: 1, temp: 95, feels: 101, rain: 80 }, { code: 95, temp: 90 }]), at)!;
    expect(storm.summary).toBe("Thunderstorms · 95°F");
    expect(storm.warnings).toEqual(["Thunderstorms in the forecast", "Feels like 101°F -- bring water"]);

    const cold = gameWeather(forecast("2026-10-24T10", [{ code: 3, temp: 36, feels: 28, gusts: 34 }, { code: 3, temp: 42 }]), at)!;
    expect(cold.warnings).toEqual(["Feels like 28°F", "Wind gusts up to 34 mph"]);
  });

  it("returns null outside the forecast", () => {
    expect(gameWeather(forecast("2026-10-24T13", [{ code: 0, temp: 60 }]), at)).toBeNull();
  });
});
