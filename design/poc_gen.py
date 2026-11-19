"""Generates the ADE illustration POC artboards (HTML + inline SVG) for the Spill design tools.

Flat 2D adaptation of the anatomy look (wheresryan22/anatomy): monochrome inks, thin lines,
one lit accent, framed card with Fig / title / hint / readout corners.
Run: python3 design/poc_gen.py <outdir>   -> writes one JSON payload per artboard.
"""
import json, sys, os, re

THEMES = {
    "light": dict(name="light", page="#f2f2ef", card="#fbfbfa", face="#ffffff", shade="#ededea", shade0="#dcdcd9",
                  text="#57575a", strong="#18181a", muted="#8c8c90", hi="#26262a", mid="#8a8a8f",
                  lo="#b4b4b8", faint="#d4d4d6", lit="#000000", accent="#e5484d", accentSoft="#fbe3e3", link="#3e63dd", linkSoft="#e6edfe",
                  ok="#30a46c", okSoft="#dff3e8", btn="#18181a", btnText="#ffffff"),
    "dark": dict(name="dark", page="#0b0b0b", card="#131313", face="#1b1b1b", shade="#151515", shade0="#0a0a0a",
                 text="#a3a3a3", strong="#e6e6e6", muted="#6e6e6e", hi="#d4d4d4", mid="#6a6a6a",
                 lo="#3e3e3e", faint="#2a2a2a", lit="#ffffff", accent="#ff6b6b", accentSoft="#3a1c1c", link="#6b9bff", linkSoft="#1a2340",
                 ok="#6be0a0", okSoft="#14301f", btn="#e6e6e6", btnText="#0b0b0b"),
}
MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace"
SANS = "-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif"


class Svg:
    """Tiny SVG builder with the ADE part vocabulary."""

    def __init__(s, t):
        s.t, s.o = t, []

    def add(s, x):
        s.o.append(x)

    # ---------- primitives
    def rect(s, x, y, w, h, r=4, fill=None, stroke=None, sw=0.8, extra=""):
        s.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill or "none"}" '
              f'stroke="{stroke or "none"}" stroke-width="{sw}" {extra}/>')

    def line(s, pts, tone="lo", sw=0.8, extra=""):
        d = "M" + " L".join(f"{x} {y}" for x, y in pts)
        s.add(f'<path d="{d}" fill="none" stroke="{s.t[tone] if tone in s.t else tone}" stroke-width="{sw}" '
              f'stroke-linecap="round" stroke-linejoin="round" {extra}/>')

    def dot(s, x, y, r=1.1, tone="mid", op=0.7):
        s.add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{s.t[tone]}" opacity="{op}"/>')

    def text(s, x, y, txt, size=8, tone="mid", anchor="start", mono=True, weight=400, ls=".08em", upper=True, extra=""):
        fam = MONO if mono else SANS
        tt = txt.upper() if upper else txt
        s.add(f'<text x="{x}" y="{y}" font-family="{fam}" font-size="{size}" fill="{s.t[tone]}" '
              f'text-anchor="{anchor}" font-weight="{weight}" letter-spacing="{ls}" {extra}>{tt}</text>')

    # ---------- parts
    def body(s, x, y, w, h, r=8, tone="mid", lit=False, inset=True, screws=True):
        t = s.t
        s.rect(x + 1, y + 4, w, h, r, fill=t["shade0"], extra='opacity=".55"')           # cast shade
        s.rect(x, y, w, h, r, fill=t["face"], stroke=t["lit" if lit else tone], sw=1.2 if lit else 0.8)
        s.line([(x + r * .6, y + h - 5), (x + w - r * .6, y + h - 5)], "faint")         # base lip
        if inset:
            s.rect(x + 5, y + 5, w - 10, h - 15, max(r - 3, 2), stroke=t["faint"], sw=0.6)
        if screws:
            for sx, sy in [(x + 9, y + 9), (x + w - 9, y + 9)]:
                s.dot(sx, sy, 1.3, "mid", .55)

    def plate(s, x, y, txt, tone="mid", size=7, w=None):
        """Engraved label plate (the one allowed text on a face)."""
        w = w or len(txt) * size * .68 + 14
        s.rect(x, y, w, 13, 2, fill=s.t["shade"], stroke=s.t["faint"], sw=.6)
        s.text(x + 7, y + 9.2, txt, size, tone)

    def clickable(s, x, y, w, h, ref, r=8, selected=False, corner="tl", cap="", below=False):
        """A part that opens an explainer: blue outline plus a blue reference tag inside its top-left
        or top-right corner (just above the corner only when the part is too small)."""
        t = s.t
        if selected:   # the blue outline shows only on hover or while the part's explainer is open
            s.rect(x, y, w, h, r, stroke=t["link"], sw=1.6)
        cw = len(ref) * 6.4 + 10
        if w < 60 or h < 40:
            cx, cy = (x if corner == "tl" else x + w - cw), y - 18
        else:
            cx, cy = (x + 8 if corner == "tl" else x + w - cw - 8), y + 7
        s.rect(cx, cy, cw, 14, 7, fill=t["link"] if selected else t["linkSoft"], stroke=t["link"], sw=.9)
        s.add(f'<text x="{cx + cw / 2}" y="{cy + 10}" font-family="{MONO}" font-size="8" fill="{t["face"] if selected else t["link"]}" '
              f'text-anchor="middle" font-weight="600" letter-spacing=".04em">{ref}</text>')
        if cap:   # a few words on what the part is, readable before any click
            if below:
                s.caption(x, y + h + 15, cap)
            elif corner == "tl" or w < 60 or h < 40:
                s.caption(cx + cw + 6, cy + 10.5, cap)
            else:
                s.caption(cx - 6, cy + 10.5, cap, "end")

    def caption(s, x, y, txt, anchor="start"):
        s.add(f'<text x="{x}" y="{y}" font-family="{SANS}" font-size="10.5" font-weight="500" fill="{s.t["text"]}" text-anchor="{anchor}">{txt}</text>')

    def note(s, x, y, txt, anchor="start"):
        """A tiny label on a connection."""
        s.add(f'<text x="{x}" y="{y}" font-family="{SANS}" font-size="9" font-style="italic" fill="{s.t["muted"]}" text-anchor="{anchor}">{txt}</text>')

    def badge(s, x, y, n):
        """Accent motion badge: one of the (max 3) animated parts."""
        s.add(f'<circle cx="{x}" cy="{y}" r="7.5" fill="{s.t["accent"]}"/>')
        s.text(x, y + 3, str(n), 8.5, "face", "middle", weight=700, ls="0")

    def pipe(s, pts, flow=False):
        """A rail/pipe drawn as a double line, with direction chevrons engraved."""
        d = "M" + " L".join(f"{x} {y}" for x, y in pts)
        t = s.t
        s.add(f'<path d="{d}" fill="none" stroke="{t["lo"]}" stroke-width="7" stroke-linejoin="round"/>')
        s.add(f'<path d="{d}" fill="none" stroke="{t["face"]}" stroke-width="5.4" stroke-linejoin="round"/>')
        if flow:
            s.add(f'<path d="{d}" fill="none" stroke="{t["accent"]}" stroke-width="1.4" stroke-dasharray="3 7" stroke-linecap="round"/>')
        # chevrons at segment midpoints
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            if abs(x2 - x1) > abs(y2 - y1):
                k = 1 if x2 > x1 else -1
                s.line([(mx - 2 * k, my - 2.4), (mx + 1 * k, my), (mx - 2 * k, my + 2.4)], "mid", .8)
            else:
                k = 1 if y2 > y1 else -1
                s.line([(mx - 2.4, my - 2 * k), (mx, my + 1 * k), (mx + 2.4, my - 2 * k)], "mid", .8)

    def ticks(s, x0, x1, y, n, major=5, down=True):
        s.line([(x0, y), (x1, y)], "lo", .7)
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            L = 5 if i % major == 0 else 2.6
            s.line([(x, y), (x, y + (L if down else -L))], "mid" if i % major == 0 else "lo", .6)

    def vticks(s, x, y0, y1, n, major=5):
        s.line([(x, y0), (x, y1)], "lo", .7)
        for i in range(n + 1):
            y = y0 + (y1 - y0) * i / n
            L = 5 if i % major == 0 else 2.6
            s.line([(x, y), (x + L, y)], "mid" if i % major == 0 else "lo", .6)

    def layers(s, x, y, w, n, gap, seed=1, attn=True):
        """A stack of model layers: rails with node dots and faint attention links."""
        cols = 9
        xs = [x + 14 + (w - 28) * i / (cols - 1) for i in range(cols)]
        if attn:
            for j in range(n - 1):
                y1, y2 = y + j * gap + 6, y + (j + 1) * gap + 6
                for i in range(cols):
                    k2 = (i * 3 + j * 5 + seed) % cols
                    s.line([(xs[i], y1), (xs[k2], y2)], "faint", .6)
        for j in range(n):
            yy = y + j * gap
            s.rect(x, yy, w, 12, 3, fill=s.t["shade"], stroke=s.t["lo"], sw=.6)
            for xx in xs:
                s.dot(xx, yy + 6, 1.5, "mid", .8)

    def svg(s, w, h, label, x0=0, x1=None, y0=0, y1=None):
        x1 = w if x1 is None else x1
        y1 = h if y1 is None else y1
        vw, vh = x1 - x0, y1 - y0
        return (f'<svg width="{vw}" height="{vh}" viewBox="{x0} {y0} {vw} {vh}" role="img" aria-label="{label}" '
                f'style="display:block;overflow:visible;width:100%;height:auto">' + "".join(s.o) + "</svg>")


