// Writes design/kit-preview/<level>-<theme>.html: each fixture figure drawn by the kit, for screenshot comparison.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderFigure } from "../src/kit/render.ts";
import { themeCss, type ThemeName } from "../src/kit/theme.ts";
import type { AdeDocument } from "../src/format/types.ts";

const [file = "test/fixtures/ai-coding-agent.ade.json", out = "design/kit-preview"] = process.argv.slice(2);
const doc: AdeDocument = JSON.parse(readFileSync(file, "utf8"));
mkdirSync(out, { recursive: true });
const pages = [...doc.levels.map((l) => [l.id, l.figure] as const), ["main", doc.main.figure] as const];
for (const theme of ["light", "dark"] as ThemeName[])
  for (const [id, fig] of pages)
    writeFileSync(`${out}/${id}-${theme}.html`,
      `<!doctype html><meta charset="utf-8"><body style="margin:0;${themeCss(theme)}background:var(--ade-page)">` +
      `<style>.ade-outline{display:none}.ade-open .ade-outline{display:inline}</style>` +
      `<div style="width:1296px;padding:40px 72px">${renderFigure(fig)}</div></body>`);
console.log("wrote", pages.length * 2, "previews to", out);
