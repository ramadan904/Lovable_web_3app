// The guided story: a narrated run through the real app. Each step changes the real state (the same
// actions the Demo controls use) and points the visitor at the page that shows the result.
import { useSyncExternalStore } from "react";
import { isCovered } from "./business";
import { activeJobs } from "./engine";
import { bookingLink } from "./inquiry";
import { actions, getState, nowMs } from "./store";
import { fmtDate, localDate } from "./time";

export interface StoryStep {
  id: string;
  title: string;
  body: string;
  /** CSS selector to scroll into view once the page is there. */
  focus?: string;
  /** Changes the app's state (if the step needs to) and returns where to look, plus an optional sentence that replaces the body. */
  enter: () => { route: string; body?: string };
}

const EXAMPLE = "My dog wrecked my Outback. I'm in Sellwood. Friday morning?";
const exampleRoute = () => bookingLink({ vehicle: "suv", service: "interior", addons: ["pet"], zip: "97202", ask: { message: EXAMPLE, when: "Friday morning" } });

/** The customer the story follows on the day itself. */
let followed: string | null = null;
const portal = () => (followed ? `/b/${followed}` : "/owner");

export const STEPS: StoryStep[] = [
  {
    id: "meet",
    title: "Meet Dario",
    body: "Dario Reyes runs Fernhill Mobile Detail alone: one man, one van named Bertha, in a city with about 150 rainy days a year. He used to lose his evenings to texting, rain reschedules and no-shows. Fernhill now does all three for him.",
    enter: () => { actions.reset(); followed = null; return { route: "/" }; },
  },
  {
    id: "text",
    title: "A customer texts once",
    body: "“My dog wrecked my Outback. I'm in Sellwood. Friday morning?” Fernhill reads the car, the service, the pet-hair add-on and the neighbourhood, fills the booking in, and shows only dry days with Dario's drive time already counted.",
    enter: () => ({ route: exampleRoute() }),
  },
  {
    id: "deposit",
    title: "A deposit that feels safe",
    body: "She adds a street, taps a time and reviews everything: price, weather-sensitivity, the exact window. A $25 deposit holds the slot and comes off the total. If Dario has to move her for rain, it's refunded in full. She gets a booking page with a calendar file, reschedule and cancel, so nobody has to phone anybody.",
    enter: () => ({ route: exampleRoute() }),
  },
  {
    id: "morning",
    title: "Dario's morning: nothing needs him",
    body: "This is his side. Confirmations, reminders and the route are already done, and every line on this page is a real, logged action. He only sees the few things that truly need a human.",
    focus: "#handled-h",
    enter: () => ({ route: "/owner" }),
  },
  {
    id: "storm",
    title: "A storm is forecast",
    body: "Heavy rain is coming on his busiest outdoor day. Watch the whole app turn to its rain colours.",
    focus: "#handled-h",
    enter: () => {
      const r = actions.stormOnBusiestOutdoorDay();
      return {
        route: "/owner",
        body: r
          ? `Heavy rain is forecast for ${fmtDate(r.date, "EEEE, MMMM d")}, Dario's busiest outdoor day. The whole app turns to its rain colours, and every customer with an outdoor car has been texted the nearest dry times. Covered cars are left alone.`
          : undefined,
      };
    },
  },
  {
    id: "moves",
    title: "Customers move themselves",
    body: "Twelve hours later customers have picked dry days, or Fernhill took the first dry option for them. The weather moves are counted on Dario's page. He typed nothing.",
    focus: "#handled-h",
    enter: () => { actions.fastForward(6); actions.fastForward(6); return { route: "/owner" }; },
  },
  {
    id: "van",
    title: "Where's Bertha?",
    body: "It's job-day morning. Instead of texting “where are you?”, the customer watches the van drive to her on a live map. Her own stop is named and every other stop is anonymous.",
    focus: '[aria-label="Where\'s Bertha?"]',
    enter: () => {
      actions.jumpToNextJobMorning();
      const today = localDate(nowMs());
      // A covered car, so the storm can't have touched this customer's plans; else the first job of the day.
      const jobs = activeJobs(getState()).filter((j) => localDate(j.startMs) === today).sort((a, b) => a.startMs - b.startMs);
      const job = jobs.find((j) => isCovered(j.parking)) ?? jobs[0];
      followed = job?.code ?? null;
      return { route: portal() };
    },
  },
  {
    id: "late",
    title: "Running 20 minutes behind",
    body: "One tap. Everyone still to come today gets a text with a recalculated arrival, and their live map moves. The booked slot never changes, and Dario typed nothing.",
    focus: '[aria-label="Running late"]',
    enter: () => {
      try { actions.demoRunningBehind(20); } catch { /* nothing left to be late for */ }
      return { route: portal() };
    },
  },
  {
    id: "end",
    title: "Hours of admin, gone",
    body: "Texts answered, deposits taken, a storm handled, gaps refilled and late customers told, all while Dario was under a dashboard. That's Fernhill Mobile Detail, built with Lovable for the #lovablechallenge.",
    focus: "#handled-h",
    enter: () => ({ route: "/owner" }),
  },
];

// A tiny external store, so any page can start the story and the panel can follow it.
interface Snap { active: boolean; step: number; auto: boolean; route: string; body: string; tick: number }
let snap: Snap = { active: false, step: 0, auto: false, route: "/", body: "", tick: 0 };
const listeners = new Set<() => void>();
const set = (next: Partial<Snap>) => { snap = { ...snap, ...next }; listeners.forEach((l) => l()); };

export const storyStore = {
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  get: () => snap,
  goTo(step: number) {
    const i = Math.max(0, Math.min(STEPS.length - 1, step));
    const r = STEPS[i].enter();
    set({ active: true, step: i, route: r.route, body: r.body ?? STEPS[i].body, tick: snap.tick + 1 });
  },
  start() { storyStore.goTo(0); },
  next() { if (snap.step < STEPS.length - 1) storyStore.goTo(snap.step + 1); },
  toggleAuto() { set({ auto: !snap.auto }); },
  exit() { set({ active: false, auto: false }); },
  /** The last step's way out: a clean week and the booking page, for the visitor to try it themselves. */
  tryIt(): string { actions.reset(); followed = null; set({ active: false, auto: false }); return "/book"; },
};

export const useStory = () => useSyncExternalStore(storyStore.subscribe, storyStore.get, storyStore.get);