# ------------------------------------------------------------------ illustrations

# content bounds of each figure, so its left and right edges sit on the page margins (justified layout)
LM_CROP = (36, 966, 34, 474)
AG_CROP = (26, 976, 26, 466)

def fig_language_model(t, selected=None):
    s = Svg(t)
    W, H = 1000, 484
    # A1 tape of tokens
    tx, ty, tw, th = 40, 40, 560, 84
    s.body(tx, ty, tw, th, 10)
    for i in range(26):
        if tx + 30 + i * 20.5 > tx + 270:   # top row starts after the caption
            s.dot(tx + 30 + i * 20.5, ty + 15, 1.6, "lo", .9)
        s.dot(tx + 30 + i * 20.5, ty + 66, 1.6, "lo", .9)
    toks = ["The", " cat", " sat", " on", " the", ""]
    for i, tok in enumerate(toks):
        cx = tx + 22 + i * 86
        if tok:
            s.rect(cx, ty + 24, 78, 32, 4, fill=t["shade"], stroke=t["lo"], sw=.7)
            s.text(cx + 39, ty + 44, tok.replace(" ", "␣"), 11, "strong", "middle", upper=False, ls="0")
        else:
            s.rect(cx, ty + 24, 78, 32, 4, stroke=t["accent"], sw=1, extra='stroke-dasharray="3 3"')
    s.clickable(tx, ty, tw, th, "A1", 10, selected == "A1", cap="The text so far, as tokens")
    s.badge(tx + tw - 4, ty + th + 2, 1)

    # tape -> model
    s.pipe([(320, ty + th), (320, 170)])
    s.note(330, 152, "tokens go in")

    # A2 model + A3 attention
    mx, my, mw, mh = 170, 170, 440, 250
    s.body(mx, my, mw, mh, 12)
    s.layers(mx + 26, my + 26, mw - 52, 7, 26)
    s.plate(mx + 26, my + mh - 34, "model · stack of layers")
    s.clickable(mx, my, mw, mh, "A2", 12, selected == "A2", cap="Layers that weigh tokens together")
    # A3 attention callout ring on the layer links
    s.rect(mx + 324, my + 34, 25, 14, 7, fill=t["linkSoft"], stroke=t["link"], sw=.9)
    s.add(f'<text x="{mx + 336.5}" y="{my + 44}" font-family="{MONO}" font-size="8" fill="{t["link"]}" text-anchor="middle" font-weight="600">A3</text>')
    s.rect(mx + 352, my + 33, 70, 16, 3, fill=t["face"], stroke="none")
    s.caption(mx + 355, my + 44.5, "Attention links")

    # model -> probabilities
    s.pipe([(mx + mw, 300), (660, 300)])
    s.note(635, 290, "to odds", "middle")

    # A4 probability tray
    px, py, pw, ph = 660, 150, 300, 220
    s.body(px, py, pw, ph, 10)
    cands = [("␣mat", .62), ("␣floor", .18), ("␣bed", .09), ("␣sofa", .06), ("␣roof", .03)]
    for i, (tok, p) in enumerate(cands):
        yy = py + 26 + i * 30
        s.text(px + 20, yy + 11, tok, 10, "strong" if i == 0 else "text", upper=False, ls="0")
        s.rect(px + 92, yy, 170, 14, 2, fill=t["shade"], stroke=t["faint"], sw=.6)
        s.rect(px + 92, yy, 170 * p, 14, 2, fill=t["accent"] if i == 0 else t["lo"], stroke="none")
        s.text(px + 268, yy + 11, f"{p:.2f}", 8.5, "mid", ls="0")
    s.ticks(px + 92, px + 262, py + 180, 20)
    s.plate(px + 20, py + ph - 26, "next-token odds", w=124)
    s.clickable(px, py, pw, ph, "A4", 10, selected == "A4", "tr", cap="Odds for each next token")
    s.badge(px + 92 + 170 * .62 + 10, py + 33, 2)

    # A5 sampler knob
    kx, ky, kw, kh = 660, 392, 170, 62
    s.body(kx, ky, kw, kh, 8, screws=False)
    cx, cy = kx + 34, ky + 28
    for i in range(13):
        import math
        a = math.radians(-220 + i * 260 / 12)
        r1, r2 = 17, 20 if i % 3 == 0 else 18.6
        s.line([(cx + r1 * math.cos(a), cy + r1 * math.sin(a)), (cx + r2 * math.cos(a), cy + r2 * math.sin(a))], "mid", .6)
    s.add(f'<circle cx="{cx}" cy="{cy}" r="13" fill="{t["face"]}" stroke="{t["hi"]}" stroke-width=".9"/>')
    s.add(f'<circle cx="{cx}" cy="{cy}" r="10" fill="none" stroke="{t["faint"]}" stroke-width=".6"/>')
    import math
    a = math.radians(-220 + 260 * .35)
    s.line([(cx, cy), (cx + 10 * math.cos(a), cy + 10 * math.sin(a))], "hi", 1.2)
    s.text(kx + 62, ky + 25, "temperature", 7, "mid")
    s.text(kx + 62, ky + 39, "0.7", 10, "strong", ls="0")
    s.clickable(kx, ky, kw, kh, "A5", 8, selected == "A5", "tr", cap="How adventurous the pick is", below=True)

    # chosen token travels back to the tape
    s.pipe([(930, py), (930, 82), (tx + tw, 82)], flow=True)
    s.rect(700, 70, 62, 24, 4, fill=t["accentSoft"], stroke=t["accent"], sw=1)
    s.text(731, 86, "␣mat", 10.5, "strong", "middle", upper=False, ls="0")
    s.badge(770, 70, 3)
    s.note(790, 74, "picked token is appended")
    return s.svg(W, H, x0=LM_CROP[0], x1=LM_CROP[1], y0=LM_CROP[2], y1=LM_CROP[3], label="A language model: tokens on a tape go through a stack of layers, which gives odds for the next token; one is picked and appended.")


