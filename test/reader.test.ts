import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pagesOf, nextPage } from "../src/reader/shell.ts";
import type { AdeDocument } from "../src/format/types.ts";

const doc: AdeDocument = JSON.parse(readFileSync(new URL("./fixtures/ai-coding-agent.ade.json", import.meta.url), "utf8"));
const names = (d: AdeDocument) => pagesOf(d).map((p) => (p.type === "main" ? "main" : `${p.level.id}-${p.type}`));

test("pages: each prerequisite is a cover then its revealed level; the main concept is last", () => {
  assert.deepEqual(names(doc), ["L1-cover", "L1-level", "L2-cover", "L2-level", "main"]);
});

test("a document with no prerequisites opens straight on the main concept", () => {
  assert.deepEqual(names({ ...doc, levels: [] }), ["main"]);
});

test("S-14: after a No, Next skips the later covers; after a Yes, the next cover is asked", () => {
  const pages = pagesOf(doc), at = (i: number) => names(doc)[i];
  // No on L1 (index 0) reveals L1 (1); Next goes to L2's page, not its cover, then to main.
  assert.equal(at(nextPage(pages, 1, true)), "L2-level");
  assert.equal(at(nextPage(pages, 3, true)), "main");
  // Yes on L1 goes to L2's cover; No there reveals L2, and Next goes to main.
  assert.equal(at(nextPage(pages, 0, false)), "L2-cover");
  assert.equal(at(nextPage(pages, 3, false)), "main");
});

import { renderParagraph } from "../src/reader/paragraph.ts";

test("paragraph: terms become buttons and a reference stays with the word before it", () => {
  const html = renderParagraph("It uses {attention} to read words around it.[1] Then {tokens}[2] go on.");
  assert.match(html, /<button class="ade-term" data-term="attention">attention<\/button>/);
  assert.match(html, /<span class="ade-nowrap">it\.<button class="ade-ref" data-ref="1"/);
  assert.match(html, /<span class="ade-nowrap"><button class="ade-term" data-term="tokens">tokens<\/button><button class="ade-ref" data-ref="2"/);
});
