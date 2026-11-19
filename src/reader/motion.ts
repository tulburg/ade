// Motion (S-7, D-9): the figure's moving parts (at most 3) play in marker order, in a loop, while
// the figure is on screen. They pause while any popup is open, and start paused when the system
// asks for reduced motion. A pause / play control sits with the figure.
import type { Main, Part } from "../format/types.ts";
import type { Extension, Reader } from "./shell.ts";

// S-15: unhurried motion. Each move takes MOVE ms (longer for a long chip path, at most SPEED grid
// units a second), holds HOLD ms before the next starts, and the loop rests REST ms before repeating.
export const MOVE = 2500, HOLD = 1500, REST = 2000, SPEED = 250;

/** How long a part's move takes: MOVE, or longer for a chip whose path is long. */
export function moveTime(p: Part, page: Main): number {
  if (p.kind !== "chip") return MOVE;
  const pts = chipPath(p, page);
  return pts ? Math.max(MOVE, (pathLength(pts) / SPEED) * 1000) : MOVE;
}

/** Start time and duration of every moving part, and the loop's total length. */
export function schedule(moving: Part[], page: Main) {
  let t = 0;
  const slots = moving.map((p) => { const dur = moveTime(p, page), s = { start: t, dur }; t += dur + HOLD; return s; });
  return { slots, total: t - HOLD + REST };
}

export class Motion implements Extension {
  private anims: Animation[] = [];
  private observer: MutationObserver | null = null;
  private userPaused = false;
  private button: HTMLButtonElement | null = null;

  mount(_r: Reader, el: HTMLElement, page: Main) {
    const svg = el.querySelector<SVGSVGElement>("svg.ade-figure");
    if (!svg) return;
    const moving = page.figure.parts.filter((p) => p.motion).sort((a, b) => a.motion!.order - b.motion!.order);
    const { slots, total } = schedule(moving, page);
    moving.forEach((p, k) => {
      const g = svg.querySelector<SVGGElement>(`.ade-part[data-part="${p.id}"]`);
      if (g) this.anims.push(...animatePart(g, p, page, slots[k].start, slots[k].dur, total));
    });
    for (const path of svg.querySelectorAll<SVGPathElement>(".ade-flow"))
      this.anims.push(path.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -20 }], { duration: 900, iterations: Infinity }));

    const box = el.querySelector<HTMLElement>(".ade-figure-box")!;
    this.button = document.createElement("button");
    this.button.className = "ade-btn ade-play";
    this.button.addEventListener("click", (e) => { e.stopPropagation(); this.userPaused = !this.userPaused; this.sync(el); });
    box.append(this.button);

    this.userPaused = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // paused by the system setting: show the final frame, where every moving part has arrived
    if (this.userPaused) for (const a of this.anims) if ((a.effect?.getTiming().duration as number) === total) a.currentTime = total - 1;
    this.observer = new MutationObserver(() => this.sync(el));
    this.observer.observe(el, { childList: true });
    this.sync(el);
  }

  unmount() {
    this.anims.forEach((a) => a.cancel());
    this.anims = [];
    this.observer?.disconnect();
    this.observer = null;
    this.button = null;
  }

  get playing() { return this.anims.some((a) => a.playState === "running"); }

  private sync(el: HTMLElement) {
    const popup = !!el.querySelector(":scope > .ade-popup");
    const run = !this.userPaused && !popup;
    for (const a of this.anims) run ? a.play() : a.pause();
    if (this.button) {
      this.button.textContent = this.userPaused ? "▶ Play" : "❚❚ Pause";
      this.button.setAttribute("aria-pressed", String(!this.userPaused));
    }
  }
}

/** Keyframes that act only inside this part's slot of the shared loop, holding still otherwise.
 * A frame may carry `at` (0..1 within the move); frames without it are spread evenly. */
function slot(frames: (Keyframe & { at?: number })[], start: number, dur: number, total: number): Keyframe[] {
  const a = start / total, b = (start + dur) / total, n = frames.length - 1;
  const at = (f: Keyframe & { at?: number }, i: number) => f.at ?? i / n;
  const strip = ({ at: _at, ...f }: Keyframe & { at?: number }) => f;
  return [
    { ...strip(frames[0]), offset: 0 },
    ...frames.map((f, i) => ({ ...strip(f), offset: a + (b - a) * at(f, i) })),
    { ...strip(frames[n]), offset: 1 },
  ];
}