def fig_agent(t, selected=None):
    s = Svg(t)
    W, H = 1000, 470
    # C1 task terminal
    s.body(30, 30, 210, 110, 8, screws=False)
    s.rect(30, 30, 210, 20, 8, fill=t["shade"], stroke="none")
    s.line([(30, 50), (240, 50)], "faint")
    for i in range(3):
        s.add(f'<circle cx="{44 + i * 11}" cy="40" r="3" fill="none" stroke="{t["lo"]}" stroke-width=".7"/>')
    s.text(46, 74, "&gt; fix the failing", 10.5, "strong", upper=False, ls="0")
    s.text(46, 92, "  test in auth.ts", 10.5, "strong", upper=False, ls="0")
    s.add(f'<rect x="46" y="102" width="7" height="12" fill="{t["hi"]}" opacity=".7"/>')
    s.clickable(30, 30, 210, 110, "C1", 8, selected == "C1", "tr", cap="Your request, typed once")

    s.pipe([(135, 140), (135, 186)])
    s.note(145, 167, "task enters the context")

    # C2 context window
    cx, cy, cw, ch = 30, 186, 210, 270
    s.body(cx, cy, cw, ch, 10)
    slots = [("system prompt", "lo"), ("task", "lo"), ("file · auth.ts", "lo"),
             ("result · 2 tests fail", "lo"), ("edit applied", "accent")]
    for i, (lab, tone) in enumerate(slots):
        yy = cy + 30 + i * 32
        off = 8 if tone == "accent" else 0
        fill = t["accentSoft"] if tone == "accent" else t["shade"]
        s.rect(cx + 14 + off, yy, 160 - off, 25, 4, fill=fill, stroke=t[tone], sw=.8)
        s.line([(cx + 22 + off, yy + 6), (cx + 22 + off, yy + 19)], tone, 1.4)
        s.text(cx + 30 + off, yy + 16, lab, 8, "strong" if tone == "accent" else "text")
    for i in range(5, 7):
        yy = cy + 30 + i * 32
        s.rect(cx + 14, yy, 160, 25, 4, stroke=t["faint"], sw=.8, extra='stroke-dasharray="3 3"')
    s.vticks(cx + 186, cy + 30, cy + 247, 20)
    s.rect(cx + 194, cy + 30, 5, 217, 2, fill=t["shade"], stroke=t["faint"], sw=.5)
    s.rect(cx + 194, cy + 30, 5, 155, 2, fill=t["mid"], stroke="none")
    s.badge(cx + 196, cy + 30 + 4 * 32 + 12, 1)
    s.clickable(cx, cy, cw, ch, "C2", 10, selected == "C2", cap="All the model can see")

    # context -> model
    s.pipe([(cx + cw, 320), (330, 320)])
    s.note(285, 311, "read every step", "middle")

    # C3 model (same part as L1 A2)
    mx, my, mw, mh = 330, 196, 260, 220
    s.body(mx, my, mw, mh, 12)
    s.layers(mx + 22, my + 24, mw - 44, 6, 26, seed=3)
    s.plate(mx + 22, my + mh - 34, "model · = L1 A2")
    s.clickable(mx, my, mw, mh, "C3", 12, selected == "C3", cap="Reads it all, picks the next move")

    # model -> tools: tool call packet (C4)
    s.pipe([(mx + mw / 2, my), (mx + mw / 2, 96), (650, 96)], flow=True)
    s.note(mx + mw / 2 + 10, 150, "calls one tool")
    s.rect(486, 82, 132, 28, 4, fill=t["accentSoft"], stroke=t["accent"], sw=1)
    s.text(552, 100, "edit_file(auth.ts)", 9.5, "strong", "middle", upper=False, ls="0")
    s.clickable(486, 82, 132, 28, "C4", 4, selected == "C4", cap="The tool call")
    s.badge(626, 82, 2)

    # C5 tools rack
    rx, ry, rw, rh = 650, 30, 320, 210
    s.body(rx, ry, rw, rh, 10)
    tools = ["read file", "edit file", "run command", "search"]
    for i, lab in enumerate(tools):
        yy = ry + 26 + i * 40
        out = -16 if i == 1 else 0
        lit = i == 1
        s.rect(rx + 16 + out, yy, rw - 32, 32, 4, fill=t["face"], stroke=t["lit" if lit else "mid"], sw=1.1 if lit else .7)
        s.rect(rx + 26 + out, yy + 9, 92, 14, 2, fill=t["shade"], stroke=t["faint"], sw=.6)
        s.text(rx + 32 + out, yy + 19, lab, 7.5, "strong" if lit else "text")
        s.rect(rx + rw - 82 + out, yy + 12, 40, 8, 4, fill=t["shade"], stroke=t["hi" if lit else "mid"], sw=.8)
        s.dot(rx + rw - 30 + out, yy + 8, 1, "mid", .6)
        s.dot(rx + rw - 30 + out, yy + 24, 1, "mid", .6)
    s.clickable(rx, ry, rw, rh, "C5", 10, selected == "C5", "tr", cap="What the agent can do")

    s.pipe([(810, ry + rh), (810, 290)])
    s.note(820, 268, "tool changes the code")

    # C6 workspace
    wx, wy, ww, wh = 650, 290, 320, 166
    s.body(wx, wy, ww, wh, 10)
    files = ["auth.ts", "auth.test.ts", "index.ts", "db.ts", "README", "package.json"]
    for i, f in enumerate(files):
        col, row = i % 3, i // 3
        fx, fy = wx + 18 + col * 74, wy + 22 + row * 50
        lit = f == "auth.ts"
        s.add(f'<path d="M{fx} {fy} H{fx + 54} L{fx + 64} {fy + 10} V{fy + 40} H{fx} Z" fill="{t["face"]}" '
              f'stroke="{t["lit" if lit else "mid"]}" stroke-width="{1.1 if lit else .7}" stroke-linejoin="round"/>')
        s.line([(fx + 54, fy), (fx + 54, fy + 10), (fx + 64, fy + 10)], "lo", .6)
        for k in range(3):
            s.line([(fx + 7, fy + 15 + k * 6), (fx + 7 + [40, 30, 36][k], fy + 15 + k * 6)], "faint", .9)
        s.text(fx + 32, fy + 54 - 2 if False else fy + 50, "", 6)
    for i, f in enumerate(files):
        col, row = i % 3, i // 3
        fx, fy = wx + 18 + col * 74, wy + 22 + row * 50
        s.text(fx + 3, fy + 47, f, 6.5, "text", upper=False, ls="0")
    # test lamp
    lx, ly = wx + ww - 44, wy + 44
    s.add(f'<circle cx="{lx}" cy="{ly}" r="17" fill="{t["shade"]}" stroke="{t["mid"]}" stroke-width=".8"/>')
    s.add(f'<circle cx="{lx}" cy="{ly}" r="11" fill="{t["accent"]}" stroke="{t["hi"]}" stroke-width=".6"/>')
    s.add(f'<circle cx="{lx - 3.5}" cy="{ly - 3.5}" r="3" fill="#ffffff" opacity=".55"/>')
    s.text(lx, ly + 32, "tests", 7, "mid", "middle")
    s.text(lx, ly + 44, "2 fail", 9, "strong", "middle", upper=False, ls="0")
    s.badge(lx + 17, ly - 17, 3)
    s.plate(wx + 18, wy + wh - 30, "repo · working tree", w=136)
    s.clickable(wx, wy, ww, wh, "C6", 10, selected == "C6", cap="Your code and its tests")

    # results flow back into the context window
    s.pipe([(wx, 440), (cx + cw, 440)])
    s.note((wx + cx + cw) / 2, 432, "result goes back into the context", "middle")
    return s.svg(W, H, x0=AG_CROP[0], x1=AG_CROP[1], y0=AG_CROP[2], y1=AG_CROP[3], label="An AI coding agent loop: a task enters the context window, the model reads it and calls a tool, the tool changes the repo, and the result is appended to the context for the next step.")


