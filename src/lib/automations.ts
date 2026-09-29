// The owner's "nothing to do" machinery. `tick` is safe to call at any time: it
// does only what is due, in chronological order, and never does anything twice.
import { CONFIRM_NUDGE_H, RAIN_CHECK_H, RELEASE_H } from "./business";
import { isRainRisk } from "./engine";
import { ACTIVE, type Job, type State } from "./model";
import { chooseRainOption, claimOffer, confirmJob, makeRainOffer, offerBackfill, pushEvent, releaseJob, scheduleNextVisit, sendForJob } from "./ops";
import { HOUR, MIN, fmtDay, fmtTime } from "./time";

export type StepKind = "prep" | "reminder" | "simConfirm" | "nudge" | "release" | "omw" | "complete" | "aftercare";

export interface Step {
  kind: StepKind;
  at: number;
  label: string;
}

/** The scheduled steps for a job. They are derived from its start, so moving the job moves them. */
export function plan(job: Job): Step[] {
  const arrival = job.startMs + (job.delayMin ?? 0) * MIN;
  const end = arrival + job.durationMin * MIN;
  const steps: Step[] = [
    { kind: "prep", at: job.startMs - 48 * HOUR, label: "Prep note" },
    { kind: "reminder", at: job.startMs - 24 * HOUR, label: "Reminder with one-tap confirm" },
  ];
  if (job.simReplies) steps.push({ kind: "simConfirm", at: job.startMs - 24 * HOUR + 40 * MIN, label: "Customer confirms" });
  steps.push(
    { kind: "nudge", at: job.startMs - CONFIRM_NUDGE_H * HOUR, label: "Second nudge if unconfirmed" },
    { kind: "release", at: job.startMs - RELEASE_H * HOUR, label: "Release the slot if still unconfirmed" },
    { kind: "omw", at: arrival - 30 * MIN, label: "On-my-way text" },
    { kind: "complete", at: end, label: "Job marked done" },
    { kind: "aftercare", at: end + 2 * HOUR, label: "Care tips and rebook link" },
  );
  return steps;
}

export interface TimelineItem extends Step {
  state: "sent" | "upcoming" | "skipped";
}

/** The plan as the customer and owner see it: what has gone out, and what is queued. */
export function timelineFor(state: State, job: Job, nowMs: number): TimelineItem[] {
  return plan(job)
    .filter((s) => s.kind !== "simConfirm" && s.kind !== "complete")
    .filter((s) => s.at >= job.createdAt)
    .map((s) => {
      const sent = state.messages.some((m) => m.key === `${job.id}:${s.kind}:${job.startMs}`);
      const passed = s.at <= nowMs;
      let st: TimelineItem["state"] = sent ? "sent" : passed ? "skipped" : "upcoming";
      if (s.kind === "nudge" || s.kind === "release") {
        if (job.status === "confirmed" && !sent) st = passed ? "skipped" : "upcoming";
      }
      return { ...s, state: st };
    });
}

