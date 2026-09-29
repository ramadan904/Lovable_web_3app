import { Cloud, CloudRain, CloudSun, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Forecast } from "@/lib/weather";

export function WeatherIcon({ f, className }: { f: Forecast; className?: string }) {
  if (f.wet) return <CloudRain className={cn("text-rain", className)} aria-hidden="true" />;
  if (f.rain >= 40) return <Cloud className={cn("text-rain/80", className)} aria-hidden="true" />;
  if (f.high > 70) return <Sun className={cn("text-sun-ink", className)} aria-hidden="true" />;
  return <CloudSun className={cn("text-sun-ink", className)} aria-hidden="true" />;
}

export function WeatherChip({ f, className }: { f: Forecast; className?: string }) {
  return (
    <span
      className={cn(
        "chip",
        f.wet ? "border-rain/30 bg-rain-soft text-rain" : f.rain >= 40 ? "border-border bg-muted text-foreground" : "border-sun/50 bg-sun-soft text-sun-ink",
        className,
      )}
    >
      <WeatherIcon f={f} className="size-3.5" />
      {f.label} · {f.rain}%
    </span>
  );
}
