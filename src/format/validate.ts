// Validates an ADE document: first against schema/ade.schema.json, then the rules a schema
// cannot express (tags exist, word limits, defined terms, motion count). Every issue carries
// the JSON path of the place it is about.
import type { AdeDocument, Issue, Main } from "./types.ts";
import { overflow } from "../kit/render.ts";
import schema from "../../schema/ade.schema.json" with { type: "json" };

type Schema = Record<string, any>;

const MAX_MOVING = 3;
const CAPTION_WORDS = [5, 8] as const;
const NOTE_WORDS = 5;

export function validate(doc: unknown): Issue[] {
  const issues: Issue[] = [];
  checkSchema(doc, schema as Schema, "$", issues);
  if (issues.length) return issues; // the rules below assume the shape is right
  checkRules(doc as AdeDocument, issues);
  return issues;
}

// ---------------------------------------------------------------- JSON Schema (the subset ADE uses)

function resolve(s: Schema): Schema {
  if (typeof s.$ref !== "string") return s;
  const name = s.$ref.replace("#/$defs/", "");
  const target = (schema as Schema).$defs[name];
  if (!target) throw new Error(`schema: unknown $ref ${s.$ref}`);
  return { ...target, ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== "$ref")) };
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function checkSchema(v: unknown, raw: Schema, path: string, out: Issue[]): void {
  const s = resolve(raw);
  const t = typeOf(v);
  const bad = (message: string): void => { out.push({ path, message }); };

  if ("const" in s && v !== s.const) return bad(`must be ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.includes(v)) return bad(`must be one of ${s.enum.map((e: unknown) => JSON.stringify(e)).join(", ")}`);
  if (s.type) {
    const ok = s.type === t || (s.type === "number" && t === "integer");
    if (!ok) return bad(`must be ${s.type === "object" || s.type === "array" || s.type === "integer" ? "an" : "a"} ${s.type}`);
  }
  if (t === "string") {
    const str = v as string;
    if (s.minLength !== undefined && str.length < s.minLength) bad("must not be empty");
    if (s.pattern && !new RegExp(s.pattern).test(str)) bad(`does not match ${s.pattern}`);
  }
  if (t === "number" || t === "integer") {
    const n = v as number;
    if (s.minimum !== undefined && n < s.minimum) bad(`must be at least ${s.minimum}`);
    if (s.maximum !== undefined && n > s.maximum) bad(`must be at most ${s.maximum}`);
    if (s.exclusiveMinimum !== undefined && n <= s.exclusiveMinimum) bad(`must be more than ${s.exclusiveMinimum}`);
  }
  if (t === "array") {
    const arr = v as unknown[];
    if (s.minItems !== undefined && arr.length < s.minItems) bad(`needs at least ${s.minItems} item(s)`);
    if (s.maxItems !== undefined && arr.length > s.maxItems) bad(`allows at most ${s.maxItems} item(s), has ${arr.length}`);
    if (s.items) arr.forEach((item, i) => checkSchema(item, s.items, `${path}[${i}]`, out));
  }
  if (t === "object") {
    const obj = v as Record<string, unknown>;
    for (const key of s.required ?? []) if (!(key in obj)) out.push({ path: `${path}.${key}`, message: "is required" });
    for (const [key, val] of Object.entries(obj)) {
      if (s.properties?.[key]) checkSchema(val, s.properties[key], `${path}.${key}`, out);
      else if (s.additionalProperties === false) out.push({ path: `${path}.${key}`, message: "is not allowed" });
    }
  }
}

// ---------------------------------------------------------------- rules beyond the schema

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function checkRules(doc: AdeDocument, out: Issue[]): void {
  const pages: { id: string; page: Main; path: string }[] = [
    ...doc.levels.map((l, i) => ({ id: l.id, page: l as Main, path: `$.levels[${i}]` })),
    { id: "main", page: doc.main, path: "$.main" },
  ];

  doc.levels.forEach((l, i) => {
    if (l.id !== `L${i + 1}`) out.push({ path: `$.levels[${i}].id`, message: `must be L${i + 1} (levels are in reading order)` });
  });

  // tags of every page, for cross-level references
  const tagsOf = new Map<string, Set<string>>();
  for (const { id, page } of pages) tagsOf.set(id, new Set(page.figure.parts.flatMap((p) => (p.tag ? [p.tag] : []))));

  // golden rule (D-10): a term is defined on one page; later pages may use it
  const termHome = new Map<string, string>(); // term -> path of its definition
  const availableAt: Set<string>[] = []; // terms usable on page i: its own and every earlier page's
  pages.forEach(({ page, path }, pi) => {
    const usable = new Set(pi > 0 ? availableAt[pi - 1] : []);
    page.terms.forEach((t, i) => {
      const key = t.term.toLowerCase(), at = `${path}.terms[${i}].term`;
      const home = termHome.get(key);
      if (home && !home.startsWith(`${path}.`))
        out.push({ path: at, message: `"${t.term}" is already defined at ${home}; define a term on one page only and use it from later pages` });
      else if (!home) termHome.set(key, at);
      usable.add(key);
    });
    availableAt.push(usable);
  });
  checkOverlap(pages, out);

  pages.forEach(({ id, page, path }, pi) => {
    const tagExists = (ref: string, at: string) => {
      const [lvl, tag] = ref.includes(" ") ? ref.split(" ") : [id, ref];
      const tags = tagsOf.get(lvl);
      if (!tags) out.push({ path: at, message: `cites ${ref}, but this document has no level ${lvl}` });
      else if (!tags.has(tag)) out.push({ path: at, message: `cites ${ref}, but ${lvl === id ? "this level" : lvl} has no part tagged ${tag}` });
    };
    const sourceExists = (refs: number[], at: string) =>
      refs.forEach((n, i) => {
        if (n > page.sources.length) out.push({ path: `${at}[${i}]`, message: `points at source ${n}, but this level has ${page.sources.length}` });
      });

    // paragraph marks
    const para = page.paragraph;
    const opens = (para.match(/\{/g) ?? []).length, closes = (para.match(/\}/g) ?? []).length;
    if (opens !== closes) out.push({ path: `${path}.paragraph`, message: "has an unclosed { } term mark" });
    for (const m of para.matchAll(/\{([^{}]+)\}/g)) {
      if (!availableAt[pi].has(m[1].toLowerCase()))
        out.push({ path: `${path}.paragraph`, message: `term "${m[1]}" has no definition in terms on this page or an earlier one` });
    }
    for (const m of para.matchAll(/\[(\d+)\]/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > page.sources.length) out.push({ path: `${path}.paragraph`, message: `reference [${n}] has no source (this level has ${page.sources.length})` });
    }

    // terms
    const seenTerms = new Set<string>();
    page.terms.forEach((t, i) => {
      const at = `${path}.terms[${i}]`;
      const key = t.term.toLowerCase();
      if (seenTerms.has(key)) out.push({ path: `${at}.term`, message: `"${t.term}" is defined twice` });
      seenTerms.add(key);
      if (t.part) tagExists(t.part, `${at}.part`);
      sourceExists(t.sources, `${at}.sources`);
    });

    // figure
    const fig = page.figure, fpath = `${path}.figure`;
    const ids = new Set<string>(), tags = new Set<string>();
    let moving = 0;
    const orders = new Set<number>();
    fig.parts.forEach((p, i) => {
      const at = `${fpath}.parts[${i}]`;
      if (ids.has(p.id)) out.push({ path: `${at}.id`, message: `part id "${p.id}" is used twice` });
      ids.add(p.id);
      if (p.x + p.w > fig.width || p.y + p.h > fig.height)
        out.push({ path: at, message: `sits outside the figure (${fig.width} x ${fig.height})` });
      const over = overflow(p); // S-15: content keeps 12 units of padding inside its part
      if (over) out.push({ path: at, message: `content overflows: ${over}` });
      if (p.tag) {
        if (tags.has(p.tag)) out.push({ path: `${at}.tag`, message: `tag ${p.tag} is used twice on this level` });
        tags.add(p.tag);
        if (!p.caption) out.push({ path: `${at}.caption`, message: "a clickable (tagged) part needs a caption" });
        else {
          const n = words(p.caption);
          if (n < CAPTION_WORDS[0] || n > CAPTION_WORDS[1])
            out.push({ path: `${at}.caption`, message: `caption has ${n} words; it must have ${CAPTION_WORDS[0]} to ${CAPTION_WORDS[1]}` });
        }
        if (!p.explainer) out.push({ path: `${at}.explainer`, message: "a clickable (tagged) part needs an explainer" });
      } else {
        if (p.caption) out.push({ path: `${at}.caption`, message: "only a tagged part has a caption" });
        if (p.explainer) out.push({ path: `${at}.explainer`, message: "only a tagged part has an explainer" });
      }
      if (p.explainer) {
        p.explainer.connects.forEach((c, j) => tagExists(c.tag, `${at}.explainer.connects[${j}].tag`));
        sourceExists(p.explainer.sources, `${at}.explainer.sources`);
      }
      if (p.motion) {
        moving++;
        if (orders.has(p.motion.order)) out.push({ path: `${at}.motion.order`, message: `motion order ${p.motion.order} is used twice` });
        orders.add(p.motion.order);
      }
    });
    if (moving > MAX_MOVING) out.push({ path: `${fpath}.parts`, message: `has ${moving} moving parts; at most ${MAX_MOVING} are allowed` });

    fig.connections.forEach((c, i) => {
      const at = `${fpath}.connections[${i}]`;
      if (!ids.has(c.from)) out.push({ path: `${at}.from`, message: `no part with id "${c.from}"` });
      if (!ids.has(c.to)) out.push({ path: `${at}.to`, message: `no part with id "${c.to}"` });
      if (c.note && words(c.note) > NOTE_WORDS)
        out.push({ path: `${at}.note`, message: `note has ${words(c.note)} words; at most ${NOTE_WORDS}` });
    });
  });
}

const MIN_SHARED_WORDS = 6;
const norm = (s: string) => s.replace(/\{([^{}]+)\}/g, "$1").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Sentences of 6+ words that appear on two pages, and pages whose figures are the same (D-10). */
function checkOverlap(pages: { id: string; page: Main; path: string }[], out: Issue[]) {
  const seen = new Map<string, { page: string; path: string }>();
  const texts = (page: Main, path: string): [string, string][] => [
    [page.paragraph, `${path}.paragraph`],
    ...page.terms.map((t, i): [string, string] => [t.definition, `${path}.terms[${i}].definition`]),
    ...page.figure.parts.flatMap((p, i): [string, string][] => (p.explainer ? [[p.explainer.what, `${path}.figure.parts[${i}].explainer.what`]] : [])),
  ];
  for (const { id, page, path } of pages)
    for (const [text, at] of texts(page, path))
      for (const raw of norm(text).split(/(?<=[.!?])\s+/)) {
        const sentence = raw.replace(/[.!?]+$/, "");
        if (words(sentence) < MIN_SHARED_WORDS) continue;
        const first = seen.get(sentence);
        if (first && first.page !== id) out.push({ path: at, message: `repeats a sentence from ${first.path}: "${sentence}"` });
        else if (!first) seen.set(sentence, { page: id, path: at });
      }

  const sig = (page: Main) => page.figure.parts.map((p) => `${p.kind}:${(p.caption ?? "").toLowerCase()}`).sort().join("|");
  const figs = new Map<string, string>();
  for (const { page, path } of pages) {
    const k = sig(page), first = figs.get(k);
    if (first) out.push({ path: `${path}.figure`, message: `is the same figure as ${first}.figure (same parts and captions)` });
    else figs.set(k, path);
  }
}