/** Deterministic stand-in for how a seeded customer behaves. */
const coin = (id: string) => [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 2 === 0;

export function tick(state: State, nowMs: number): State {
  let s = state;
  const done = new Set<string>();

  for (let guard = 0; guard < 200; guard++) {
    const due: { job: Job; step: Step }[] = [];
    for (const job of s.jobs) {
      if (![...ACTIVE, "completed"].includes(job.status)) continue;
      for (const step of plan(job)) {
        if (step.at > nowMs) continue;
        if (step.at < job.createdAt) continue;
        const key = `${job.id}:${step.kind}:${job.startMs}`;
        if (done.has(key) || s.messages.some((m) => m.key === key)) continue;
        due.push({ job, step });
      }
    }
    if (!due.length) break;
    due.sort((a, b) => a.step.at - b.step.at);
    const { job, step } = due[0];
    done.add(`${job.id}:${step.kind}:${job.startMs}`);
    if (step.kind === "simConfirm") {
      if (job.status === "booked") s = confirmJob(s, job.id, step.at);
      continue;
    }
    const act =
      (step.kind === "prep" && ACTIVE.includes(job.status)) ||
      (step.kind === "reminder" && job.status === "booked") ||
      (step.kind === "nudge" && job.status === "booked") ||
      (step.kind === "release" && job.status === "booked") ||
      (step.kind === "omw" && ACTIVE.includes(job.status)) ||
      (step.kind === "complete" && ACTIVE.includes(job.status)) ||
      (step.kind === "aftercare" && job.status === "completed");
    if (!act) continue;
    s = structuredClone(s);
    const j = s.jobs.find((x) => x.id === job.id)!;
    switch (step.kind) {
      case "prep": sendForJob(s, j, "prep", step.at); break;
      case "reminder": sendForJob(s, j, "reminder", step.at); break;
      case "nudge": sendForJob(s, j, "nudge", step.at); break;
      case "release": releaseJob(s, j, step.at); break;
      case "omw": sendForJob(s, j, "omw", step.at); break;
      case "complete":
        j.status = "completed";
        j.closedAt = step.at;
        j.depositState = "applied";
        pushEvent(s, step.at, "completed", j.id, `${j.customer.name}: job done`);
        scheduleNextVisit(s, j, step.at);
        break;
      case "aftercare": sendForJob(s, j, "aftercare", step.at); break;
    }
  }

  // Event-driven checks at `nowMs` --------------------------------------------
  const rainIds = s.jobs
    .filter((job) => {
      const until = job.startMs - nowMs;
      return ACTIVE.includes(job.status) && !job.rainOffer && !job.ownerFlag && until > 0 && until <= RAIN_CHECK_H * HOUR && isRainRisk(s, job.startMs, job.parking, job.addons);
    })
    .map((j) => j.id);
  const expiredIds = s.waitlist.filter((w) => w.status === "offered" && w.offer && w.offer.expiresAt <= nowMs).map((w) => w.id);

  let out = s;
  if (rainIds.length || expiredIds.length) {
    out = structuredClone(s);
    for (const id of rainIds) makeRainOffer(out, out.jobs.find((j) => j.id === id)!, nowMs);
    // Waitlist offers that were not taken go to the next person.
    for (const id of expiredIds) {
      const entry = out.waitlist.find((w) => w.id === id)!;
      const w = entry.offer!;
      entry.status = "expired";
      entry.offer = null;
      offerBackfill(out, { start: w.windowStart, end: w.windowEnd }, nowMs, [entry.id]);
    }
  }

  // Simulated customers respond, so the demo shows both halves.
  for (const job of out.jobs) {
    if (ACTIVE.includes(job.status) && job.rainOffer) {
      const offer = job.rainOffer;
      if (job.simReplies && coin(job.id) && nowMs >= offer.createdAt + 90 * MIN) {
        try { out = chooseRainOption(out, job.id, 0, offer.createdAt + 90 * MIN, "customer"); } catch { /* option went stale */ }
      } else if (nowMs >= offer.autoAt) {
        try { out = chooseRainOption(out, job.id, 0, offer.autoAt, "auto_rain"); }
        catch {
          const fresh = structuredClone(out);
          const j = fresh.jobs.find((x) => x.id === job.id)!;
          j.rainOffer = null;
          j.ownerFlag = `Rain is forecast for ${fmtDay(j.startMs)} at ${fmtTime(j.startMs)}, and ${j.customer.name} didn't pick a new time. Needs a call.`;
          out = fresh;
        }
      }
    }
  }
  for (const entry of out.waitlist) {
    if (entry.status === "offered" && entry.simClaims && entry.offer && nowMs >= entry.offer.expiresAt - 100 * MIN) {
      try { out = claimOffer(out, entry.id, entry.offer.expiresAt - 100 * MIN).state; } catch { /* taken */ }
    }
  }
  return out;
}

/** Step the clock forward hour by hour so everything happens in the right order. */
export function advance(state: State, fromMs: number, toMs: number): State {
  let s = state;
  for (let t = fromMs + HOUR; t < toMs; t += HOUR) s = tick(s, t);
  return tick(s, toMs);
}
