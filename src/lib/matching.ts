import type { Guide, Threshold } from "./types";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ");

/** Which thresholds do the client's own words sound like? Best first. */
export function matchThresholds(words: string, thresholds: Threshold[]): Threshold[] {
  const text = ` ${normalize(words)} `;
  if (text.trim().length < 3) return [];
  return thresholds
    .map((t) => ({
      t,
      score: t.keywords.reduce((n, k) => (text.includes(` ${normalize(k).trim()}`) ? n + (k.includes(" ") ? 2 : 1) : n), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}

export const MAX_GUIDES = 5;
export const MIN_GUIDES = 3;

/**
 * Soft matching. Deliberately simple and deliberately scarce:
 * never more than five Guides, and never fewer than three.
 */
export function matchGuides(guides: Guide[], thresholdSlug: string | null, words: string, thresholds: Threshold[]): Guide[] {
  const inferred = thresholdSlug ? [thresholdSlug] : matchThresholds(words, thresholds).map((t) => t.slug);
  const text = normalize(words);

  const scored = guides.map((g) => {
    let score = 0;
    inferred.forEach((slug, i) => {
      if (g.thresholds.includes(slug)) score += i === 0 ? 10 : 4;
    });
    for (const tag of [...g.tags, g.background]) {
      for (const w of normalize(tag).split(/\s+/)) if (w.length > 4 && text.includes(w)) score += 1;
    }
    score += g.years_holding / 100; // gentle tie-break toward experience
    return { g, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const holding = scored.filter((x) => x.score >= 4);
  const chosen = (holding.length >= MIN_GUIDES ? holding : scored.slice(0, Math.max(MIN_GUIDES, holding.length))).slice(0, MAX_GUIDES);
  return chosen.map((x) => x.g);
}
