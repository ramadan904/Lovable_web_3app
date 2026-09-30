import { Link, NavLink, Outlet } from "react-router-dom";
import { CalendarCheck, ClipboardList } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import { cn } from "@/lib/utils";
import { useApplyWeatherMood, useWeatherMood } from "@/hooks/useWeatherMood";
import { relativeDay, localDate } from "@/lib/time";
import { useNow } from "@/hooks/useNow";
import { useLiveStatus } from "@/lib/weather";
import { DemoBar } from "./DemoBar";
import { Story } from "./Story";
import { LogoMark } from "./Van";
import { WeatherChip } from "./Weather";
import { Button } from "./ui/button";

const nav = "rounded-full px-3.5 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted hover:text-foreground";

export function Layout() {
  const { mood, date, forecast } = useWeatherMood();
  const now = useNow();
  const liveWx = useLiveStatus();
  useApplyWeatherMood(mood);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only rounded-md bg-sun px-4 py-2 font-semibold text-sun-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5" aria-label={`${BUSINESS.name}, home`}>
            <LogoMark />
            <span className="font-display text-lg font-extrabold leading-none tracking-tight">
              Fernhill <span className="hidden font-bold text-muted-foreground sm:inline">Mobile Detail</span>
            </span>
          </Link>
          <div className="hidden items-center gap-2 md:flex" aria-label="Weather in Portland">
            <span className="text-xs font-semibold text-muted-foreground">{relativeDay(date, localDate(now))}{liveWx.state === "live" ? " · live" : ""}</span>
            <WeatherChip f={forecast} />
          </div>
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/owner" className={({ isActive }) => cn(nav, "hidden sm:inline-flex", isActive && "bg-muted text-foreground")}>
              <ClipboardList className="mr-1.5 size-4" aria-hidden="true" /> Owner view
            </NavLink>
            <Button asChild size="sm">
              <Link to="/book"><CalendarCheck /> Book a detail</Link>
            </Button>
          </nav>
        </div>
        <div className="iris-bar h-[3px]" aria-hidden="true" />
      </header>
      <main id="main" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="border-t bg-card">
        <div className="container grid gap-6 py-10 text-sm text-muted-foreground md:grid-cols-3">
          <div>
            <p className="font-display text-base font-bold text-foreground">{BUSINESS.name}</p>
            <p>{BUSINESS.neighborhood}</p>
            <p>{BUSINESS.tagline}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Tue to Sat · 8:00 to 5:30</p>
            <p>Monday is van maintenance and admin. Sundays we rest.</p>
            <p>Three jobs a day at most. One van, one Dario.</p>
          </div>
          <div>
            <p>Built with <a className="font-semibold text-fern underline underline-offset-4" href="https://lovable.dev">Lovable</a> for the #lovablechallenge.</p>
            <p className="mt-3 text-xs">A fictional business. No texts are sent and no card is charged.</p>
          </div>
        </div>
      </footer>
      <Story />
      <DemoBar />
    </div>
  );
}
