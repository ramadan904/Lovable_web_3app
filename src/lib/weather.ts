import { RAIN_LIMIT } from "./business";

export interface Forecast {
  /** Chance of rain, 0 to 100. */
  rain: number;
  wet: boolean;
  label: string;
  high: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000;
}

/**
 * A believable Portland forecast, derived from the date so it is stable between
 * renders. About a third of days are wet. `stormDays` forces an atmospheric river.
 */
export function forecastFor(date: string, stormDays: string[] = []): Forecast {
  if (stormDays.includes(date)) return { rain: 95, wet: true, label: "Heavy rain", high: 51 };
  const h = hash(date);
  const band = h % 100;
  const month = Number(date.slice(5, 7));
  const wetter = month >= 10 || month <= 4 ? 6 : -10; // more wet days in the rainy season
  let rain: number;
  if (band + wetter < 42) rain = 5 + (h % 25);
  else if (band + wetter < 76) rain = 35 + (h % 30);
  else rain = 72 + (h % 24);
  const month0 = month - 1;
  const seasonalHigh = [47, 52, 57, 62, 68, 74, 81, 82, 76, 64, 54, 47][month0];
  const high = seasonalHigh + ((h >> 3) % 9) - 4;
  const wet = rain >= RAIN_LIMIT;
  const label = rain >= RAIN_LIMIT ? "Rain" : rain >= 40 ? "Showers possible" : high > 70 ? "Sunny" : "Dry";
  return { rain, wet, label, high };
}
