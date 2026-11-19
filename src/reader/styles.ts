// Reader styles. Colours come from the --ade-* theme variables (src/kit/theme.ts).
const SANS = "-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

export const READER_CSS = `
html,body{margin:0;height:100%;overflow:hidden}
.ade-root{position:fixed;inset:0;background:var(--ade-page);color:var(--ade-text);font-family:${SANS}}
.ade-stage{position:absolute;inset:0;overflow:hidden}
.ade-page{position:absolute;inset:0;display:flex;flex-direction:column;box-sizing:border-box;padding:28px 72px 64px;background:var(--ade-page)}
.ade-btn{font:600 14px/1 ${SANS};padding:11px 18px;border-radius:9px;border:0;cursor:pointer;background:var(--ade-face);color:var(--ade-strong);box-shadow:inset 0 0 0 1px var(--ade-mid)}
.ade-btn:focus-visible,.ade-clickable:focus-visible{outline:2px solid var(--ade-link);outline-offset:3px}
.ade-primary{background:var(--ade-btn);color:var(--ade-btnText);box-shadow:none}
.ade-eyebrow{font:500 11px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:var(--ade-muted)}

/* cover */
.ade-cover{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center;padding:0 88px}
.ade-cover .ade-eyebrow{font-size:13px}
.ade-question{margin:0;font:600 40px/1.25 ${SANS};letter-spacing:-.015em;color:var(--ade-strong);max-width:920px}
.ade-answers{display:flex;gap:14px;margin-top:6px}
.ade-answers .ade-btn{font-size:18px;padding:16px 44px;border-radius:12px}
.ade-hints{display:flex;gap:28px;font:400 13px/1.4 ${SANS};color:var(--ade-muted)}

/* revealed level and main concept */
.ade-head{flex:none}
.ade-title{margin:0;font:650 28px/1.15 ${SANS};letter-spacing:-.01em;color:var(--ade-strong)}
.ade-para{margin:10px 0 0;font:400 16px/1.6 ${SANS};color:var(--ade-text);text-align:justify;hyphens:auto}
.ade-figure-box{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;margin-top:16px;position:relative}
.ade-figure-wrap{position:relative}
.ade-figure-wrap svg{width:100%!important;height:100%!important}
.ade-nav{position:absolute;right:72px;bottom:12px;display:flex;gap:10px}
.ade-indicator{position:absolute;left:72px;bottom:6px;height:40px;display:flex;align-items:center;gap:12px}
.ade-indicator .ade-eyebrow{font-size:10px}
.ade-concept{font:600 14px/1 ${SANS};color:var(--ade-strong)}
.ade-where{font:400 12px/1 ${SANS};color:var(--ade-muted)}
.ade-theme{all:unset;cursor:pointer;margin-left:10px;font:500 12px/1 ${SANS};color:var(--ade-muted);text-decoration:underline;text-underline-offset:3px}
.ade-theme:focus-visible{outline:2px solid var(--ade-link);outline-offset:3px}

/* figure parts */
.ade-outline{display:none}
.ade-clickable{cursor:pointer;outline:none}
.ade-clickable:hover .ade-outline,.ade-clickable:focus-visible .ade-outline,.ade-open .ade-outline{display:inline}
`;
