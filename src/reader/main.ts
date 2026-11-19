// Reader entry: reads the document embedded in the page, validates it, and opens it.
import type { AdeDocument } from "../format/types.ts";
import { validate } from "../format/validate.ts";
import { themesCss } from "../kit/theme.ts";
import { Reader } from "./shell.ts";
import { READER_CSS } from "./styles.ts";
import { Paragraph, PARAGRAPH_CSS } from "./paragraph.ts";
import { Parts, PARTS_CSS } from "./parts.ts";
import { Motion, MOTION_CSS } from "./motion.ts";

const style = document.createElement("style");
try { const t = sessionStorage.getItem("ade-theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
style.textContent = themesCss() + READER_CSS + PARAGRAPH_CSS + PARTS_CSS + MOTION_CSS;
document.head.append(style);

const raw = document.getElementById("ade-doc")?.textContent ?? "";
const root = document.createElement("div");
document.body.append(root);
let doc: unknown;
try { doc = JSON.parse(raw); } catch { doc = null; }
const issues = doc ? validate(doc) : [{ path: "$", message: "is not valid JSON" }];
if (issues.length) {
  root.className = "ade-root";
  root.innerHTML = `<div style="padding:48px 72px;font:15px/1.5 system-ui"><h1 style="font-size:22px">This document cannot be opened</h1>` +
    `<ul>${issues.map((i) => `<li><code>${i.path}</code> ${i.message}</li>`).join("")}</ul></div>`;
} else {
  const paragraph = new Paragraph();
  const reader = new Reader(doc as AdeDocument, root).use(paragraph).use(new Parts(paragraph)).use(new Motion());
  (window as any).ade = reader; // for checks and debugging
  reader.start();
}
