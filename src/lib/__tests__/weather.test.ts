import { afterEach, describe, expect, it, vi } from "vitest";
import { forecastFor, parseOpenMeteo, setLiveWeather } from "../weather";

const DAY = "2026-10-07";
const reply = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });

afterEach(async () => { vi.unstubAllGlobals(); await setLiveWeather(false); });

describe("the live Portland forecast", () => {
  it("reads rain chances and highs, and skips days the service has no answer for", () => {
    const days = parseOpenMeteo({ daily: { time: [DAY, "2026-10-08", "2026-10-09", "bad"], precipitation_probability_max: [80, null, 140, 10], temperature_2m_max: [58.4, 60, null, 50] } });
    expect([...days.keys()]).toEqual([DAY, "2026-10-09"]); // null chance and a bad date are dropped
    expect(days.get(DAY)).toEqual({ rain: 80, high: 58 });
    expect(days.get("2026-10-09")!.rain).toBe(100); // clamped
    expect(parseOpenMeteo(null).size).toBe(0);
    expect(parseOpenMeteo({ daily: { time: "nope" } }).size).toBe(0);
  });

  it("replaces the demo forecast when switched on, still lets a forced storm win, and goes back when switched off", async () => {
    const demo = forecastFor(DAY);
    vi.stubGlobal("fetch", reply({ daily: { time: [DAY], precipitation_probability_max: [88], temperature_2m_max: [55] } }));
    expect(await setLiveWeather(true)).toEqual({ state: "live", days: 1 });
    expect(forecastFor(DAY)).toMatchObject({ rain: 88, wet: true, label: "Rain", high: 55 });
    expect(forecastFor(DAY, [DAY]).rain).toBe(95); // a Demo-controls storm is stronger than the real forecast
    expect(forecastFor("2026-10-08")).toEqual(forecastFor("2026-10-08", [])); // uncovered days keep the demo forecast
    await setLiveWeather(false);
    expect(forecastFor(DAY)).toEqual(demo);
  });

  it("falls back to the demo forecast, and says so, when the service can't be reached", async () => {
    const demo = forecastFor(DAY);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await setLiveWeather(true)).state).toBe("failed");
    expect(forecastFor(DAY)).toEqual(demo);
    vi.stubGlobal("fetch", reply({}, false));
    expect((await setLiveWeather(true)).state).toBe("failed");
    vi.stubGlobal("fetch", reply({ daily: { time: [], precipitation_probability_max: [] } }));
    expect((await setLiveWeather(true)).state).toBe("failed");
    expect(forecastFor(DAY)).toEqual(demo);
  });
});
