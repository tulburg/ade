// The explanation paragraph (S-5): terms are underlined and open their full definition under the
// word; [n] references open their source. One popup at a time.
import type { Main, Source } from "../format/types.ts";
import type { Extension, Reader } from "./shell.ts";
import { openPopup, type PopupHandle } from "./popup.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderParagraph(text: string): string {
  // tokens: {term}, [n], plain text. A reference stays on the line of the word before it.
  const parts: string[] = [];
  const re = /\{([^{}]+)\}|\[(\d+)\]/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let before = text.slice(last, m.index);
    if (m[2] !== undefined) {
      const ref = `<button class="ade-ref" data-ref="${m[2]}" aria-label="Source ${m[2]}">[${m[2]}]</button>`;
      while (parts.length && parts[parts.length - 1] === "") parts.pop();
      const word = /(\S+)$/.exec(before);
      const prev = parts.length && !word && before === "" ? parts.pop()! : null;
      if (prev !== null) parts.push(`<span class="ade-nowrap">${prev}${ref}</span>`);
      else if (word) {
        before = before.slice(0, -word[1].length);
        parts.push(esc(before), `<span class="ade-nowrap">${esc(word[1])}${ref}</span>`);
      } else parts.push(esc(before), ref);
    } else {
      parts.push(esc(before), `<button class="ade-term" data-term="${esc(m[1].toLowerCase())}">${esc(m[1])}</button>`);
    }
    last = re.lastIndex;
  }
  parts.push(esc(text.slice(last)));
  return parts.join("");
}

export function sourceRow(n: number, s: Source): string {
  return `<a class="ade-source" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">` +
    `<span class="ade-src-n">[${n}]</span><span class="ade-src-kind">${s.kind.toUpperCase()}</span>` +
    `<span class="ade-src-title">${esc(s.title)} &#8599;</span></a>`;
}

export const chip = (tag: string) => `<button class="ade-chip" data-chip="${esc(tag)}">${esc(tag)}</button>`;

/** Opens a part from a tag chip; S-6 replaces this with the full part explainer. */
export type PartOpener = (reader: Reader, tag: string) => void;

export class Paragraph implements Extension {
  private popup: PopupHandle | null = null;
  private page: Main | null = null;
  private levelId = "";
  private reader: Reader | null = null;
  private trigger: HTMLElement | null = null;
  openPart: PartOpener = (reader, tag) => {
    reader.current?.querySelectorAll(".ade-open").forEach((g) => g.classList.remove("ade-open"));
    reader.current?.querySelector(`[data-tag="${tag}"]`)?.classList.add("ade-open");
  };

  paragraph(_r: Reader, page: Main) { return renderParagraph(page.paragraph); }

  mount(reader: Reader, el: HTMLElement, page: Main, levelId: string) {
    this.page = page;
    this.levelId = levelId;
    this.reader = reader;
    el.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const term = t.closest<HTMLElement>(".ade-term"), ref = t.closest<HTMLElement>(".ade-ref");
      const chipEl = t.closest<HTMLElement>(".ade-chip");
      if (term) { e.stopPropagation(); this.toggle(reader, term, () => this.termHtml(term.dataset.term!)); }
      else if (ref) { e.stopPropagation(); this.toggle(reader, ref, () => this.refHtml(Number(ref.dataset.ref))); }
      else if (chipEl && this.popup?.el.contains(chipEl)) { e.stopPropagation(); this.close(); this.openPart(reader, chipEl.dataset.chip!); }
      else if (t.closest("[data-close]") && this.popup?.el.contains(t)) this.close(true);
      else if (this.popup && !this.popup.el.contains(t)) this.close();
    });
  }

  unmount() { this.close(); this.page = null; }

  closePopups() { if (!this.popup) return false; this.close(true); return true; }

  private toggle(reader: Reader, trigger: HTMLElement, html: () => string) {
    const same = this.trigger === trigger;
    this.close();
    if (same) return;
    reader.closePopups();
    this.trigger = trigger;
    trigger.classList.add("ade-active");
    this.popup = openPopup(reader.current!, trigger.getBoundingClientRect(), html(), "below", "ade-def");
    this.popup.el.querySelector<HTMLElement>("[data-close]")?.focus({ preventScroll: true });
  }

  private close(refocus = false) {
    this.popup?.close();
    this.popup = null;
    this.trigger?.classList.remove("ade-active");
    if (refocus) this.trigger?.focus({ preventScroll: true });
    this.trigger = null;
  }

  /** A term is defined once (D-10): on this page, or on the earlier page that defines it. */
  private findTerm(key: string) {
    const doc = this.reader!.doc;
    const pages: [string, Main][] = [...doc.levels.map((l): [string, Main] => [l.id, l]), ["main", doc.main]];
    const here = pages.findIndex(([id]) => id === this.levelId);
    for (let i = here; i >= 0; i--) {
      const t = pages[i][1].terms.find((x) => x.term.toLowerCase() === key);
      if (t) return { t, id: pages[i][0], page: pages[i][1] };
    }
    return null;
  }

  private termHtml(key: string): string {
    const found = this.findTerm(key)!;
    const { t, id, page } = found, own = id === this.levelId;
    const part = t.part && !own && !t.part.includes(" ") ? `${id} ${t.part}` : t.part;
    const from = own ? "" : `<div class="ade-from">From ${esc(id)} &#183; ${esc(page.title)}</div>`;
    const where = part ? `<div class="ade-where-row">${chip(part)}<span>where this is in the figure</span></div>` : "";
    return `${from}<div class="ade-pop-title">${esc(t.term.charAt(0).toUpperCase() + t.term.slice(1))}</div>` +
      `<p class="ade-pop-text">${esc(t.definition)}</p>${where}` +
      `<div class="ade-sources">${t.sources.map((n) => sourceRow(n, page.sources[n - 1])).join("")}</div>`;
  }

  private refHtml(n: number): string {
    return `<div class="ade-pop-title">Source ${n}</div><div class="ade-sources">${sourceRow(n, this.page!.sources[n - 1])}</div>`;
  }
}

