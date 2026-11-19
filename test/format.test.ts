import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate } from "../src/format/validate.ts";
import type { AdeDocument, Issue } from "../src/format/types.ts";

const load = (): AdeDocument => JSON.parse(readFileSync(new URL("./fixtures/ai-coding-agent.ade.json", import.meta.url), "utf8"));
const has = (issues: Issue[], path: string, text: string) =>
  assert.ok(issues.some((i) => i.path === path && i.message.includes(text)),
    `expected "${text}" at ${path}, got:\n${issues.map((i) => `${i.path} ${i.message}`).join("\n")}`);

test("the worked example passes", () => {
  assert.deepEqual(validate(load()), []);
});

test("3 prerequisites fail", () => {
  const d = load();
  d.levels.push(structuredClone(d.levels[1]));
  has(validate(d), "$.levels", "at most 2");
});

test("a cited tag that does not exist fails", () => {
  const d = load();
  d.main.figure.parts[1].explainer!.connects[0].tag = "C9";
  has(validate(d), "$.main.figure.parts[1].explainer.connects[0].tag", "has no part tagged C9");
});

test("a cross-level tag that does not exist fails", () => {
  const d = load();
  d.main.figure.parts[2].explainer!.connects[2].tag = "L1 A9";
  has(validate(d), "$.main.figure.parts[2].explainer.connects[2].tag", "L1 has no part tagged A9");
});

test("a 4th moving part fails", () => {
  const d = load();
  d.main.figure.parts[2].motion = { order: 3, description: "extra" };
  const issues = validate(d);
  has(issues, "$.main.figure.parts", "4 moving parts");
});

test("a caption of 9 words fails", () => {
  const d = load();
  d.levels[0].figure.parts[0].caption = "one two three four five six seven eight nine";
  has(validate(d), "$.levels[0].figure.parts[0].caption", "9 words");
});

test("a term with no definition fails", () => {
  const d = load();
  d.levels[0].paragraph += " It also uses {embeddings}.";
  has(validate(d), "$.levels[0].paragraph", 'term "embeddings" has no definition');
});

test("a reference with no source fails", () => {
  const d = load();
  d.levels[1].paragraph += " See [7].";
  has(validate(d), "$.levels[1].paragraph", "reference [7] has no source");
});

test("a tagged part without an explainer fails", () => {
  const d = load();
  delete d.main.figure.parts[0].explainer;
  has(validate(d), "$.main.figure.parts[0].explainer", "needs an explainer");
});

test("a connection note over 5 words fails", () => {
  const d = load();
  d.main.figure.connections[0].note = "the task enters the context once";
  has(validate(d), "$.main.figure.connections[0].note", "6 words");
});

test("schema errors carry the JSON path", () => {
  const d = load() as any;
  d.levels[0].sources[0].kind = "blog";
  d.main.figure.width = 800;
  const issues = validate(d);
  has(issues, "$.levels[0].sources[0].kind", "must be one of");
  has(issues, "$.main.figure.width", "must be 1000");
});

test("D-10: a term defined on two pages fails, naming both places", () => {
  const d = load();
  d.levels[1].terms.push({ term: "attention", definition: "Weighing tokens against each other.", sources: [1] });
  has(validate(d), "$.levels[1].terms[4].term", "already defined at $.levels[0].terms[2].term");
});

test("D-10: a later page may use an earlier page's term, but not the other way round", () => {
  const d = load();
  assert.deepEqual(validate(d), []); // main uses L2's {context window}
  d.levels[0].paragraph += " It runs inside a {harness}.";
  has(validate(d), "$.levels[0].paragraph", 'term "harness" has no definition in terms on this page or an earlier one');
});

test("D-10: a sentence copied to another page fails, naming both places", () => {
  const d = load();
  d.main.paragraph += " Every layer uses attention to weigh each token against every other, so a word is read in the context of the words around it.";
  has(validate(d), "$.main.paragraph", "repeats a sentence from $.levels[0].paragraph");
});

test("D-10: a page repeating another page's figure fails", () => {
  const d = load();
  d.levels[1].figure = structuredClone(d.levels[0].figure);
  for (const p of d.levels[1].figure.parts) if (p.tag) p.tag = p.tag.replace("A", "B");
  for (const p of d.levels[1].figure.parts) for (const c of p.explainer?.connects ?? []) c.tag = c.tag.replace("A", "B");
  has(validate(d), "$.levels[1].figure", "is the same figure as $.levels[0].figure");
});

test("S-15: a list with more items than its part can hold fails", () => {
  const d = load();
  const i = d.main.figure.parts.findIndex((p) => p.kind === "list" && p.props?.selected === undefined);
  const part = d.main.figure.parts[i];
  part.props = { ...part.props, items: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] };
  has(validate(d), `$.main.figure.parts[${i}]`, "slots need a height");
});
