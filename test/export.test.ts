import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (args: string[]) => spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "bin/build.ts", ...args], { encoding: "utf8" });
const dir = mkdtempSync(join(tmpdir(), "ade-export-"));
const fixture = "test/fixtures/ai-coding-agent.ade.json";

test("exports one self-contained HTML file under 2 MB", () => {
  const out = join(dir, "doc.html");
  const r = run([fixture, out]);
  assert.equal(r.status, 0, r.stderr);
  const html = readFileSync(out, "utf8");
  assert.ok(html.length < 2 * 1024 * 1024, `${html.length} bytes`);
  // nothing is loaded from anywhere: no external scripts, styles, images, fonts or fetches
  assert.doesNotMatch(html, /<(script|link|img|iframe)[^>]+(src|href)=/i);
  assert.doesNotMatch(html, /@import|url\(\s*['"]?https?:/i);
  assert.doesNotMatch(html, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
  // the only URLs are the document's source links (and the SVG namespace)
  const doc = JSON.parse(readFileSync(fixture, "utf8"));
  const sources = new Set([doc.main, ...doc.levels].flatMap((p: any) => p.sources.map((s: any) => s.url)));
  // identifiers that are never requested: the SVG namespace and the schema's $schema / $id
  const ids = ["http://www.w3.org/", "https://json-schema.org/draft/", "https://ade.local/schema/"];
  const urls = new Set((html.match(/https?:\/\/[^"'\s<>\\)]+/g) ?? []).filter((u) => !ids.some((i) => u.startsWith(i))));
  for (const u of urls) assert.ok(sources.has(u), `unexpected URL in export: ${u}`);
});

test("an invalid document is not exported, and the validator's messages say why", () => {
  const bad = JSON.parse(readFileSync(fixture, "utf8"));
  bad.main.figure.parts[0].caption = "too short";
  const f = join(dir, "bad.ade.json");
  writeFileSync(f, JSON.stringify(bad));
  const r = run([f, join(dir, "bad.html")]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\$\.main\.figure\.parts\[0\]\.caption caption has 2 words/);
  assert.match(r.stderr, /not exported/);
});