const SANS = "-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

export const PARAGRAPH_CSS = `
.ade-term{all:unset;cursor:pointer;color:var(--ade-strong);text-decoration:underline;text-decoration-color:var(--ade-link);text-decoration-thickness:1.5px;text-underline-offset:4px;border-radius:3px}
.ade-term:hover,.ade-term.ade-active{background:var(--ade-linkSoft)}
.ade-term:focus-visible,.ade-ref:focus-visible,.ade-chip:focus-visible{outline:2px solid var(--ade-link);outline-offset:2px}
.ade-ref{all:unset;cursor:pointer;font:600 10px/0 ${MONO};color:var(--ade-link);vertical-align:super;margin-left:1px}
.ade-nowrap{white-space:nowrap}
.ade-popup{position:absolute;z-index:10;width:400px;max-width:calc(100vw - 24px);box-sizing:border-box;background:var(--ade-face);border-radius:12px;
  box-shadow:0 0 0 1px var(--ade-link),0 16px 40px -10px rgba(0,0,0,.22);padding:16px 20px 12px;color:var(--ade-text);font-family:${SANS}}
.ade-arrow{position:absolute;width:12px;height:12px;background:var(--ade-face);transform:rotate(45deg)}
.ade-popup[data-side=below] .ade-arrow{top:-7px;box-shadow:-1px -1px 0 0 var(--ade-link)}
.ade-popup[data-side=above] .ade-arrow{bottom:-7px;box-shadow:1px 1px 0 0 var(--ade-link)}
.ade-popup[data-side=right] .ade-arrow{left:-7px;box-shadow:-1px 1px 0 0 var(--ade-link)}
.ade-popup[data-side=left] .ade-arrow{right:-7px;box-shadow:1px -1px 0 0 var(--ade-link)}
.ade-close{all:unset;cursor:pointer;position:absolute;right:14px;top:10px;font:400 18px/1 ${SANS};color:var(--ade-muted)}
.ade-from{font:500 9.5px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:var(--ade-muted);margin-bottom:8px}
.ade-pop-title{font:650 16px/1.2 ${SANS};color:var(--ade-strong);padding-right:24px}
.ade-pop-text{margin:8px 0 0;font:400 13.5px/1.5 ${SANS};color:var(--ade-text)}
.ade-where-row{display:flex;align-items:center;gap:8px;margin-top:10px;font:400 13px/1.4 ${SANS}}
.ade-chip{all:unset;cursor:pointer;display:inline-block;padding:3px 7px;border-radius:7px;border:1px solid var(--ade-link);background:var(--ade-linkSoft);font:600 10px/1 ${MONO};color:var(--ade-link)}
.ade-sources{margin-top:10px}
.ade-source{display:flex;gap:10px;align-items:baseline;padding:8px 0;border-top:1px solid var(--ade-faint);text-decoration:none}
.ade-src-n{flex:none;font:600 9.5px/1.5 ${MONO};color:var(--ade-link)}
.ade-src-kind{flex:none;width:38px;font:600 9.5px/1.5 ${MONO};color:var(--ade-muted);letter-spacing:.06em}
.ade-src-title{font:400 12.5px/1.4 ${SANS};color:var(--ade-strong);text-decoration:underline;text-decoration-color:var(--ade-lo);text-underline-offset:3px}
`;
