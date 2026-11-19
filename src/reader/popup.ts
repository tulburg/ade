// A popup anchored to a word or a figure part, with an arrow pointing at it. It prefers one side,
// flips to the other when it does not fit, and shifts to stay inside the window.

export type Side = "below" | "right";

export interface PopupHandle {
  el: HTMLElement;
  close(): void;
}

const GAP = 12, MARGIN = 12;

export function openPopup(host: HTMLElement, anchor: DOMRect, html: string, prefer: Side, cls = ""): PopupHandle {
  const el = document.createElement("div");
  el.className = `ade-popup ${cls}`.trim();
  el.setAttribute("role", "dialog");
  el.innerHTML = `<div class="ade-arrow"></div><button class="ade-close" aria-label="Close" data-close>&#215;</button>${html}`;
  host.append(el);
  place(el, anchor, prefer);
  return { el, close: () => el.remove() };
}

export function place(el: HTMLElement, a: DOMRect, prefer: Side) {
  const W = window.innerWidth, H = window.innerHeight;
  const { width: w, height: h } = el.getBoundingClientRect();
  const arrow = el.querySelector<HTMLElement>(".ade-arrow")!;
  let x: number, y: number, side: string;
  if (prefer === "below") {
    const below = a.bottom + GAP + h <= H - MARGIN;
    side = below || a.top - GAP - h < MARGIN ? "below" : "above";
    y = side === "below" ? a.bottom + GAP : a.top - GAP - h;
    x = Math.min(Math.max(a.left + a.width / 2 - 36, MARGIN), W - w - MARGIN);
    arrow.style.left = `${Math.min(Math.max(a.left + a.width / 2 - x - 6, 14), w - 26)}px`;
    arrow.style.top = "";
  } else {
    const right = a.right + GAP + w <= W - MARGIN;
    side = right || a.left - GAP - w < MARGIN ? "right" : "left";
    x = side === "right" ? a.right + GAP : a.left - GAP - w;
    const cy = Math.max(a.top, Math.min(a.top + a.height / 2, a.bottom));
    y = Math.min(Math.max(cy - 60, MARGIN), H - h - MARGIN);
    arrow.style.top = `${Math.min(Math.max(cy - y - 6, 14), h - 26)}px`;
    arrow.style.left = "";
  }
  if (side === "right" && x + w > W - MARGIN) x = W - w - MARGIN;
  el.style.left = `${Math.max(x, MARGIN)}px`;
  el.style.top = `${Math.max(y, MARGIN)}px`;
  el.dataset.side = side;
}