# ------------------------------------------------------------------ viewer chrome

def rail(t, states):
    """Level rail. states: list of (status) for L1, L2, MAIN; status in current|upcoming|skipped|read|locked."""
    items = [("Level 1", "What a language model does"), ("Level 2", "Tools and the context window"),
             ("Main concept", "How an AI coding agent works")]

    def node(st):
        if st in ("skipped", "read"):
            return (f'<div style="width:20px;height:20px;border-radius:10px;background:{t["okSoft"]};border:1px solid {t["ok"]};'
                    f'display:flex;align-items:center;justify-content:center;color:{t["ok"]};font-size:11px;font-weight:700">&#10003;</div>')
        if st == "current":
            return (f'<div style="width:20px;height:20px;border-radius:10px;background:{t["strong"]};'
                    f'box-shadow:0 0 0 4px {t["faint"]}"></div>')
        return f'<div style="width:20px;height:20px;border-radius:10px;border:1px solid {t["lo"]};background:{t["card"]}"></div>'

    status_txt = {"current": "Now", "upcoming": "Not checked yet", "skipped": "You said you know this",
                  "read": "Read", "locked": "After the levels above"}

    def item(i, st, main=False):
        eb, title = items[i]
        col = t["strong"] if st == "current" else t["text"]
        size = "17px" if main else "14px"
        sub = status_txt[st]
        rev = (f'<span style="margin-left:8px;color:{t["muted"]};text-decoration:underline;text-underline-offset:3px">Revisit</span>'
               if st in ("skipped", "read") else "")
        bg = f'background:{t["face"]};box-shadow:0 0 0 1px {t["faint"]};' if st == "current" else ""
        return (f'<div style="display:flex;gap:14px;align-items:flex-start;padding:12px;border-radius:10px;{bg}">'
                f'<div style="flex:none;padding-top:2px">{node(st)}</div>'
                f'<div style="display:flex;flex-direction:column;gap:4px">'
                f'<div style="font:500 10px/1 {MONO};letter-spacing:.1em;text-transform:uppercase;color:{t["muted"]}">{eb}</div>'
                f'<div style="font:600 {size}/1.3 {SANS};color:{col}">{title}</div>'
                f'<div style="font:400 12px/1.4 {SANS};color:{t["muted"]}">{sub}{rev}</div></div></div>')

    line = f'<div style="margin-left:21px;width:1px;height:18px;background:{t["lo"]}"></div>'
    return (f'<div style="width:300px;flex:none;border-right:1px solid {t["faint"]};padding:28px 20px;display:flex;'
            f'flex-direction:column;background:{t["page"]}">'
            f'<div style="font:500 10px/1 {MONO};letter-spacing:.12em;text-transform:uppercase;color:{t["muted"]};padding:0 12px 16px">'
            f'Before the main concept</div>'
            f'{item(0, states[0])}{line}{item(1, states[1])}'
            f'<div style="flex:1;min-height:40px;margin-left:21px;border-left:1px dashed {t["lo"]}"></div>'
            f'<div style="border-top:1px solid {t["faint"]};padding-top:14px">{item(2, states[2], True)}</div>'
            f'</div>')


