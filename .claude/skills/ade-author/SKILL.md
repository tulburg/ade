---
name: ade-author
description: Write an ADE document (.ade.json) that explains one hard concept with up to two prerequisite levels, full-definition terms, sourced references and flat 2D figures. Use when the user asks to make, write, author or generate an ADE document or explainer for a topic, or to turn a concept into an ADE.
---

# Authoring an ADE document

An ADE document takes a reader at any level to full understanding of one concept. It reads like a
dictionary: every hard word on a page is defined, every claim has a source, and each figure shows
how the thing works. The output is one `.ade.json` file that passes the validator and opens in the
reader.

Read these first, every time:
- `schema/ade.schema.json`: the format (D-4). The validator adds the rules listed under "Hard limits".
- `test/fixtures/ai-coding-agent.ade.json`: a complete document to copy the shape from.
- `src/kit/render.ts`: the figure kit. Its part kinds and their `props` are listed in `reference/kinds.md`.

## The golden rule (D-10)

**No overlapping information.** Each page must hold information that neither the previous nor the
next page holds. If a page's content is already on another page, the page should not exist: cut it,
merge it, or drop the level. This applies to paragraphs, term definitions, part explainers and
figures. A later page builds on an earlier one by naming it ("explained in L1") through a term or a
cross-level tag (`L1 A2`), never by repeating it.

## Hard limits (the validator enforces these)

- At most 2 prerequisite levels (`L1`, `L2`, in reading order) plus the main concept.
- Cover question: `Do you fully understand <X>?`
- Every `{term}` in a paragraph has a definition with at least one source; every `[n]` points at a source.
- Clickable parts have a tag (`A1`; one letter per level), a caption of **5 to 8 words**, and an explainer.
- Connection notes: at most 5 words.
- At most 3 moving parts per figure, ordered 1 to 3.
- Parts stay inside the figure (1000 units wide).
- Golden rule (S-13): a term is defined on one page only (later pages may mark it and the reader shows the earlier definition); no sentence of 6+ words appears on two pages; no two pages share the same figure.

## Steps

1. **Plan the levels.** Ask what a newcomer must already understand to follow the concept. Pick the
   0 to 2 prerequisites that unlock it, in order (L1 is the most basic). Write each cover question.
   Show the plan to the user and get it confirmed before writing.
2. **Golden-rule pass on the plan.** For each level, list the facts only it will teach. If two levels
   share facts, or a level teaches nothing the main concept does not, merge or drop it.
3. **Write each paragraph** (about 5 lines, 600 to 850 characters). Plain words, short sentences,
   no em dashes. The main concept's paragraph assumes the prerequisites and names them instead of
   re-explaining.
4. **Mark every hard term** with `{}` and write its definition in `terms`: what it means in plain
   words, an example when it helps, and the figure part it maps to (`part`). A term a newcomer might
   not know is a hard term. Do not define the same term on two pages (golden rule); a later page
   points at the earlier page's figure part instead (`"part": "L1 A1"`).
5. **Design each figure** from the kit's vocabulary (`reference/kinds.md`), on the 1000-unit grid:
   - one part per thing the paragraph talks about; tag the ones that need explaining;
   - connections for every flow between parts, with a note of at most 5 words;
   - pick at most 3 moving parts that show the mechanism over time, in the order it happens;
   - follow the approved S-2 look: flat 2D, front view, monochrome, red only for moving parts.
6. **Draw the figures in Spill for approval** before writing them into the document: render them with
   `node --experimental-strip-types bin/kit-preview.ts <file>` and put them on the document's spec
   with the `spill_design_*` tools. Wait for the user's sign-off.
7. **Attach sources.** Every term, explainer and `[n]` reference gets a real, reputable source
   (official docs, papers, textbooks, university or government pages). Never invent a URL. If a claim
   cannot be sourced, rewrite or remove it, and tell the user which claims you dropped.
8. **Validate and fix:** `npm run validate -- <file>` until it prints `valid`.
9. **Check links:** `npm run check-links -- <file>` until every link resolves.
10. **Golden-rule pass on the finished document.** Read the pages side by side; cut any sentence,
    definition or figure part that repeats another page.
11. **Export and look:** `npm run export -- <file>`, open `dist/<name>.html`, and walk every level.

Hand over the `.ade.json` path, the exported HTML path, and anything you could not source.
