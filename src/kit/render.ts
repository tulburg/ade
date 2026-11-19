// The ADE figure kit: draws a figure from document data as flat 2D SVG, in the approved S-2 look.
// Parts sit exactly where the document places them on the 1000-unit grid (D-5); the kit never
// moves them. Colours are CSS variables (--ade-*), so one SVG serves both themes (src/kit/theme.ts).
import type { Connection, Figure, Part } from "../format/types.ts";

const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif";
const c = (name: string) => `var(--ade-${name})`;

export const SMALL = { w: 60, h: 40 } as const;
export const isSmall = (p: Part) => p.w < SMALL.w || p.h < SMALL.h;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => Math.round(v * 100) / 100;
const textWidth = (s: string, size: number, mono = true) => s.length * size * (mono ? 0.62 : 0.52);

class Svg {
  o: string[] = [];
  add(x: string) { this.o.push(x); }
  rect(x: number, y: number, w: number, h: number, r = 4, fill = "none", stroke = "none", sw = 0.8, extra = "") {
    this.add(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`);
  }
  line(pts: [number, number][], tone = "lo", sw = 0.8, extra = "") {
    const d = "M" + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L");
    this.add(`<path d="${d}" fill="none" stroke="${c(tone)}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`);
  }
  dot(x: number, y: number, r = 1.1, tone = "mid", op = 0.7) {
    this.add(`<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${c(tone)}" opacity="${op}"/>`);
  }
  text(x: number, y: number, txt: string, size = 8, tone = "mid", anchor = "start", opts: { mono?: boolean; weight?: number; ls?: string; upper?: boolean } = {}) {
    const { mono = true, weight = 400, ls = ".08em", upper = true } = opts;
    this.add(`<text x="${n(x)}" y="${n(y)}" font-family="${mono ? MONO : SANS}" font-size="${size}" fill="${c(tone)}" text-anchor="${anchor}" font-weight="${weight}" letter-spacing="${ls}">${esc(upper ? txt.toUpperCase() : txt)}</text>`);
  }
  raw(txt: string, size: number, tone: string, x: number, y: number, anchor = "middle", weight = 400) {
    this.text(x, y, txt, size, tone, anchor, { upper: false, ls: "0", weight });
  }
  body(x: number, y: number, w: number, h: number, r = 8, lit = false, screws = true) {
    this.rect(x + 1, y + 4, w, h, r, c("shade0"), "none", 0, 'opacity=".55"');
    this.rect(x, y, w, h, r, c("face"), c(lit ? "lit" : "mid"), lit ? 1.2 : 0.8);
    this.line([[x + r * 0.6, y + h - 5], [x + w - r * 0.6, y + h - 5]], "faint");
    this.rect(x + 5, y + 5, w - 10, h - 15, Math.max(r - 3, 2), "none", c("faint"), 0.6);
    if (screws) for (const sx of [x + 9, x + w - 9]) this.dot(sx, y + 9, 1.3, "mid", 0.55);
  }
  plate(x: number, y: number, txt: string, size = 7) {
    const w = txt.length * size * 0.68 + 14;
    this.rect(x, y, w, 13, 2, c("shade"), c("faint"), 0.6);
    this.text(x + 7, y + 9.2, txt, size, "mid");
  }
  caption(x: number, y: number, txt: string, anchor = "start") {
    this.add(`<text class="ade-caption" x="${n(x)}" y="${n(y)}" font-family="${SANS}" font-size="10.5" font-weight="500" fill="${c("text")}" text-anchor="${anchor}">${esc(txt)}</text>`);
  }
  note(x: number, y: number, txt: string) {
    this.add(`<text class="ade-note" x="${n(x)}" y="${n(y)}" font-family="${SANS}" font-size="9" font-style="italic" fill="${c("muted")}">${esc(txt)}</text>`);
  }
  badge(x: number, y: number, k: number) {
    this.add(`<circle cx="${n(x)}" cy="${n(y)}" r="7.5" fill="${c("accent")}"/>`);
    this.text(x, y + 3, String(k), 8.5, "face", "middle", { weight: 700, ls: "0" });
  }
  ticks(x0: number, x1: number, y: number, count: number, major = 5) {
    this.line([[x0, y], [x1, y]], "lo", 0.7);
    for (let i = 0; i <= count; i++) {
      const x = x0 + ((x1 - x0) * i) / count, L = i % major === 0 ? 5 : 2.6;
      this.line([[x, y], [x, y + L]], i % major === 0 ? "mid" : "lo", 0.6);
    }
  }
  vticks(x: number, y0: number, y1: number, count: number, major = 5) {
    this.line([[x, y0], [x, y1]], "lo", 0.7);
    for (let i = 0; i <= count; i++) {
      const y = y0 + ((y1 - y0) * i) / count, L = i % major === 0 ? 5 : 2.6;
      this.line([[x, y], [x + L, y]], i % major === 0 ? "mid" : "lo", 0.6);
    }
  }
}

// ---------------------------------------------------------------- part kinds

type Props = Record<string, any>;
type Draw = (s: Svg, p: Part, props: Props) => void;

const layers = (s: Svg, x: number, y: number, w: number, rows: number, gap: number, seed: number) => {
  const cols = 9;
  const xs = Array.from({ length: cols }, (_, i) => x + 14 + ((w - 28) * i) / (cols - 1));
  for (let j = 0; j < rows - 1; j++) {
    const y1 = y + j * gap + 6, y2 = y + (j + 1) * gap + 6;
    xs.forEach((xi, i) => s.line([[xi, y1], [xs[(i * 3 + j * 5 + seed) % cols], y2]], "faint", 0.6));
  }
  for (let j = 0; j < rows; j++) {
    const yy = y + j * gap;
    s.rect(x, yy, w, 12, 3, c("shade"), c("lo"), 0.6);
    for (const xx of xs) s.dot(xx, yy + 6, 1.5, "mid", 0.8);
  }
};

export const KINDS: Record<string, Draw> = {
  /** A plain body with an optional engraved plate. */
  panel(s, p, pr) {
    s.body(p.x, p.y, p.w, p.h, 10);
    if (pr.plate) s.plate(p.x + 18, p.y + p.h - 30, pr.plate);
  },
  /** A row of token chips; an empty string is the slot for the next token (drawn dashed red). */
  tape(s, p, pr) {
    s.body(p.x, p.y, p.w, p.h, 10);
    const toks: string[] = pr.tokens ?? [];
    const step = (p.w - 44) / Math.max(toks.length, 1), cw = step - 8;
    for (let i = 0; i < 26; i++) {
      const dx = p.x + 30 + i * 20.5;
      if (dx > p.x + p.w - 20) break;
      if (dx > p.x + 270) s.dot(dx, p.y + 15, 1.6, "lo", 0.9);
      s.dot(dx, p.y + p.h - 18, 1.6, "lo", 0.9);
    }
    toks.forEach((t, i) => {
      const cx = p.x + 22 + i * step;
      if (t) {
        s.rect(cx, p.y + 24, cw, 32, 4, c("shade"), c("lo"), 0.7);
        s.raw(t.replace(/ /g, "␣"), 11, "strong", cx + cw / 2, p.y + 44);
      } else s.rect(cx, p.y + 24, cw, 32, 4, "none", c("accent"), 1, 'class="ade-slot" stroke-dasharray="3 3"');
    });
  },
  /** A stack of model layers with faint attention links. */
  layers(s, p, pr) {
    s.body(p.x, p.y, p.w, p.h, 12);
    const rows = pr.rows ?? 7, gap = Math.min(26, (p.h - 70) / Math.max(rows - 1, 1));
    layers(s, p.x + 26, p.y + 26, p.w - 52, rows, gap, pr.seed ?? 1);
    if (pr.plate) s.plate(p.x + 26, p.y + p.h - 34, pr.plate);
  },
  /** A small callout over another part: only its tag and caption are drawn. */
  callout(s, p) {
    s.rect(p.x, p.y, p.w, p.h, 3, c("face"), "none", 0);
  },
  /** Horizontal bars with values 0..1; the first is the highlighted (moving) one. */
  bars(s, p, pr) {
    s.body(p.x, p.y, p.w, p.h, 10);
    const items: [string, number][] = pr.items ?? [];
    const bx = p.x + 92, bw = p.w - 130;
    items.forEach(([label, v], i) => {
      const yy = p.y + 26 + i * 30;
      s.raw(label.replace(/^ /, "␣"), 10, i === 0 ? "strong" : "text", p.x + 20, yy + 11, "start");
      s.rect(bx, yy, bw, 14, 2, c("shade"), c("faint"), 0.6);
      s.rect(bx, yy, bw * v, 14, 2, c(i === 0 ? "accent" : "lo"), "none", 0, i === 0 ? 'class="ade-bar"' : "");
      s.raw(v.toFixed(2), 8.5, "mid", bx + bw + 6, yy + 11, "start");
    });
    s.ticks(bx, bx + bw, p.y + 26 + items.length * 30 + 4, 20);
    if (pr.plate) s.plate(p.x + 20, p.y + p.h - 26, pr.plate);
  },
  /** A knob with a scale, a label and a value. */
  dial(s, p, pr) {
    s.body(p.x, p.y, p.w, p.h, 8, false, false);
    const cx = p.x + 34, cy = p.y + 28;
    for (let i = 0; i < 13; i++) {
      const a = ((-220 + (i * 260) / 12) * Math.PI) / 180, r2 = i % 3 === 0 ? 20 : 18.6;
      s.line([[cx + 17 * Math.cos(a), cy + 17 * Math.sin(a)], [cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)]], "mid", 0.6);
    }
    s.add(`<circle cx="${cx}" cy="${cy}" r="13" fill="${c("face")}" stroke="${c("hi")}" stroke-width=".9"/>`);
    s.add(`<circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${c("faint")}" stroke-width=".6"/>`);
    const v = typeof pr.value === "number" ? pr.value : 0.5, a = ((-220 + 260 * v * 0.5) * Math.PI) / 180;
    s.line([[cx, cy], [cx + 10 * Math.cos(a), cy + 10 * Math.sin(a)]], "hi", 1.2);
    if (pr.label) s.text(p.x + 62, p.y + 25, pr.label, 7, "mid");
    if (pr.value !== undefined) s.raw(String(pr.value), 10, "strong", p.x + 62, p.y + 39, "start");
  },
  /** A small packet of text (a token, a tool call, a result), drawn in red as a moving part. */
  chip(s, p, pr) {
    s.rect(p.x, p.y, p.w, p.h, 4, c("accentSoft"), c("accent"), 1);
    s.raw(pr.text ?? "", Math.min(10.5, p.h * 0.38), "strong", p.x + p.w / 2, p.y + p.h / 2 + 4);
  },
  /** A terminal window with typed lines and a cursor. */
  terminal(s, p, pr) {
    s.body(p.x, p.y, p.w, p.h, 8, false, false);
    s.rect(p.x, p.y, p.w, 20, 8, c("shade"), "none", 0);
    s.line([[p.x, p.y + 20], [p.x + p.w, p.y + 20]], "faint");
    // window dots (S-15: the tag row sits outside the part, so the title bar is always free)
    for (let i = 0; i < 3; i++) s.add(`<circle cx="${p.x + 14 + i * 11}" cy="${p.y + 10}" r="3" fill="none" stroke="${c("lo")}" stroke-width=".7"/>`);
    const lines: string[] = pr.lines ?? [];
    lines.forEach((l, i) => s.raw(l, 10.5, "strong", p.x + 16, p.y + 44 + i * 18, "start"));
    s.add(`<rect x="${p.x + 16}" y="${p.y + 34 + lines.length * 18}" width="7" height="12" fill="${c("hi")}" opacity=".7"/>`);
  },
  /** A column (or rack) of labelled slots. selected: index pushed out and outlined; lit: index drawn red; empty: dashed slots after. */
  list(s, p, pr) {
    s.body(p.x, p.y, p.w, p.h, 10);
    const items: string[] = pr.items ?? [], empty = pr.empty ?? 0;
    const rack = pr.selected !== undefined; // a tool rack: wide rows with a switch
    const rowH = rack ? 32 : 25, gap = rack ? 40 : 32, top = rack ? 26 : 30;
    const longest = Math.max(0, ...items.map((t) => t.length * LIST_CHAR));
    const rw = rack ? p.w - 32 : Math.min(Math.max(160, longest + 16 + 8 + PAD), p.w - 50);
    items.forEach((label, i) => {
      const yy = p.y + top + i * gap;
      if (rack) {
        const lit = i === pr.selected, out = lit ? -16 : 0, x = p.x + 16 + out;
        s.rect(x, yy, rw, rowH, 4, c("face"), c(lit ? "lit" : "mid"), lit ? 1.1 : 0.7);
        s.rect(x + 10, yy + 9, 92, 14, 2, c("shade"), c("faint"), 0.6);
        s.text(x + 16, yy + 19, label, 7.5, lit ? "strong" : "text");
        s.rect(x + rw - 66, yy + 12, 40, 8, 4, c("shade"), c(lit ? "hi" : "mid"), 0.8);
      } else {
        const lit = i === pr.lit, off = lit ? 8 : 0, x = p.x + 14 + off;
        s.rect(x, yy, rw - off, rowH, 4, c(lit ? "accentSoft" : "shade"), c(lit ? "accent" : "lo"), 0.8, lit ? 'class="ade-slot"' : "");
        s.line([[x + 8, yy + 6], [x + 8, yy + 19]], lit ? "accent" : "lo", 1.4);
        s.text(x + 16, yy + 16, label, 8, lit ? "strong" : "text");
      }
    });
    for (let i = items.length; i < items.length + empty; i++)
      s.rect(p.x + 14, p.y + top + i * gap, rw, rowH, 4, "none", c("faint"), 0.8, 'stroke-dasharray="3 3"');
    if (!rack && p.w > 190) {
      const sx = p.x + rw + 26, y0 = p.y + top, y1 = p.y + p.h - 23;
      s.vticks(sx, y0, y1, 20);
      s.rect(sx + 8, y0, 5, y1 - y0, 2, c("shade"), c("faint"), 0.5);
      const fill = (items.length / Math.max(items.length + empty, 1)) * (y1 - y0);
      s.rect(sx + 8, y0, 5, fill, 2, c("mid"), "none", 0);
    }
    if (pr.plate) s.plate(p.x + 18, p.y + p.h - 30, pr.plate);
  },
  /** A satellite: a body with two solar wings and a name plate. */
  satellite(s, p, pr) {
    const cx = p.x + p.w / 2, by = p.y + Math.max(6, p.h - 52), bw = 34, bh = 24, ww = (p.w - bw) / 2 - 6;
    for (const wx of [p.x + 2, cx + bw / 2 + 4]) {
      s.rect(wx, by + 5, ww, 14, 2, c("shade"), c("mid"), 0.7);
      for (let k = 1; k < 4; k++) s.line([[wx + (ww * k) / 4, by + 5], [wx + (ww * k) / 4, by + 19]], "lo", 0.6);
    }
    s.line([[p.x + 2 + ww, by + 12], [cx - bw / 2, by + 12]], "mid", 0.8);
    s.line([[cx + bw / 2, by + 12], [cx + bw / 2 + 4, by + 12]], "mid", 0.8);
    s.rect(cx - bw / 2, by, bw, bh, 3, c("face"), c("hi"), 0.9);
    s.line([[cx, by + bh], [cx, by + bh + 6]], "mid", 0.8);
    s.add(`<path d="M${n(cx - 6)} ${n(by + bh + 6)} H${n(cx + 6)} L${n(cx)} ${n(by + bh + 12)} Z" fill="${c("mid")}"/>`);
    if (pr.label) s.text(cx, p.y + p.h - 4, pr.label, 7, "mid", "middle");
  },
  /** A grid of file icons and an optional test lamp (red while failing). */
  files(s, p, pr) {
    s.body(p.x, p.y, p.w, p.h, 10);
    const files: string[] = pr.files ?? [];
    files.forEach((f, i) => {
      const fx = p.x + 18 + (i % 3) * 74, fy = p.y + 22 + Math.floor(i / 3) * 50, lit = i === pr.lit;
      s.add(`<path d="M${fx} ${fy} H${fx + 54} L${fx + 64} ${fy + 10} V${fy + 40} H${fx} Z" fill="${c("face")}" stroke="${c(lit ? "lit" : "mid")}" stroke-width="${lit ? 1.1 : 0.7}" stroke-linejoin="round"/>`);
      s.line([[fx + 54, fy], [fx + 54, fy + 10], [fx + 64, fy + 10]], "lo", 0.6);
      [40, 30, 36].forEach((len, k) => s.line([[fx + 7, fy + 15 + k * 6], [fx + 7 + len, fy + 15 + k * 6]], "faint", 0.9));
      s.raw(f, 6.5, "text", fx + 3, fy + 47, "start");
    });
    if (pr.tests !== undefined) {
      const lx = p.x + p.w - 44, ly = p.y + 44;
      s.add(`<circle cx="${lx}" cy="${ly}" r="17" fill="${c("shade")}" stroke="${c("mid")}" stroke-width=".8"/>`);
      s.add(`<circle class="ade-lamp" cx="${lx}" cy="${ly}" r="11" fill="${c("accent")}" stroke="${c("hi")}" stroke-width=".6"/>`);
      s.add(`<circle cx="${lx - 3.5}" cy="${ly - 3.5}" r="3" fill="#ffffff" opacity=".55"/>`);
      s.text(lx, ly + 32, "tests", 7, "mid", "middle");
      s.raw(pr.tests, 9, "strong", lx, ly + 44);
    }
    if (pr.plate) s.plate(p.x + 18, p.y + p.h - 30, pr.plate);
  },
  /** A range circle centred in the part's box. center: dot at the centre; label: text by the centre; lit: red; dashed; fill: a solid marker. */
  ring(s, p, pr) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = Math.min(p.w, p.h) / 2;
    const tone = pr.lit ? "accent" : "mid";
    const fill = pr.fill ? c(pr.lit ? "accentSoft" : "shade") : "none";
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" stroke="${c(tone)}" stroke-width="${pr.lit ? 1.2 : 0.9}"${pr.dashed ? ' stroke-dasharray="4 4"' : ""}/>`);
    if (pr.sphere) s.add(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r)}" ry="${n(r * 0.3)}" fill="none" stroke="${c("lo")}" stroke-width=".7" stroke-dasharray="3 3"/>`);
    if (pr.center) s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="4" fill="${c("face")}" stroke="${c("hi")}" stroke-width="1"/>`);
    if (pr.label) s.text(cx + 8, cy - 8, pr.label, 7, "mid");
  },
  /** A measuring scale. marks: [label, 0..1][]; lit: 0..1, the measured span drawn red from the left. */
  ruler(s, p, pr) {
    const x0 = p.x + 16, x1 = p.x + p.w - 16, y = p.y + p.h / 2 - 6;
    if (pr.lit) s.rect(x0, y - 10, (x1 - x0) * pr.lit, 8, 2, c("accent"), "none", 0, 'class="ade-bar"');
    s.ticks(x0, x1, y, 30);
    for (const [label, f] of (pr.marks ?? []) as [string, number][]) {
      const x = x0 + (x1 - x0) * f;
      s.line([[x, y], [x, y + 9]], "hi", 0.9);
      s.raw(label, 9.5, "strong", x, y + 22);
    }
    if (pr.plate) s.plate(p.x + 16, p.y + p.h - 14, pr.plate);
  },
};

// ---------------------------------------------------------------- tags, captions, motion badges

// S-15: a tagged part's tag and caption share one label row outside the part, 8 units clear of its
// border (above it, or below with captionBelow), the tag inset 12 units from the part's corner. The
// row never sits on the part's own content, so the part keeps its full box for drawing.
export const LABEL = { gap: 8, inset: 12, h: 14 } as const;

/** Where a part's tag sits: on the label row above the part (below with captionBelow). */
export function tagBox(p: Part) {
  const tag = p.tag ?? "", cw = tag.length * 6.4 + 10, tl = (p.corner ?? "tl") === "tl";
  const inset = isSmall(p) ? 0 : LABEL.inset;
  const y = p.props?.captionBelow ? p.y + p.h + LABEL.gap : p.y - LABEL.gap - LABEL.h;
  return { x: tl ? p.x + inset : p.x + p.w - inset - cw, y, w: cw, h: LABEL.h, outside: true };
}

/** The caption's box on the label row, beside the tag (right of it, or left for a tr corner). */
export function captionBox(p: Part) {
  const b = tagBox(p), w = textWidth(p.caption ?? "", 10.5, false) + 8, tl = (p.corner ?? "tl") === "tl";
  return { x: tl ? b.x + b.w + 2 : b.x - 2 - w, y: b.y, w, h: LABEL.h };
}

function drawTag(s: Svg, p: Part, fig: Figure) {
  if (!p.tag) return;
  const b = tagBox(p);
  if (p.caption) {
    // the row may cross a line: give the caption a ground matching what it sits on (the page, or
    // the face of a part that holds it, like a map panel)
    const cb = captionBox(p), tl = (p.corner ?? "tl") === "tl";
    const holder = fig.parts.find((q) => q !== p && q.kind !== "ring" && q.kind !== "callout" &&
      cb.x >= q.x && cb.y >= q.y && cb.x + cb.w <= q.x + q.w && cb.y + cb.h <= q.y + q.h);
    s.rect(cb.x, cb.y, cb.w, cb.h, 3, c(holder ? "face" : "page"), "none", 0);
    s.caption(tl ? cb.x + 4 : cb.x + cb.w - 4, b.y + 10.5, p.caption, tl ? "start" : "end");
  }
  s.add(`<g class="ade-tag"><rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="14" rx="7" fill="${c("linkSoft")}" stroke="${c("link")}" stroke-width=".9"/>` +
    `<text x="${n(b.x + b.w / 2)}" y="${n(b.y + 10)}" font-family="${MONO}" font-size="8" fill="${c("link")}" text-anchor="middle" font-weight="600" letter-spacing=".04em">${esc(p.tag)}</text></g>`);
}

/** Text widths the validator uses to check that a part's content fits (S-15 req 5). */
const LIST_CHAR = 8 * 0.7, PAD = 12;

/** Why a part's content would overflow its box, or null when it fits with PAD units to spare. */
export function overflow(p: Part): string | null {
  const pr = (p.props ?? {}) as Record<string, any>;
  const wide = (items: string[], per: number) => Math.max(0, ...items.map((t) => t.length * per));
  if (p.kind === "list" && pr.selected === undefined) {
    const items: string[] = pr.items ?? [], rows = items.length + (pr.empty ?? 0);
    const need = 30 + (rows - 1) * 32 + 25 + PAD;
    if (rows && need > p.h) return `${rows} slots need a height of ${need}, the part is ${p.h}`;
    const needW = 14 + 8 + 16 + wide(items, LIST_CHAR) + PAD + PAD;
    if (needW > p.w) return `the longest item needs a width of ${Math.ceil(needW)}, the part is ${p.w}`;
  }
  if (p.kind === "terminal") {
    const lines: string[] = pr.lines ?? [], need = 46 + lines.length * 18 + PAD;
    if (need > p.h) return `${lines.length} lines need a height of ${need}, the part is ${p.h}`;
    const needW = 16 + wide(lines, 10.5 * 0.62) + PAD;
    if (needW > p.w) return `the longest line needs a width of ${Math.ceil(needW)}, the part is ${p.w}`;
  }
  if (p.kind === "chip" && pr.text) {
    const needW = String(pr.text).length * 10 * 0.62 + 16;
    if (needW > p.w) return `the text needs a width of ${Math.ceil(needW)}, the part is ${p.w}`;
  }
  return null;
}

/** The numbered red marker of a moving part: at props.badgeAt, or the part's top-right corner. */
export function badgeAt(p: Part): [number, number] {
  return (p.props?.badgeAt as [number, number] | undefined) ?? [p.x + p.w, p.y];
}

// ---------------------------------------------------------------- connections

function drawConnection(s: Svg, k: Connection, i: number) {
  const d = "M" + k.points.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L");
  s.add(`<g class="ade-conn" data-conn="${i}">`);
  s.add(`<path d="${d}" fill="none" stroke="${c("lo")}" stroke-width="7" stroke-linejoin="round"/>`);
  s.add(`<path d="${d}" fill="none" stroke="${c("face")}" stroke-width="5.4" stroke-linejoin="round"/>`);
  if (k.flow) s.add(`<path class="ade-flow" d="${d}" fill="none" stroke="${c("accent")}" stroke-width="1.4" stroke-dasharray="3 7" stroke-linecap="round"/>`);
  for (let j = 0; j < k.points.length - 1; j++) {
    const [x1, y1] = k.points[j], [x2, y2] = k.points[j + 1], mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
      const q = x2 > x1 ? 1 : -1;
      s.line([[mx - 2 * q, my - 2.4], [mx + q, my], [mx - 2 * q, my + 2.4]], "mid", 0.8);
    } else {
      const q = y2 > y1 ? 1 : -1;
      s.line([[mx - 2.4, my - 2 * q], [mx, my + q], [mx + 2.4, my - 2 * q]], "mid", 0.8);
    }
  }
  s.add("</g>");
  if (k.note) {
    const [x, y] = k.noteAt ?? [(k.points[0][0] + k.points[1][0]) / 2 + 8, (k.points[0][1] + k.points[1][1]) / 2 - 6];
    s.note(x, y, k.note);
  }
}

// ---------------------------------------------------------------- figure

export interface Box { x: number; y: number; w: number; h: number }

/** The area the drawing actually covers (parts, tags, captions, connections, notes), padded. */
export function contentBox(fig: Figure, pad = 6): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number, w = 0, h = 0) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  };
  for (const p of fig.parts) {
    grow(p.x, p.y, p.w, p.h + 4);
    if (p.tag) {
      const b = tagBox(p);
      grow(b.x, b.y, b.w, b.h);
      if (p.caption) { const cb = captionBox(p); grow(cb.x, cb.y, cb.w, cb.h); }
    }
    if (p.motion) { const [bx, by] = badgeAt(p); grow(bx - 8, by - 8, 16, 16); }
  }
  for (const k of fig.connections) {
    for (const [x, y] of k.points) grow(x - 4, y - 4, 8, 8);
    if (k.note && k.noteAt) grow(k.noteAt[0], k.noteAt[1] - 10, textWidth(k.note, 9, false), 12);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

export interface RenderOptions {
  /** Part id drawn as open (blue outline and filled tag). */
  open?: string;
}

/**
 * Renders a figure as an SVG string. Each part is a <g data-part data-tag> with an outline rect
 * (class ade-outline) that the reader shows on hover, focus or while open. Moving parts carry
 * class ade-move and data-order for the motion player.
 */
export function renderFigure(fig: Figure, opts: RenderOptions = {}): string {
  const s = new Svg();
  fig.connections.forEach((k, i) => drawConnection(s, k, i));
  for (const p of fig.parts) {
    const draw = KINDS[p.kind];
    if (!draw) throw new Error(`figure kit: unknown part kind "${p.kind}" (part ${p.id})`);
    const cls = ["ade-part", p.tag ? "ade-clickable" : "", p.motion ? "ade-move" : "", opts.open === p.id ? "ade-open" : ""].filter(Boolean).join(" ");
    const attrs = [`class="${cls}"`, `data-part="${esc(p.id)}"`];
    if (p.tag) attrs.push(`data-tag="${esc(p.tag)}"`, `tabindex="0"`, `role="button"`, `aria-label="${esc(`${p.tag}: ${p.caption ?? ""}`)}"`);
    if (p.motion) attrs.push(`data-order="${p.motion.order}"`);
    s.add(`<g ${attrs.join(" ")}>`);
    // the part's drawing sits in its own group, so motion can move it while the label row stays put
    s.add(`<g class="ade-body">`);
    draw(s, p, p.props ?? {});
    s.add("</g>");
    if (p.tag) {
      s.add(`<rect class="ade-outline" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${isSmall(p) ? 4 : 10}" fill="none" stroke="${c("link")}" stroke-width="1.6"/>`);
      drawTag(s, p, fig);
    }
    s.add("</g>");
  }
  // motion badges on top of everything
  for (const p of fig.parts) if (p.motion) { const [bx, by] = badgeAt(p); s.badge(bx, by, p.motion.order); }
  const b = contentBox(fig);
  return `<svg class="ade-figure" viewBox="${n(b.x)} ${n(b.y)} ${n(b.w)} ${n(b.h)}" role="img" aria-label="${esc(fig.label)}" ` +
    `xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;width:100%;height:auto">${s.o.join("")}</svg>`;
}