def rail_slim(t, states):
    """Collapsed rail, used while an explainer is open so the figure keeps its size."""
    def node(st, lab):
        if st in ("skipped", "read"):
            n = (f'<div style="width:22px;height:22px;border-radius:11px;background:{t["okSoft"]};border:1px solid {t["ok"]};'
                 f'display:flex;align-items:center;justify-content:center;color:{t["ok"]};font-size:11px;font-weight:700">&#10003;</div>')
        elif st == "current":
            n = f'<div style="width:22px;height:22px;border-radius:11px;background:{t["strong"]};box-shadow:0 0 0 4px {t["faint"]}"></div>'
        else:
            n = f'<div style="width:22px;height:22px;border-radius:11px;border:1px solid {t["lo"]}"></div>'
        return (f'<div style="display:flex;flex-direction:column;align-items:center;gap:7px">{n}'
                f'<div style="font:500 9.5px/1 {MONO};letter-spacing:.08em;color:{t["muted"]}">{lab}</div></div>')
    ln = f'<div style="width:1px;height:26px;background:{t["lo"]}"></div>'
    return (f'<div style="width:76px;flex:none;border-right:1px solid {t["faint"]};padding:30px 0;display:flex;'
            f'flex-direction:column;align-items:center;gap:8px;background:{t["page"]}">'
            f'{node(states[0], "L1")}{ln}{node(states[1], "L2")}'
            f'<div style="flex:1;border-left:1px dashed {t["lo"]};min-height:30px"></div>{node(states[2], "MAIN")}</div>')


def topbar(t, step):
    """Reader chrome only: the document's own title, like a PDF viewer's file name."""
    return (f'<div style="height:48px;flex:none;display:flex;align-items:center;padding:0 24px;'
            f'border-bottom:1px solid {t["faint"]};background:{t["page"]};font:500 13px/1 {SANS};color:{t["muted"]}">'
            f'How an AI coding agent works</div>')


def btn(t, label, primary=False):
    if primary:
        return (f'<span style="padding:11px 18px;border-radius:8px;background:{t["btn"]};color:{t["btnText"]};'
                f'font:600 14px/1 {SANS}">{label}</span>')
    return (f'<span style="padding:10px 17px;border-radius:8px;border:1px solid {t["mid"]};color:{t["strong"]};'
            f'font:600 14px/1 {SANS}">{label}</span>')


def quiz(t, question, picked=None):
    """The level check, read like a quiz: question on the left, Yes / No on the right."""
    def opt(label, on, kind):
        if on:
            col = t["accent"] if kind == "no" else t["ok"]
            bg = t["accentSoft"] if kind == "no" else t["okSoft"]
            return (f'<span style="padding:11px 22px;border-radius:8px;background:{bg};color:{col};box-shadow:inset 0 0 0 1.5px {col};'
                    f'font:650 15px/1 {SANS}">{label}</span>')
        dim = picked is not None
        return (f'<span style="padding:11px 22px;border-radius:8px;box-shadow:inset 0 0 0 1px {t["lo" if dim else "mid"]};'
                f'color:{t["muted" if dim else "strong"]};background:{t["face"]};font:650 15px/1 {SANS}">{label}</span>')
    return (f'<div style="display:flex;align-items:center;gap:24px;padding:18px 22px;border-radius:12px;background:{t["face"]};'
            f'box-shadow:0 0 0 1px {t["faint"]}">'
            f'<div style="flex:1;font:500 19px/1.4 {SANS};color:{t["strong"]}">{question}</div>'
            f'<div style="display:flex;gap:10px;flex:none">{opt("Yes", picked == "yes", "yes")}{opt("No", picked == "no", "no")}</div></div>')


def term(t, word, open_=False):
    """A word or concept the reader may not know: underlined, click for its full definition."""
    bg = f'background:{t["linkSoft"]};border-radius:3px;' if open_ else ""
    return (f'<span style="{bg}color:{t["strong"]};text-decoration:underline;text-decoration-color:{t["link"]};'
            f'text-decoration-thickness:1.5px;text-underline-offset:4px">{word}</span>')


def ref(t, n):
    """A numbered reference; click it to see the source."""
    return f'<sup style="font:600 10px/0 {MONO};color:{t["link"]};margin-left:1px">[{n}]</sup>'


def explain(t, text, open_term=None):
    """Fill {term|word} and [n] markers in a paragraph."""
    text = re.sub(r"\{([^}]+)\}", lambda m: term(t, m.group(1), m.group(1) == open_term), text)
    # keep each reference on the line of the word it belongs to
    return re.sub(r"(\S+)\[(\d)\]", lambda m: f'<span style="white-space:nowrap">{m.group(1)}{ref(t, m.group(2))}</span>', text)


def header(t, title, question=None, picked=None, lede=None):
    q = quiz(t, question, picked) if question else ""
    l = (f'<div style="font:400 16px/1.6 {SANS};color:{t["text"]};margin-top:10px;text-align:justify;hyphens:auto">{lede}</div>'
         if lede else "")
    return (f'<div style="padding:32px 0 0">{q}'
            f'<div style="font:650 28px/1.15 {SANS};letter-spacing:-.01em;color:{t["strong"]};margin-top:{22 if q else 0}px">{title}</div>{l}</div>')


def card(t, fig, figlabel=None, title=None, hint=None, readout=None, overlay=""):
    """The figure alone, scaled as large as the page allows. No frame and no corner text."""
    return (f'<div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;margin:16px 0 60px">'
            f'<div style="position:relative;width:100%">{fig}{overlay}</div></div>')


def next_btn(t):
    """After the reveal there is no second question: the answer on the cover stands. Next moves on."""
    return (f'<div style="position:absolute;right:72px;bottom:12px;padding:11px 20px;border-radius:9px;background:{t["btn"]};'
            f'color:{t["btnText"]};font:600 14px/1 {SANS}">Next &#8594;</div>')


def frame(t, rail_states, step, head, body, slim=False, nxt=False, overlay=""):
    """Full-screen reader page: no app chrome, no list of levels; one level at a time."""
    return (f'<div style="width:1440px;height:900px;display:flex;flex-direction:column;background:{t["page"]};font-family:{SANS};position:relative;'
            f'padding:8px 72px 0;box-sizing:border-box">{head}{body}{concept(t, rail_states[2] == "current")}'
            f'{next_btn(t) if nxt else ""}{overlay}</div>')


def concept(t, here):
    """The one thing always shown: which concept this document explains."""
    note = "You are here" if here else "Explained after the basics it needs"
    return (f'<div style="position:absolute;left:72px;bottom:6px;height:40px;display:flex;align-items:center;gap:12px">'
            f'<span style="font:500 10px/1 {MONO};letter-spacing:.12em;text-transform:uppercase;color:{t["muted"]}">Main concept</span>'
            f'<span style="font:600 14px/1 {SANS};color:{t["strong"]}">How an AI coding agent works</span>'
            f'<span style="font:400 12px/1 {SANS};color:{t["muted"]}">{note}</span></div>')


