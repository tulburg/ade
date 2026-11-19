// Figure parts (S-6): a clickable part opens its explainer as a popup on the part, with an arrow
// pointing at it. Tag chips open the cited part, on this level or another (Back returns here).
import type { Main, Part } from "../format/types.ts";
import type { Extension, Reader } from "./shell.ts";
import { openPopup, type PopupHandle } from "./popup.ts";
import { chip, sourceRow, type Paragraph } from "./paragraph.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tagOrder = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export class Parts implements Extension {
  private popup: PopupHandle | null = null;
  private openId: string | null = null;
  private page: Main | null = null;
  private levelId = "";
  /** After a cross-level jump: the page and part to reopen when the reader comes Back. */
  private resume: { index: number; id: string } | null = null;
  private pending: string | null = null;

  constructor(paragraph?: Paragraph) {
    if (paragraph) paragraph.openPart = (reader, tag) => this.openTag(reader, tag);
  }

  mount(reader: Reader, el: HTMLElement, page: Main, levelId: string) {
    this.page = page;
    this.levelId = levelId;
    el.addEventListener("click", (e) => {
      const t = e.target as Element;
      const c = t.closest<HTMLElement>(".ade-chip");
      if (c && this.popup?.el.contains(c)) { e.stopPropagation(); this.openTag(reader, c.dataset.chip!); return; }
      if (t.closest("[data-close]") && this.popup?.el.contains(t)) { this.close(true); return; }
      const g = t.closest<SVGGElement>(".ade-clickable");
      if (g) { e.stopPropagation(); this.toggle(reader, g.dataset.part!); return; }
      if (this.popup && !this.popup.el.contains(t)) this.close();
    });
    el.addEventListener("keydown", (e) => {
      const g = (e.target as Element).closest?.<SVGGElement>(".ade-clickable");
      if (!g) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); this.toggle(reader, g.dataset.part!); }
      else if (e.key === "Tab") {
        // move through the parts in tag order, whatever order they are drawn in
        const all = [...el.querySelectorAll<SVGGElement>(".ade-clickable")].sort((a, b) => tagOrder(a.dataset.tag!, b.dataset.tag!));
        const i = all.indexOf(g) + (e.shiftKey ? -1 : 1);
        if (i >= 0 && i < all.length) { e.preventDefault(); all[i].focus(); }
      }
    });
    if (this.resume && this.resume.index === reader.index) { this.pending = this.resume.id; this.resume = null; }
    if (this.pending) {
      const id = this.pending;
      this.pending = null;
      requestAnimationFrame(() => setTimeout(() => this.open(reader, id), 30));
    }
  }

  unmount() { this.close(); this.page = null; }

  closePopups() { if (!this.popup) return false; this.close(true); return true; }

  /** Open a part from a tag: on this level ("C1") or on another ("L1 A2", "main C2"). */
  openTag(reader: Reader, ref: string) {
    const [lvl, tag] = ref.includes(" ") ? ref.split(" ") : [this.levelId, ref];
    if (lvl === this.levelId) {
      const p = this.page?.figure.parts.find((x) => x.tag === tag);
      if (p) this.open(reader, p.id);
      return;
    }
    const target = lvl === "main" ? reader.doc.main : reader.doc.levels.find((l) => l.id === lvl);
    const p = target?.figure.parts.find((x) => x.tag === tag);
    if (!p) return;
    this.resume = this.openId ? { index: reader.index, id: this.openId } : null;
    this.pending = p.id;
    reader.goToLevel(lvl);
  }

  private toggle(reader: Reader, id: string) {
    if (this.openId === id) this.close(true);
    else this.open(reader, id);
  }

  open(reader: Reader, id: string) {
    const part = this.page?.figure.parts.find((p) => p.id === id);
    const g = reader.current?.querySelector<SVGGElement>(`.ade-part[data-part="${id}"]`);
    if (!part?.explainer || !g) return;
    reader.closePopups();
    this.close();
    this.openId = id;
    g.classList.add("ade-open");
    const anchor = g.querySelector(".ade-outline")!.getBoundingClientRect();
    this.popup = openPopup(reader.current!, anchor, this.html(part), "right", "ade-explainer");
    this.popup.el.querySelector<HTMLElement>("[data-close]")?.focus({ preventScroll: true });
  }

  private close(refocus = false) {
    if (!this.popup && !this.openId) return;
    this.popup?.close();
    this.popup = null;
    const g = this.openId ? document.querySelector<SVGGElement>(`.ade-page:last-child .ade-part[data-part="${this.openId}"]`) : null;
    g?.classList.remove("ade-open");
    if (refocus) g?.focus({ preventScroll: true });
    this.openId = null;
  }

  private html(p: Part): string {
    const x = p.explainer!;
    const sec = (s: string) => `<div class="ade-sec">${s}</div>`;
    const connects = x.connects.map((c) => `<div class="ade-connect">${chip(c.tag)}<span>${esc(c.text)}</span></div>`).join("");
    return `<div class="ade-pop-head"><span class="ade-tag-pill">${esc(p.tag!)}</span><span class="ade-pop-title">${esc(x.name)}</span></div>` +
      `<p class="ade-pop-text">${esc(x.what)}</p>` +
      (connects ? sec("How it connects") + `<div class="ade-connects">${connects}</div>` : "") +
      sec("Sources") + `<div class="ade-sources">${x.sources.map((n) => sourceRow(n, this.page!.sources[n - 1])).join("")}</div>`;
  }
}

const SANS = "-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

export const PARTS_CSS = `
.ade-explainer{width:380px}
.ade-pop-head{display:flex;align-items:center;gap:8px;padding-right:24px}
.ade-tag-pill{padding:4px 8px;border-radius:8px;background:var(--ade-link);color:var(--ade-face);font:700 10.5px/1 ${MONO}}
.ade-sec{font:500 9.5px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:var(--ade-muted);margin:14px 0 8px}
.ade-connects{display:flex;flex-direction:column;gap:6px;font:400 13px/1.4 ${SANS};color:var(--ade-text)}
.ade-connect{display:flex;align-items:center;gap:8px}
.ade-open .ade-tag rect{fill:var(--ade-link)}
.ade-open .ade-tag text{fill:var(--ade-face)}
`;
