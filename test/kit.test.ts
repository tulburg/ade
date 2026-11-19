import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderFigure, tagBox, contentBox } from "../src/kit/render.ts";
import { themeCss } from "../src/kit/theme.ts";
import type { AdeDocument, Figure, Part } from "../src/format/types.ts";

const doc: AdeDocument = JSON.parse(readFileSync(new URL("./fixtures/ai-coding-agent.ade.json", import.meta.url), "utf8"));
const figs = [...doc.levels.map((l) => l.figure), doc.main.figure];

test("every fixture figure renders, with one group per part and every tag present", () => {
  for (const f of figs) {
    const svg = renderFigure(f);
    assert.match(svg, /^<svg class="ade-figure"/);
    for (const p of f.parts) {
      assert.ok(svg.includes(`data-part="${p.id}"`), `part ${p.id} drawn`);
      if (p.tag) assert.ok(svg.includes(`data-tag="${p.tag}"`), `tag ${p.tag} drawn`);
    }
    assert.equal((svg.match(/class="[^"]*ade-move/g) ?? []).length, f.parts.filter((p) => p.motion).length);
  }
});

test("S-15: every tag sits on a label row outside its part, inset 12 from a big part's corner", () => {
  const small: Part = { id: "s", kind: "chip", x: 100, y: 100, w: 120, h: 28, tag: "C4", caption: "The tool call it writes" };
  const big: Part = { id: "b", kind: "panel", x: 100, y: 100, w: 200, h: 120, tag: "C5", corner: "tr", caption: "What the agent can do" };
  assert.equal(tagBox(small).outside, true);
  assert.ok(tagBox(small).y < small.y);
  assert.equal(tagBox(big).outside, true);
  assert.equal(tagBox(big).y + tagBox(big).h, big.y - 8);
  assert.equal(tagBox(big).x + tagBox(big).w, big.x + big.w - 12);
  const below = { ...big, props: { captionBelow: true } };
  assert.equal(tagBox(below).y, big.y + big.h + 8);
});

test("parts are drawn where the document places them", () => {
  const f: Figure = { width: 1000, height: 200, label: "x", connections: [], parts: [{ id: "p", kind: "panel", x: 123, y: 45, w: 200, h: 100 }] };
  assert.ok(renderFigure(f).includes('x="123" y="45" width="200" height="100"'));
});

test("the view box hugs the drawing so the figure spans the page margins", () => {
  const b = contentBox(doc.main.figure);
  assert.ok(b.x > 0 && b.x < 40, `left edge ${b.x}`);
  assert.ok(b.x + b.w > 960 && b.x + b.w < 1000, `right edge ${b.x + b.w}`);
});

test("an unknown part kind fails loudly", () => {
  const f: Figure = { width: 1000, height: 200, label: "x", connections: [], parts: [{ id: "p", kind: "blob", x: 0, y: 0, w: 10, h: 10 }] };
  assert.throws(() => renderFigure(f), /unknown part kind "blob"/);
});

test("one SVG serves both themes: colours are CSS variables only", () => {
  const svg = renderFigure(doc.main.figure);
  assert.ok(!/(fill|stroke)="#(?!ffffff)/i.test(svg), "no hard-coded colours except the lamp highlight");
  for (const t of ["light", "dark"] as const) assert.match(themeCss(t), /--ade-accent:#/);
});
