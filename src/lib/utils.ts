import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** "one", "two" … for the handful of numbers Threshold speaks aloud. */
export function spell(n: number): string {
  return ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** True when the person has asked their system for less motion. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Words for a Guide, from the pronouns they gave. Defaults to they/them. */
export function pronounsOf(pronouns: string | null | undefined) {
  const p = (pronouns ?? "").toLowerCase();
  if (p.startsWith("she")) return { subject: "she", possessive: "her", plural: false };
  if (p.startsWith("he")) return { subject: "he", possessive: "his", plural: false };
  return { subject: "they", possessive: "their", plural: true };
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