def popup(t):
    chip = lambda r: (f'<span style="display:inline-block;padding:3px 7px;border-radius:7px;border:1px solid {t["link"]};background:{t["linkSoft"]};'
                      f'font:600 10px/1 {MONO};color:{t["link"]};margin-right:5px">{r}</span>')
    src = lambda kind, name: (f'<div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid {t["faint"]}">'
                              f'<span style="flex:none;width:34px;font:600 9.5px/1.5 {MONO};color:{t["muted"]};letter-spacing:.06em">{kind}</span>'
                              f'<span style="font:400 12.5px/1.4 {SANS};color:{t["strong"]};text-decoration:underline;'
                              f'text-decoration-color:{t["lo"]};text-underline-offset:3px">{name} &#8599;</span></div>')
    sec = lambda s_: f'<div style="font:500 9.5px/1 {MONO};letter-spacing:.12em;text-transform:uppercase;color:{t["muted"]};margin:14px 0 8px">{s_}</div>'
    # anchored to C2's right edge (figure units 240 x, 330 y of 1000 x 470), arrow pointing at it
    lx = (240 - AG_CROP[0]) / (AG_CROP[1] - AG_CROP[0]) * 100
    ty = (330 - AG_CROP[2]) / (AG_CROP[3] - AG_CROP[2]) * 100
    return (f'<div style="position:absolute;left:{lx:.1f}%;top:calc({ty:.1f}% - 200px);width:380px;background:{t["face"]};border-radius:12px;'
            f'box-shadow:0 0 0 1px {t["link"]},0 16px 40px -10px rgba(0,0,0,.22);padding:18px 20px 12px">'
            f'<div style="position:absolute;left:-7px;top:194px;width:12px;height:12px;background:{t["face"]};'
            f'transform:rotate(45deg);box-shadow:-1px 1px 0 0 {t["link"]}"></div>'
            f'<div style="display:flex;align-items:center;justify-content:space-between">'
            f'<div style="display:flex;align-items:center;gap:8px"><span style="padding:4px 8px;border-radius:8px;background:{t["link"]};'
            f'color:{t["face"]};font:700 10.5px/1 {MONO}">C2</span>'
            f'<span style="font:650 16px/1.2 {SANS};color:{t["strong"]}">Context window</span></div>'
            f'<span style="font:400 18px/1 {SANS};color:{t["muted"]}">&#215;</span></div>'
            f'<div style="font:400 13.5px/1.5 {SANS};color:{t["text"]};margin-top:10px">'
            f'Everything the model can see on this step: its instructions, your task, the files it has read, and the result of '
            f'every tool call so far. It is re-read in full on every step. Anything not in it does not exist for the model.</div>'
            f'{sec("How it connects")}'
            f'<div style="font:400 13px/1.7 {SANS};color:{t["text"]}">{chip("C1")}your task enters it once<br>'
            f'{chip("C3")}the model reads all of it each step<br>{chip("C6")}every tool result is appended to it<br>'
            f'{chip("L2 B1")}it has a size limit; when full, old items are summarized</div>'
            f'{sec("Sources")}{src("DOC", "Anthropic docs: Context windows")}'
            f'{src("PDF", "Vaswani et al., Attention Is All You Need (2017)")}'
            f'{src("DOC", "Claude Code docs: How the agent loop works")}</div>')


# ------------------------------------------------------------------ artboards

L1_TEXT = ('A language model writes by predicting. It splits the text so far into {tokens}, short pieces of words that each map to a number, '
           'and passes them through a stack of {transformer layers}. Every layer uses {attention} to weigh each token against every other, '
           'so a word is read in the context of the words around it.[1] The last layer turns this into a {probability distribution}: odds for '
           'every token in a vocabulary of about 100,000. The model {samples} one of them, and the {temperature} setting decides how adventurous '
           'that pick is; a low value almost always takes the likeliest token.[2] The chosen token is appended to the text, and the whole loop '
           'runs again on the longer text. Writing a paragraph is this loop repeated, one token at a time.[3]')
MAIN_TEXT = ('An AI coding agent is a {language model} run in a loop with {tools}. Your request goes into its {context window}, the working memory '
             'that holds everything the model can see: its instructions, your task, the files it has read and the result of every step so far.[1] '
             'On each step the model reads the whole context and answers with text or a {tool call}, a structured request such as '
             'edit_file(auth.ts).[2] The program around the model, the {harness}, runs that tool against your code and appends the result to the '
             'context. The loop repeats (read, act, observe) until the tests pass or the model decides the task is done. Nothing is remembered '
             'outside the context, so when it fills up, older steps are {summarized} to make room.[3]')
L1_LEDE = 'A language model reads the text so far as a row of tokens, runs them through a stack of layers that weigh every token against every other, and gets back odds for every possible next token. It picks one (temperature sets how adventurous the pick is), appends it, and repeats. Writing is that loop, one token at a time.'


def ab_check(t):
    head = header(t, "What a language model does",
                  "Do you fully understand how a language model turns text into the next word?")
    hidden = (f'<div style="margin:22px 0 40px;flex:1;border:1px dashed {t["lo"]};display:flex;'
              f'flex-direction:column;align-items:center;justify-content:center;gap:10px;background:{t["card"]}">'
              f'<div style="font:500 10.5px/1 {MONO};letter-spacing:.12em;text-transform:uppercase;color:{t["muted"]}">Fig 1</div>'
              f'<div style="font:400 14px/1.5 {SANS};color:{t["muted"]};max-width:420px;text-align:center">'
              f'Answer No and this figure opens. Yes moves on to the next level.</div></div>')
    return frame(t, ["current", "upcoming", "locked"], "", head, hidden)


