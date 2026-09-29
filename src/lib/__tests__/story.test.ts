import { describe, expect, it } from "vitest";
import { getState } from "../store";
import { STEPS, storyStore } from "../story";

describe("the guided story", () => {
  it("runs end to end on a fresh week, changing the real state and always pointing somewhere real", () => {
    storyStore.start();
    const routes: string[] = [storyStore.get().route];
    expect(getState().stormDays).toEqual([]); // a clean week to begin with
    for (let i = 1; i < STEPS.length; i++) { storyStore.next(); routes.push(storyStore.get().route); }

    expect(storyStore.get().step).toBe(STEPS.length - 1);
    expect(routes[0]).toBe("/");
    expect(routes[1]).toMatch(/^\/book\?.*v=suv.*s=interior.*a=pet.*zip=97202.*src=ask/);
    expect(routes.every((r) => r.startsWith("/"))).toBe(true);

    // The storm step really forecast rain, and the customer steps follow a real booking.
    expect(getState().stormDays.length).toBeGreaterThan(0);
    const portal = routes[STEPS.findIndex((s) => s.id === "van")];
    expect(portal).toMatch(/^\/b\/FH-[A-Z0-9]{4}$/);
    expect(routes[STEPS.findIndex((s) => s.id === "late")]).toBe(portal);
    expect(getState().jobs.some((j) => j.delayMin > 0)).toBe(true); // Bertha really ran late
  });

  it("names the storm day in the caption, and can be left or restarted", () => {
    storyStore.start();
    while (storyStore.get().step < STEPS.findIndex((s) => s.id === "storm")) storyStore.next();
    expect(storyStore.get().body).toMatch(/Heavy rain is forecast for \w+day, \w+ \d+/);
    storyStore.exit();
    expect(storyStore.get().active).toBe(false);
    storyStore.start();
    expect(storyStore.get()).toMatchObject({ active: true, step: 0 });
    expect(getState().stormDays).toEqual([]); // restarting gives a fresh week
    storyStore.exit();
  });
});
