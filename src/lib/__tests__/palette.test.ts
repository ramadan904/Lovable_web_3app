import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Reads the real tokens from index.css, so the palette can't drift out of readability unnoticed.
const css = readFileSync("src/index.css", "utf8");
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n  }", start));
};
const parse = (b: string) => {
  const out: Record<string, [number, number, number]> = {};
  for (const m of b.matchAll(/--([a-z0-9-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return out;
};

const dry = parse(block(":root"));
const rain = { ...dry, ...parse(block(':root[data-weather="rain"]')) };

function rgb([h, s, l]: [number, number, number]): [number, number, number] {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const lum = (c: [number, number, number]) => {
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Every text-on-surface pairing the UI uses. Body text needs 4.5:1.
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"], ["foreground", "card"], ["muted-foreground", "background"], ["muted-foreground", "muted"],
  ["muted-foreground", "card"], ["primary-foreground", "primary"], ["primary", "background"], ["primary", "card"],
  ["fern-ink", "fern-soft"], ["sun-ink", "sun-soft"], ["sun-ink", "sun"], ["rain", "rain-soft"], ["rain", "card"], ["danger", "danger-soft"],
];
// The iridescent headline word is large text on the page background (needs 3:1); we hold it to 4.5:1.
const IRIS = ["iris-1", "iris-2", "iris-3", "iris-4"];

describe.each([["dry", dry], ["rain", rain]] as const)("%s palette", (_name, t) => {
  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1", (fg, bg) => {
    expect(t[fg], `--${fg}`).toBeDefined();
    expect(t[bg], `--${bg}`).toBeDefined();
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(IRIS)("%s (iridescent text) reads on the page and card backgrounds", (iris) => {
    expect(ratio(t[iris], t.background)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t[iris], t.card)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("rain mode is a real change, and a believable one", () => {
  it("cools the paper and the ink but keeps the warm amber, like streetlights on a wet road", () => {
    expect(rain.background[0]).toBeGreaterThan(200); // blue-grey hue
    expect(dry.background[0]).toBeLessThan(60); // warm paper
    expect(rain.primary[0]).toBeGreaterThan(190); // petrol, not fir
    expect(rain.sun).toEqual(dry.sun);
    // Overcast, not saturated: the rain paper stays low in chroma.
    expect(rain.background[1]).toBeLessThanOrEqual(35);
  });
});