def term_popup(t):
    """Definition of an underlined term, opened under it: what it means, where it is in the figure, the source."""
    return (f'<div style="position:absolute;left:252px;top:142px;width:400px;background:{t["face"]};border-radius:12px;'
            f'box-shadow:0 0 0 1px {t["link"]},0 16px 40px -10px rgba(0,0,0,.22);padding:16px 20px 12px;z-index:2">'
            f'<div style="position:absolute;left:24px;top:-7px;width:12px;height:12px;background:{t["face"]};'
            f'transform:rotate(45deg);box-shadow:-1px -1px 0 0 {t["link"]}"></div>'
            f'<div style="display:flex;justify-content:space-between;align-items:baseline">'
            f'<span style="font:650 16px/1.2 {SANS};color:{t["strong"]}">Attention</span>'
            f'<span style="font:400 18px/1 {SANS};color:{t["muted"]}">&#215;</span></div>'
            f'<div style="font:400 13.5px/1.5 {SANS};color:{t["text"]};margin-top:8px">'
            f'The step inside each layer that decides which other tokens matter for this one. In &#8220;the cat sat on the&#8221;, the '
            f'next word leans on &#8220;sat on&#8221; far more than on &#8220;the&#8221;. Attention gives each pair of tokens a weight and '
            f'mixes their meanings by those weights.</div>'
            f'<div style="display:flex;align-items:center;gap:8px;margin-top:10px;font:400 13px/1.4 {SANS};color:{t["text"]}">'
            f'<span style="padding:3px 7px;border-radius:7px;border:1px solid {t["link"]};background:{t["linkSoft"]};'
            f'font:600 10px/1 {MONO};color:{t["link"]}">A3</span>the lines between tokens in the figure</div>'
            f'<div style="display:flex;gap:10px;padding:8px 0 0;margin-top:10px;border-top:1px solid {t["faint"]}">'
            f'<span style="flex:none;font:600 9.5px/1.5 {MONO};color:{t["link"]}">[1]</span>'
            f'<span style="font:400 12.5px/1.4 {SANS};color:{t["strong"]};text-decoration:underline;text-decoration-color:{t["lo"]};'
            f'text-underline-offset:3px">Vaswani et al., Attention Is All You Need (2017) &#8599;</span></div></div>')


def ab_l1(t, open_term=None):
    head = header(t, "What a language model does", lede=explain(t, L1_TEXT, open_term))
    body = card(t, fig_language_model(t))
    return frame(t, ["current", "upcoming", "locked"], "", head, body, nxt=True,
                 overlay=term_popup(t) if open_term else "")


def ab_main(t):
    head = header(t, "How an AI coding agent works",
                  lede=explain(t, MAIN_TEXT))
    body = card(t, fig_agent(t, "C2"), "Fig 3 \u00b7 Main", "Agent loop", "Click a marked part",
                "loop step 4 \u00b7 context 38k / 200k", popup(t))
    return frame(t, ["skipped", "read", "current"], "", head, body)


# ---------- pin 7: the question alone, centred, full screen

def centred_page(t, title, question, here=False, extra=""):
    big = (f'<span style="padding:16px 44px;border-radius:12px;background:{t["btn"]};color:{t["btnText"]};font:650 18px/1 {SANS}">Yes</span>'
           f'<span style="padding:15px 43px;border-radius:12px;box-shadow:inset 0 0 0 1.5px {t["mid"]};color:{t["strong"]};'
           f'background:{t["face"]};font:650 18px/1 {SANS}">No</span>')
    return (f'<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;'
            f'gap:28px;padding:0 160px;text-align:center;background:{t["page"]}{extra}">'
            f'<div style="font:500 13px/1 {MONO};letter-spacing:.12em;text-transform:uppercase;color:{t["muted"]}">{title}</div>'
            f'<div style="font:600 40px/1.25 {SANS};letter-spacing:-.015em;color:{t["strong"]};max-width:920px">{question}</div>'
            f'<div style="display:flex;gap:14px;margin-top:6px">{big}</div>'
            f'<div style="display:flex;gap:28px;font:400 13px/1.4 {SANS};color:{t["muted"]}">'
            f'<span>Yes: the next page slides in from the right</span><span>No: the figure for this page opens</span></div>'
            f'{concept(t, here).replace("left:72px", "left:72px;text-align:left")}</div>')


def ab_check_centred(t):
    return (f'<div style="width:1440px;height:900px;position:relative;overflow:hidden;font-family:{SANS}">'
            + centred_page(t, "What a language model does",
                           "Do you fully understand how a language model turns text into the next word?") + '</div>')


def ab_yes_slide(t):
    """Mid-transition after Yes: this page leaves to the left, the next page comes in from the right."""
    leaving = centred_page(t, "What a language model does",
                           "Do you fully understand how a language model turns text into the next word?",
                           extra=";transform:translateX(-62%);opacity:.35")
    coming = centred_page(t, "Tools and the context window",
                          "Do you fully understand what a tool call is and what a context window holds?",
                          extra=f";transform:translateX(38%);box-shadow:-24px 0 48px -24px rgba(0,0,0,.25)")
    return (f'<div style="width:1440px;height:900px;position:relative;overflow:hidden;background:{t["page"]};font-family:{SANS}">'
            f'{leaving}{coming}</div>')


def ab_no_full(t):
    return ab_l1(t, open_term="attention")


def _ab_no_full_old(t):
    """After No on the centred design: the question shrinks to one line and the figure takes the screen."""
    chip = (f'<span style="padding:6px 12px;border-radius:999px;background:{t["accentSoft"]};color:{t["accent"]};'
            f'font:600 12px/1 {SANS}">No</span>')
    top = (f'<div style="height:64px;flex:none;display:flex;align-items:center;justify-content:center;gap:14px;'
           f'font:500 15px/1.3 {SANS};color:{t["text"]}">Do you fully understand how a language model turns text into the next word?{chip}'
           f'<span style="font:500 13px/1 {SANS};color:{t["strong"]};text-decoration:underline;text-underline-offset:3px">I get it now</span></div>')
    top += (f'<div style="padding:6px 40px 0"><div style="font:650 26px/1.2 {SANS};color:{t["strong"]}">What a language model does</div>'
            f'<div style="font:400 16px/1.5 {SANS};color:{t["text"]};margin-top:8px;max-width:980px">{L1_LEDE}</div></div>')
    body = card(t, fig_language_model(t), "Fig 1 \u00b7 What a language model does", "Language model", "Click a marked part",
                "step 6 \u00b7 next \u2423mat \u00b7 p 0.62")
    return (f'<div style="width:1440px;height:900px;display:flex;flex-direction:column;background:{t["page"]};'
            f'font-family:{SANS};position:relative;padding:0 32px;box-sizing:border-box">{top}{body}{concept(t, False).replace("left:72px", "left:32px")}</div>')


