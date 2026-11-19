// Usage: npm run build -- <file.ade.json> [out.html]
// Bundles the reader and the document into one self-contained HTML file.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import { build } from "esbuild";
import { validate } from "../src/format/validate.ts";

const [file, outArg] = process.argv.slice(2);
if (!file) { console.error("usage: build <file.ade.json> [out.html]"); process.exit(2); }
const doc = JSON.parse(readFileSync(file, "utf8"));
const issues = validate(doc);
if (issues.length) {
  for (const i of issues) console.error(`${file}: ${i.path} ${i.message}`);
  console.error(`not exported: ${issues.length} issue(s)`);
  process.exit(1);
}
const res = await build({ entryPoints: ["src/reader/main.ts"], bundle: true, write: false, format: "iife", minify: true, target: "es2020", legalComments: "none" });
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const json = JSON.stringify(doc).replace(/</g, "\\u003c");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${esc(doc.main.title)}</title></head><body><script id="ade-doc" type="application/json">${json}</script><script>${js}</script></body></html>`;
const out = outArg ?? `dist/${basename(file).replace(/\.ade\.json$|\.json$/, "")}.html`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} KB)`);
