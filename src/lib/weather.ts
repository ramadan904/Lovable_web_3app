import { useSyncExternalStore } from "react";
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
  const real = live.get(date);
  if (real) return fromLive(real);
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

// Live forecast ---------------------------------------------------------------
// Optional: the real Portland forecast from Open-Meteo (free, no key). Off by default so the demo is
// stable; days the service has no answer for keep the demo forecast. A storm forced from the Demo
// controls still wins.
interface LiveDay { rain: number; high: number }
export type LiveStatus = { state: "off" | "loading" | "live" | "failed"; days: number };

const live = new Map<string, LiveDay>();
let status: LiveStatus = { state: "off", days: 0 };
const changed = new Set<() => void>();
const emitLive = (next: LiveStatus) => { status = next; changed.forEach((cb) => cb()); };

/** Called whenever the live forecast changes, so the app can recompute what depends on it. */
export const onLiveChange = (cb: () => void) => { changed.add(cb); return () => { changed.delete(cb); }; };

function fromLive(d: LiveDay): Forecast {
  const wet = d.rain >= RAIN_LIMIT;
  const label = wet ? "Rain" : d.rain >= 40 ? "Showers possible" : d.high > 70 ? "Sunny" : "Dry";
  return { rain: d.rain, wet, label, high: d.high };
}

/** Turns an Open-Meteo "daily" block into whole days with a rain chance; days it has nothing for are skipped. */
export function parseOpenMeteo(json: unknown): Map<string, LiveDay> {
  const out = new Map<string, LiveDay>();
  const daily = (json as { daily?: { time?: unknown; precipitation_probability_max?: unknown; temperature_2m_max?: unknown } } | null)?.daily;
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.precipitation_probability_max)) return out;
  const times: unknown[] = daily.time;
  const chances: unknown[] = daily.precipitation_probability_max;
  const temps: unknown[] = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  times.forEach((date, i) => {
    const rain = chances[i];
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof rain !== "number" || !Number.isFinite(rain)) return;
    const t = temps[i];
    const seasonal = forecastFor(date, []).high;
    out.set(date, { rain: Math.max(0, Math.min(100, Math.round(rain))), high: typeof t === "number" && Number.isFinite(t) ? Math.round(t) : seasonal });
  });
  return out;
}

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast?latitude=45.52&longitude=-122.68&daily=precipitation_probability_max,temperature_2m_max&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=16";
const LIVE_FLAG = "fernhill:live-weather";
const remember = (on: boolean) => { try { localStorage.setItem(LIVE_FLAG, on ? "1" : "0"); } catch { /* private mode */ } };

export async function setLiveWeather(on: boolean): Promise<LiveStatus> {
  remember(on);
  if (!on) { live.clear(); emitLive({ state: "off", days: 0 }); return status; }
  emitLive({ state: "loading", days: 0 });
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    const res = await fetch(OPEN_METEO, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const days = parseOpenMeteo(await res.json());
    if (!days.size) throw new Error("no days");
    live.clear();
    days.forEach((v, k) => live.set(k, v));
    emitLive({ state: "live", days: days.size });
  } catch {
    live.clear();
    emitLive({ state: "failed", days: 0 });
  }
  return status;
}

export const useLiveStatus = (): LiveStatus => useSyncExternalStore((cb) => onLiveChange(cb), () => status, () => status);

// A returning visitor who turned it on gets it back.
if (typeof window !== "undefined") {
  try { if (localStorage.getItem(LIVE_FLAG) === "1") void setLiveWeather(true); } catch { /* private mode */ }
}