def ab_legend(t):
    def mini(content, w=200, h=90):
        return (f'<div style="width:{w}px;height:{h}px;background:{t["card"]};box-shadow:0 0 0 1px {t["faint"]};'
                f'display:flex;align-items:center;justify-content:center;overflow:hidden">{content}</div>')

    s1 = Svg(t); s1.body(40, 20, 120, 50, 8); s1.plate(54, 40, "simple part", w=90)
    s2 = Svg(t); s2.body(40, 26, 120, 46, 8); s2.clickable(40, 26, 120, 46, "B2", 8, corner="tr"); s2.plate(48, 44, "clickable", w=76)
    s3 = Svg(t); s3.body(40, 26, 120, 46, 8, lit=True); s3.clickable(40, 26, 120, 46, "B2", 8, True, "tr"); s3.plate(48, 44, "open now", w=70)
    s4 = Svg(t); s4.rect(50, 32, 80, 26, 4, fill=t["accentSoft"], stroke=t["accent"], sw=1); s4.badge(140, 32, 1)
    s4.text(90, 49, "moving", 8, "strong", "middle")

    def col(title, rows):
        return (f'<div style="flex:1;display:flex;flex-direction:column;gap:14px">'
                f'<div style="font:500 11px/1 {MONO};letter-spacing:.12em;text-transform:uppercase;color:{t["muted"]}">{title}</div>{rows}</div>')

    def mark_row(svg, name, desc):
        return (f'<div style="display:flex;gap:16px;align-items:center">{mini(svg)}<div style="max-width:250px">'
                f'<div style="font:600 14px/1.3 {SANS};color:{t["strong"]}">{name}</div>'
                f'<div style="font:400 13px/1.5 {SANS};color:{t["text"]};margin-top:4px">{desc}</div></div></div>')

    marks = (mark_row(s1.svg(200, 90, ""), "Simple part", "Needs no explaining. Thin mid-grey outline, no ring, no tag.")
             + mark_row(s2.svg(200, 90, ""), "Clickable part", "A blue reference tag inside its top-left or top-right corner (outside only when the part is too small); a blue outline appears on hover. The tag is its address: other explainers cite it as B2 or, across levels, L2 B2.")
             + mark_row(s3.svg(200, 90, ""), "Open part", "The part whose explainer is open: solid blue tag, heavier outline. Its explainer pops up on the part, with an arrow.")
             + mark_row(s4.svg(200, 90, ""), "Moving part", "The only colour in the figure. Numbered 1 to 3; never more than 3 per figure."))

    def strip(title, frames, desc):
        fr = "".join(mini(f, 120, 70) for f in frames)
        return (f'<div style="display:flex;flex-direction:column;gap:8px"><div style="font:600 14px/1.3 {SANS};color:{t["strong"]}">{title}</div>'
                f'<div style="display:flex;gap:8px">{fr}</div>'
                f'<div style="font:400 13px/1.5 {SANS};color:{t["text"]};max-width:390px">{desc}</div></div>')

    def tape(stage):
        s = Svg(t)
        toks = 4
        for i in range(toks):
            x = 10 + i * 26 - (13 if stage == 2 else 0)
            last = i == toks - 1
            if last and stage == 0:
                s.rect(x, 25, 22, 20, 3, stroke=t["accent"], sw=.8, extra='stroke-dasharray="2 2"')
            else:
                s.rect(x, 25, 22, 20, 3, fill=t["accentSoft"] if last else t["shade"], stroke=t["accent"] if last else t["lo"], sw=.8)
        if stage == 2:
            s.rect(10 + toks * 26 - 13, 25, 22, 20, 3, stroke=t["accent"], sw=.8, extra='stroke-dasharray="2 2"')
        return s.svg(120, 70, "")

    def bars(k):
        s = Svg(t)
        for i, p in enumerate([.62, .18, .09]):
            s.rect(14, 16 + i * 14, 92, 9, 2, fill=t["shade"], stroke=t["faint"], sw=.5)
            s.rect(14, 16 + i * 14, 92 * p * k, 9, 2, fill=t["accent"] if i == 0 else t["lo"])
        return s.svg(120, 70, "")

    def travel(x):
        s = Svg(t)
        s.pipe([(110, 50), (110, 22), (10, 22)])
        s.rect(x, 13, 28, 18, 3, fill=t["accentSoft"], stroke=t["accent"], sw=1)
        return s.svg(120, 70, "")

    motion = (strip("1 \u00b7 Tape advances (A1)", [tape(0), tape(1), tape(2)],
                    "Each step the tape shifts left one cell and the new token lands in the empty slot. 600 ms, eased.")
              + strip("2 \u00b7 Odds rise (A4)", [bars(.15), bars(.6), bars(1)],
                      "Bars grow from zero to their probability after the model runs. The winning bar is the accent.")
              + strip("3 \u00b7 Token returns (pipe)", [travel(86), travel(50), travel(14)],
                      "The picked token rides the pipe back to the tape, closing the loop. Then step 1 repeats."))

    rules = "".join(
        f'<div style="display:flex;gap:12px;padding:12px 0;border-top:1px solid {t["faint"]}">'
        f'<span style="flex:none;width:22px;font:600 12px/1.5 {MONO};color:{t["muted"]}">{i + 1:02d}</span>'
        f'<span style="font:400 14px/1.5 {SANS};color:{t["text"]}">{r}</span></div>'
        for i, r in enumerate([
            "At most 3 levels: up to 2 prerequisites, then the main concept, which is the document title. Only the current level is shown; the main concept is always named.",
            "Each level opens with one question. Yes moves on; No shows its illustration.",
            "At most 3 moving parts per figure, and they are the only colour.",
            "Every part that needs explaining is clickable and tagged; simple parts are not.",
            "Names live on engraved plates on the part, never as floating labels or leader lines.",
            "Every explainer lists its sources: links, PDFs, docs.",
            "Motion is eased and loops slowly when idle; it stops on hover and with reduced motion.",
        ]))

    return (f'<div style="width:1440px;height:900px;background:{t["page"]};font-family:{SANS};padding:48px 56px;'
            f'box-sizing:border-box;display:flex;flex-direction:column;gap:30px">'
            f'<div><div style="font:500 11px/1 {MONO};letter-spacing:.12em;text-transform:uppercase;color:{t["muted"]}">ADE illustration language</div>'
            f'<div style="font:650 28px/1.2 {SANS};color:{t["strong"]};margin-top:10px">Marks, motion and rules</div></div>'
            f'<div style="display:flex;gap:48px;flex:1">{col("Marks", marks)}{col("Motion in Fig 1 (L1)", motion)}'
            f'{col("Rules", rules)}</div></div>')


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    L, D = THEMES["light"], THEMES["dark"]
    boards = [("1 Level check (question)", ab_check(L)),
              ("2 Level 1 revealed (answered No)", ab_l1(L)),
              ("3 Main concept, part C2 open", ab_main(L)),
              ("4 Marks, motion and rules", ab_legend(L)),
              ("5 Main concept, dark theme", ab_main(D)),
              ("6 Level check, centred (pin 7)", ab_check_centred(L)),
              ("7 Yes: next page slides in from the right (pin 7)", ab_yes_slide(L)),
              ("8 No: figure opens full screen (pin 7)", ab_no_full(L))]
    for i, (title, html) in enumerate(boards):
        json.dump({"title": title, "html": html}, open(os.path.join(out, f"ab{i + 1}.json"), "w"))
        open(os.path.join(out, f"ab{i + 1}.html"), "w").write(
            f'<!doctype html><meta charset="utf-8"><body style="margin:0">{html}</body>')
    print("ok", len(boards))