const EASE = "cubic-bezier(.65,0,.35,1)"; // ease-in-out

function animatePart(g: SVGGElement, p: Part, page: Main, start: number, dur: number, total: number): Animation[] {
  const opts: KeyframeAnimationOptions = { duration: total, iterations: Infinity, easing: "linear" };
  const body = g.querySelector<SVGGElement>(":scope > .ade-body") ?? g;
  const run = (el: Element, frames: (Keyframe & { at?: number })[]) => el.animate(slot(frames, start, dur, total), opts);
  switch (p.kind) {
    case "tape": {
      const el = g.querySelector<SVGElement>(".ade-slot");
      return el ? [run(el, [{ opacity: 1, easing: EASE }, { opacity: 0.2, easing: EASE }, { opacity: 1, easing: EASE }, { opacity: 0.2, easing: EASE }, { opacity: 1 }])] : [];
    }
    case "bars": {
      const el = g.querySelector<SVGElement>(".ade-bar");
      if (!el) return [];
      el.style.transformBox = "fill-box";
      el.style.transformOrigin = "left center";
      return [run(el, [{ transform: "scaleX(0)", easing: EASE }, { transform: "scaleX(1)" }])];
    }
    case "list": {
      const el = g.querySelector<SVGElement>(".ade-slot");
      if (!el) return [];
      return [run(el, [{ transform: "translateX(-24px)", opacity: 0, easing: EASE }, { transform: "translateX(0)", opacity: 1 }])];
    }
    case "files": {
      const el = g.querySelector<SVGElement>(".ade-lamp");
      return el ? [run(el, [{ fill: "var(--ade-accent)" }, { fill: "var(--ade-accent)" }, { fill: "var(--ade-ok)" }])] : [];
    }
    case "chip": {
      const pts = chipPath(p, page);
      if (!pts) break;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, len = pathLength(pts) || 1;
      // a steady speed along the path: each corner is reached in proportion to the distance covered,
      // easing only out of the start and into the end; the chip fades in the last tenth
      let d = 0;
      const frames: (Keyframe & { at?: number })[] = pts.map(([x, y], i) => {
        if (i) d += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
        return { transform: `translate(${x - cx}px,${y - cy}px)`, opacity: 1, at: 0.9 * (d / len) };
      });
      frames[0].easing = "cubic-bezier(.4,0,1,1)";
      frames[frames.length - 2].easing = "cubic-bezier(0,0,.6,1)";
      const [ex, ey] = pts[pts.length - 1];
      // fade out at the end, then come back to rest where it started, so it stays readable
      frames.push({ transform: `translate(${ex - cx}px,${ey - cy}px)`, opacity: 0, at: 1 });
      const back = 1 + Math.min(600, HOLD) / dur;
      frames.push({ transform: "translate(0px,0px)", opacity: 0, at: back - 0.0001 }, { transform: "translate(0px,0px)", opacity: 1, at: back + 400 / dur });
      return [run(body, frames)];
    }
  }
  return [run(body, [{ opacity: 1, easing: EASE }, { opacity: 0.35, easing: EASE }, { opacity: 1 }])];
}

/** The rest of the flow path a chip sits on, from the chip's position to the path's end. */
function chipPath(p: Part, page: Main): [number, number][] | null {
  const path = nearestFlow(p, page);
  if (!path) return null;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, i = nearestIndex(path, cx, cy);
  return [[cx, cy], ...path.slice(i + 1)];
}

function pathLength(pts: [number, number][]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
}

function nearestFlow(p: Part, page: Main): [number, number][] | null {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  let best: [number, number][] | null = null, bestD = Infinity;
  for (const k of page.figure.connections) {
    if (!k.flow && k.from !== p.id && k.to !== p.id) continue;
    for (let i = 0; i < k.points.length - 1; i++) {
      const d = segDist(cx, cy, k.points[i], k.points[i + 1]);
      if (d < bestD) { bestD = d; best = k.points; }
    }
  }
  return bestD < 80 ? best : null;
}

function nearestIndex(pts: [number, number][], x: number, y: number) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = segDist(x, y, pts[i], pts[i + 1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function segDist(x: number, y: number, [x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export const MOTION_CSS = `
.ade-play{position:absolute;right:0;bottom:-6px;font-size:12px;padding:7px 11px}
`;
