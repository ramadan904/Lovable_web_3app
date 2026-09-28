import { useCallback, useEffect, useState } from "react";
import { detectTimezone } from "@/lib/time";
import type { SessionTypeKey } from "@/lib/types";

/*
 * The ritual's draft. Kept on this device only, so a guest can leave and
 * return (or confirm an email) without losing a word. Cleared once held.
 */

export const RITUAL_KEY = "threshold.ritual";
export const STEPS = ["The threshold", "Your Guide", "Three questions", "The form", "The hour", "The letter", "Hold"] as const;
export const CONFIRMATION_STEP = STEPS.length;

export interface RitualDraft {
  step: number;
  question: number;
  thresholdSlug: string | null;
  thresholdWords: string;
  guideId: string | null;
  answers: [string, string, string];
  skipped: [boolean, boolean, boolean];
  sessionType: SessionTypeKey | null;
  clientTz: string;
  slotStart: string | null;
  letter: string;
  letterSkipped: boolean;
  clientName: string;
  notice: string | null;
  heldSessionId: string | null;
  updatedAt: string;
}

export const emptyDraft = (): RitualDraft => ({
  step: 0,
  question: 0,
  thresholdSlug: null,
  thresholdWords: "",
  guideId: null,
  answers: ["", "", ""],
  skipped: [false, false, false],
  sessionType: null,
  clientTz: detectTimezone(),
  slotStart: null,
  letter: "",
  letterSkipped: false,
  clientName: "",
  notice: null,
  heldSessionId: null,
  updatedAt: new Date().toISOString(),
});

function read(): RitualDraft | null {
  try {
    const raw = localStorage.getItem(RITUAL_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as RitualDraft;
    // A draft older than a week has probably been lived past.
    if (Date.now() - new Date(d.updatedAt).getTime() > 7 * 24 * 3600_000) return null;
    return { ...emptyDraft(), ...d };
  } catch {
    return null;
  }
}

function write(d: RitualDraft) {
  try {
    localStorage.setItem(RITUAL_KEY, JSON.stringify(d));
  } catch {
    /* private mode: the ritual still works for this visit */
  }
}

export function clearRitual() {
  try {
    localStorage.removeItem(RITUAL_KEY);
  } catch {
    /* ignore */
  }
}

export function hasRitualInProgress(): boolean {
  const d = read();
  return !!d && d.step > 0 && d.step < CONFIRMATION_STEP;
}

export function useRitual(init?: { threshold?: string | null; guideId?: string | null }) {
  const [draft, setDraft] = useState<RitualDraft>(() => {
    const existing = read();
    const base = existing && existing.step < CONFIRMATION_STEP ? existing : emptyDraft();
    if (init?.threshold && init.threshold !== base.thresholdSlug && base.step === 0) {
      return { ...base, thresholdSlug: init.threshold };
    }
    if (init?.guideId && base.step === 0) return { ...base, guideId: init.guideId };
    return base;
  });

  useEffect(() => {
    if (draft.step < CONFIRMATION_STEP) write(draft);
  }, [draft]);

  const update = useCallback((patch: Partial<RitualDraft> | ((d: RitualDraft) => Partial<RitualDraft>)) => {
    setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch), updatedAt: new Date().toISOString() }));
  }, []);

  const reset = useCallback(() => {
    clearRitual();
    setDraft(emptyDraft());
  }, []);

  return { draft, update, reset };
}
