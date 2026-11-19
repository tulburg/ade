// The S-2 palettes as CSS variables. Red (accent) marks moving parts only; blue (link) marks
// clickable parts and links only.
export const THEMES = {
  light: {
    page: "#f2f2ef", card: "#fbfbfa", face: "#ffffff", shade: "#ededea", shade0: "#dcdcd9",
    text: "#57575a", strong: "#18181a", muted: "#6b6b70", hi: "#26262a", mid: "#8a8a8f",
    lo: "#b4b4b8", faint: "#d4d4d6", lit: "#000000", accent: "#e5484d", accentSoft: "#fbe3e3",
    link: "#3a5ccf", linkSoft: "#e6edfe", ok: "#30a46c", btn: "#18181a", btnText: "#ffffff",
  },
  dark: {
    page: "#0b0b0b", card: "#131313", face: "#1b1b1b", shade: "#151515", shade0: "#0a0a0a",
    text: "#a3a3a3", strong: "#e6e6e6", muted: "#8a8a8a", hi: "#d4d4d4", mid: "#6a6a6a",
    lo: "#3e3e3e", faint: "#2a2a2a", lit: "#ffffff", accent: "#ff6b6b", accentSoft: "#3a1c1c",
    link: "#6b9bff", linkSoft: "#1a2340", ok: "#6be0a0", btn: "#e6e6e6", btnText: "#0b0b0b",
  },
} as const;

export type ThemeName = keyof typeof THEMES;

export function themeCss(name: ThemeName): string {
  return Object.entries(THEMES[name]).map(([k, v]) => `--ade-${k}:${v};`).join("");
}

/** Light by default, dark when the system asks for it, and either one when the reader picks it (data-theme on <html>). */
export function themesCss(): string {
  return `:root{${themeCss("light")}}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme=light]){${themeCss("dark")}}}` +
    `:root[data-theme=dark]{${themeCss("dark")}}:root{color-scheme:light dark}`;
}

export function currentTheme(): ThemeName {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
