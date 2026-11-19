import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES } from "../src/kit/theme.ts";

// WCAG 2 relative luminance and contrast ratio
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// text colour -> the grounds it is drawn on
const PAIRS: [string, string[]][] = [
  ["text", ["page", "face"]],     // paragraph, captions, popup text
  ["strong", ["page", "face"]],   // titles, terms
  ["muted", ["page", "face"]],    // notes on connections, eyebrows, hints
  ["link", ["face", "linkSoft"]], // tags, references, chips
  ["btnText", ["btn"]],
];

for (const name of ["light", "dark"] as const) {
  test(`${name} theme: text meets WCAG AA (4.5:1)`, () => {
    const t = THEMES[name] as Record<string, string>;
    const fails: string[] = [];
    for (const [fg, grounds] of PAIRS) for (const bg of grounds) {
      const r = contrast(t[fg], t[bg]);
      if (r < 4.5) fails.push(`${fg} on ${bg}: ${r.toFixed(2)}`);
    }
    assert.deepEqual(fails, []);
  });
}
