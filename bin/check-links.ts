// Usage: npm run check-links -- <file.ade.json>
// Requests every source URL in a document and reports the ones that do not resolve.
import { readFileSync } from "node:fs";
import type { AdeDocument } from "../src/format/types.ts";

const file = process.argv[2];
if (!file) { console.error("usage: check-links <file.ade.json>"); process.exit(2); }
const doc: AdeDocument = JSON.parse(readFileSync(file, "utf8"));
const urls = [...new Set([doc.main, ...doc.levels].flatMap((p) => p.sources.map((s) => s.url)))];

async function check(url: string): Promise<string | null> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": "ade-link-check/0.1" } });
      if (r.ok) return null;
      if (method === "GET") return `HTTP ${r.status}`;
    } catch (e) {
      if (method === "GET") return (e as Error).message;
    }
  }
  return "unreachable";
}

const results = await Promise.all(urls.map(async (u) => [u, await check(u)] as const));
let bad = 0;
for (const [u, err] of results) {
  console.log(`${err ? "FAIL" : "ok  "} ${u}${err ? `  (${err})` : ""}`);
  if (err) bad++;
}
console.log(`${urls.length - bad} of ${urls.length} links resolve`);
process.exit(bad ? 1 : 0);
