// The reader shell (S-4): full-screen pages, one level at a time. Each prerequisite opens on its
// cover question; Yes slides the next page in, No reveals the level. After a No, later covers are
// skipped (S-14). Revealed pages end with Back and Next (D-8); the main concept has Back only.
import type { AdeDocument, Level, Main } from "../format/types.ts";
import { renderFigure } from "../kit/render.ts";
import { currentTheme } from "../kit/theme.ts";

export type Page =
  | { type: "cover"; level: Level }
  | { type: "level"; level: Level }
  | { type: "main" };

export function pagesOf(doc: AdeDocument): Page[] {
  return [...doc.levels.flatMap((level): Page[] => [{ type: "cover", level }, { type: "level", level }]), { type: "main" }];
}

/** Where Next goes from page i: the next cover or the main concept; after a No (S-14), the next
 * level's revealed page instead of its cover. */
export function nextPage(pages: Page[], i: number, saidNo: boolean): number {
  for (let j = i + 1; j < pages.length; j++) {
    if (pages[j].type === "cover") return saidNo ? j + 1 : j;
    if (pages[j].type === "main") return j;
  }
  return pages.length - 1;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Hooks the later reader parts plug into (paragraph terms, part popups, motion). */
export interface Extension {
  paragraph?(reader: Reader, page: Main, levelId: string): string;
  mount?(reader: Reader, el: HTMLElement, page: Main, levelId: string): void;
  unmount?(reader: Reader): void;
  closePopups?(reader: Reader): boolean;
}

export class Reader {
  readonly pages: Page[];
  index = 0;
  private history: number[] = [];
  /** Set by a No on a cover (S-14): the reader lacks those basics, so later covers are skipped. */
  private saidNo = false;
  private stage: HTMLElement;
  current: HTMLElement | null = null;
  readonly extensions: Extension[] = [];

  readonly doc: AdeDocument;
  readonly root: HTMLElement;

  constructor(doc: AdeDocument, root: HTMLElement) {
    this.doc = doc;
    this.root = root;
    this.pages = pagesOf(doc);
    root.classList.add("ade-root");
    this.stage = document.createElement("div");
    this.stage.className = "ade-stage";
    root.append(this.stage);
    document.addEventListener("keydown", (e) => this.onKey(e));
    window.addEventListener("resize", () => this.fit());
  }

  use(ext: Extension) { this.extensions.push(ext); return this; }

  start() { this.show(0, "none"); }

  get page(): Page { return this.pages[this.index]; }

  private nextAfterLevel(): number { return nextPage(this.pages, this.index, this.saidNo); }

  answer(yes: boolean) {
    if (this.page.type !== "cover") return;
    this.saidNo = !yes;
    this.go(yes ? this.nextAfterLevel() : this.index + 1, yes ? "slide" : "reveal");
  }

  next() {
    if (this.page.type === "main" || this.page.type === "cover") return;
    this.go(this.nextAfterLevel(), "slide");
  }

  back() {
    const prev = this.history.pop();
    if (prev !== undefined) this.show(prev, "back");
  }

  /** Jump to a page by its level id (used by cross-level part chips); Back returns here. */
  goToLevel(id: string): HTMLElement | null {
    const i = this.pages.findIndex((p) => (id === "main" ? p.type === "main" : p.type === "level" && p.level.id === id));
    if (i < 0) return null;
    this.go(i, "slide");
    return this.current;
  }

  private go(i: number, how: "slide" | "reveal") {
    this.history.push(this.index);
    this.show(i, how);
  }

  private show(i: number, how: "none" | "slide" | "reveal" | "back") {
    for (const x of this.extensions) x.unmount?.(this);
    this.index = i;
    const el = this.renderPage(this.page);
    const old = this.current;
    this.stage.append(el);
    this.current = el;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (old) {
      if (reduce || how === "none") old.remove();
      else {
        const dir = how === "back" ? -1 : 1;
        if (how === "reveal") {
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
          old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in" }).onfinish = () => old.remove();
        } else {
          el.animate([{ transform: `translateX(${100 * dir}%)` }, { transform: "translateX(0)" }], { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" });
          old.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-60 * dir}%)`, opacity: 0.35 }],
            { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" }).onfinish = () => old.remove();
        }
      }
    }
    this.fit();
    const p = this.page;
    if (p.type !== "cover") {
      const main = p.type === "main" ? this.doc.main : p.level;
      const id = p.type === "main" ? "main" : p.level.id;
      for (const x of this.extensions) x.mount?.(this, el, main, id);
    }
    (el.querySelector("[data-autofocus]") as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private renderPage(p: Page): HTMLElement {
    const el = document.createElement("section");
    el.className = `ade-page ade-${p.type}`;
    el.dataset.page = p.type === "main" ? "main" : `${p.level.id}-${p.type}`;
    if (p.type === "cover") {
      el.innerHTML =
        `<div class="ade-cover">` +
        `<div class="ade-eyebrow">${esc(p.level.title)}</div>` +
        `<h1 class="ade-question">${esc(p.level.question)}</h1>` +
        `<div class="ade-answers"><button class="ade-btn ade-primary" data-act="yes" data-autofocus>Yes</button>` +
        `<button class="ade-btn" data-act="no">No</button></div>` +
        `<div class="ade-hints"><span>Yes: the next page slides in from the right</span><span>No: the figure for this page opens</span></div>` +
        `</div>`;
    } else {
      const main = p.type === "main" ? this.doc.main : p.level;
      const id = p.type === "main" ? "main" : p.level.id;
      const para = this.extensions.reduce<string | undefined>((acc, x) => acc ?? x.paragraph?.(this, main, id), undefined)
        ?? esc(main.paragraph.replace(/\{([^}]+)\}/g, "$1").replace(/\[\d+\]/g, ""));
      el.innerHTML =
        `<header class="ade-head"><h1 class="ade-title">${esc(main.title)}</h1><p class="ade-para">${para}</p></header>` +
        `<div class="ade-figure-box"><div class="ade-figure-wrap">${renderFigure(main.figure)}</div></div>`;
      const nav = document.createElement("nav");
      nav.className = "ade-nav";
      nav.innerHTML = `<button class="ade-btn ade-back" data-act="back">&#8592; Back</button>` +
        (p.type === "main" ? "" : `<button class="ade-btn ade-primary" data-act="next" data-autofocus>Next &#8594;</button>`);
      el.append(nav);
    }
    el.append(this.indicator(p));
    el.addEventListener("click", (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act;
      if (act === "yes") this.answer(true);
      else if (act === "no") this.answer(false);
      else if (act === "next") this.next();
      else if (act === "back") this.back();
      else if (act === "theme") this.toggleTheme();
    });
    return el;
  }

  /** The one thing always shown: which concept this document explains. */
  private indicator(p: Page): HTMLElement {
    const d = document.createElement("footer");
    d.className = "ade-indicator";
    d.innerHTML = `<span class="ade-eyebrow">Main concept</span><span class="ade-concept">${esc(this.doc.main.title)}</span>` +
      `<span class="ade-where">${p.type === "main" ? "You are here" : "Explained after the basics it needs"}</span>` +
      `<button class="ade-theme" data-act="theme">${currentTheme() === "dark" ? "Light" : "Dark"}</button>`;
    return d;
  }

  /** Scale the figure to the space between the margins and above the bottom bar, never clipping a part. */
  fit() {
    const box = this.current?.querySelector<HTMLElement>(".ade-figure-box");
    const svg = box?.querySelector<SVGSVGElement>("svg.ade-figure");
    if (!box || !svg) return;
    const [, , vw, vh] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    const { width, height } = box.getBoundingClientRect();
    const scale = Math.min(width / vw, height / vh);
    const wrap = svg.parentElement as HTMLElement;
    wrap.style.width = `${vw * scale}px`;
    wrap.style.height = `${vh * scale}px`;
  }

  /** Switch between light and dark for this reading session (the system setting is the default). */
  toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { sessionStorage.setItem("ade-theme", next); } catch { /* storage may be off for file:// pages */ }
    this.root.querySelectorAll(".ade-theme").forEach((b) => (b.textContent = next === "dark" ? "Light" : "Dark"));
  }

  closePopups(): boolean {
    return this.extensions.some((x) => x.closePopups?.(this));
  }

  private onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "escape") { this.closePopups(); return; }
    if (this.page.type === "cover") {
      if (k === "y") this.answer(true);
      else if (k === "n") this.answer(false);
      else if (k === "arrowleft") this.back();
      return;
    }
    const onButton = (e.target as HTMLElement)?.closest?.("button,[role=button],a");
    if (k === "arrowright" || (k === "enter" && !onButton)) { e.preventDefault(); this.next(); }
    else if (k === "arrowleft") this.back();
  }
}
