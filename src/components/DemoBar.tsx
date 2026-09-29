import { useState } from "react";
import { CloudLightning, FastForward, Moon, RotateCcw, SunMedium, FlaskConical, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { actions, useStore } from "@/lib/store";
import { HOUR, fmtDay, fmtDate, fmtStamp } from "@/lib/time";

/** The controls that make a week of a small business watchable in a minute. */
export function DemoBar() {
  const [open, setOpen] = useState(false);
  const now = useNow();
  const state = useStore();
  const shifted = Math.round(state.clockOffsetMs / HOUR);

  /** On phones the panel covers half the screen, so it gets out of the way after each action. */
  const done = () => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  };

  const storm = () => {
    done();
    const r = actions.stormOnBusiestOutdoorDay();
    if (!r) return toast("No outdoor jobs left to rain on.", { description: "Reset the demo for a fresh week." });
    toast.success(`Heavy rain forecast for ${fmtDate(r.date, "EEEE, MMM d")}`, {
      description: r.jumpedHours ? `Clock moved ${r.jumpedHours} h forward to the 48-hour rain check. Watch the messages: nobody had to lift a finger.` : "The 48-hour rain check ran. Watch the messages.",
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-lift hover:bg-foreground/90"
        aria-label="Open demo controls"
      >
        <FlaskConical className="size-4" aria-hidden="true" /> Demo controls
      </button>
    );
  }
  return (
    <section aria-label="Demo controls" className="fixed inset-x-3 bottom-3 z-40 rounded-lg border border-foreground/20 bg-foreground p-4 text-background shadow-lift sm:inset-x-auto sm:right-4 sm:w-[22rem]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">Demo controls</h2>
          <p className="text-xs text-background/70">
            It's {fmtStamp(now)} at Fernhill{shifted ? ` (${shifted > 0 ? "+" : ""}${shifted} h from real time)` : ""}. Nothing here sends a real text or charges a card.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-background/70 hover:bg-background/10 hover:text-background" aria-label="Close demo controls">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-2">
        <Button variant="sun" size="sm" onClick={storm}><CloudLightning /> Storm hits the busiest outdoor day</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => { done(); actions.fastForward(1); toast("Fast-forwarded 1 hour", { description: "Reminders, nudges and releases fire as their times pass." }); }}>
            <FastForward /> +1 hour
          </Button>
          <Button variant="outline" size="sm" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => { done(); actions.jumpToEndOfDay(); toast("Jumped to 5:30 pm", { description: "The day's jobs are done and aftercare texts are on their way." }); }}>
            <Moon /> End of day
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => { done(); actions.fastForward(6); toast(`Fast-forwarded 6 hours`, { description: "Everything scheduled in between just happened." }); }}>
            <FastForward /> +6 hours
          </Button>
          <Button variant="outline" size="sm" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => { done(); actions.jumpToNextJobMorning(); toast("Jumped to 7:30 am on the next job day"); }}>
            <SunMedium /> Next job morning
          </Button>
        </div>
        <Button variant="outline" size="sm" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => {
          done();
          const who = actions.demoCancel();
          if (who) toast.success(`${who} cancelled`, { description: "Watch the Waitlist panel: the slot is offered to the first person whose job fits." });
          else toast("Nothing far enough ahead to cancel for free.", { description: "Reset the demo for a fresh week." });
        }}>
          <UserX /> A customer cancels
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => { done(); actions.clearStorm(); toast("Forecast cleared"); }}>
            Clear storm
          </Button>
          <Button variant="outline" size="sm" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => { done(); actions.reset(); toast("Demo reset to a fresh week"); }}>
            <RotateCcw /> Reset
          </Button>
        </div>
        {state.stormDays.length > 0 && <p className="text-xs text-sun">Storm forecast: {state.stormDays.map((d) => fmtDay(new Date(`${d}T20:00:00Z`).getTime())).join(", ")}</p>}
      </div>
    </section>
  );
}
