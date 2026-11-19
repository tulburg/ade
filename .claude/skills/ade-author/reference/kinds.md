# Figure kit: part kinds

Every part has `id`, `kind`, `x`, `y`, `w`, `h` on the 1000-unit grid, and optional `props`. A part
with a `tag` is clickable and needs `caption` and `explainer`; `corner` (`tl` default, or `tr`) says
where its tag sits. Parts under 60 x 40 get their tag just above the corner.

Props every kind accepts:
- `badgeAt: [x, y]`: where the red motion marker sits (default: the part's top-right corner).
- `captionBelow: true`: put the caption under the part instead of beside the tag.

| kind | draws | props |
|---|---|---|
| `panel` | a plain body | `plate`: engraved label |
| `tape` | a row of token chips; `""` is the empty slot for the next one (dashed red) | `tokens: string[]` |
| `layers` | a stack of model layers with faint attention links | `rows` (7), `seed`, `plate` |
| `callout` | only a tag and caption over another part (use a small part) | none |
| `bars` | horizontal bars with values 0 to 1; the first is highlighted | `items: [label, value][]`, `plate` |
| `dial` | a knob with a scale | `label`, `value` (0 to 2) |
| `chip` | a small red packet of text: a token, a call, a result | `text` |
| `terminal` | a terminal window with typed lines | `lines: string[]` |
| `list` | a column of labelled slots | `items`, `lit` (index drawn red), `empty` (dashed slots after), `plate` |
| `list` + `selected` | a tool rack: wide rows with switches, the selected row pushed out | `items`, `selected` |
| `ring` | a circle of known distance around a reference point (fills the part's square) | `label`, `dashed`, `center` (centre dot), `lit` (red), `fill` (solid marker), `sphere` (dashed equator) |
| `ruler` | a measuring scale; the measured span drawn red from the left | `marks: [label, 0..1][]`, `lit` (0..1), `plate` |
| `satellite` | a satellite body with two solar wings | `label` |
| `files` | a grid of file icons and an optional test lamp | `files`, `lit`, `tests` (lamp label), `plate` |

How each kind moves (when it has `motion`): `tape` pulses its empty slot, `bars` fills the top bar,
`chip` travels along the connection it sits on, `list` slides its `lit` slot in, `files` turns the
lamp from red to green; any other kind pulses.

Connections: `from`, `to` (part ids), `points` (the path, start to end), `flow: true` for a moving
red path, `note` (at most 5 words) and `noteAt: [x, y]` (start of the note text).

A new kind is added to `src/kit/render.ts` (and this table) when a figure needs something the
vocabulary cannot draw.
