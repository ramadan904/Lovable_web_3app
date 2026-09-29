import { useEffect } from "react";
import { RAIN_LIMIT } from "@/lib/business";
import { useStore } from "@/lib/store";
import { addDays, localDate } from "@/lib/time";
import { forecastFor, type Forecast } from "@/lib/weather";
import { useNow } from "./useNow";

export interface Mood {
  mood: "rain" | "dry";
  /** The day driving the mood: today, or a storm day within the next two days. */
  date: string;
  forecast: Forecast;
}

/**
 * The app's weather mood. It's raining if today's forecast is wet, or a storm is forecast within two
 * days (the demo's Storm button sets one). The palette follows: see :root[data-weather="rain"].
 */
export function useWeatherMood(): Mood {
  const state = useStore();
  const now = useNow();
  const today = localDate(now);
  const soonStorm = [0, 1, 2].map((n) => addDays(today, n)).find((d) => state.stormDays.includes(d));
  const date = soonStorm ?? today;
  const forecast = forecastFor(date, state.stormDays);
  return { mood: forecast.rain >= RAIN_LIMIT ? "rain" : "dry", date, forecast };
}

/** Puts the mood on <html> so the CSS variables can change with the weather. */
export function useApplyWeatherMood(mood: Mood["mood"]) {
  useEffect(() => {
    document.documentElement.dataset.weather = mood;
    return () => {
      delete document.documentElement.dataset.weather;
    };
  }, [mood]);
}
