# Phase 51b — Wilderland on the table

Depends on: phase 51
Blocks: phase 52 (its phone half; its engine half needs only phase 51)

Plan: [docs/plans/ered-mithrin.md](../plans/ered-mithrin.md), "Phase 51b: Wilderland on the table" and "Notes for the orchestrator". Analogue: [phase 39b](done/phase-39b-ships-on-the-table.md).

## Goal

The table holds the Wilderland family's pieces on every screen down to 667 × 375 with two seats, within the phase 39b limits (`docs/phases/done/phase-39b-ships-on-the-table.md`, Crowding: squeeze, then fold; The second pile slot). It reuses 39b's second pile slot and `row-fold.ts` and adds no zone box, no felt, and no control that types a number. It gives the table:

- the Caves deck pile beside the encounter pair (`emce.caves-deck`);
- the Evil Creatures deck and its discard pile (`emce.evil-creatures-deck`);
- a guarded treasure's attached state and its claim (`emce.treasure`, `emce.guarded-x`);
- the Discover look strip (`emce.discover`).

The pieces that only one scenario uses are designed in "Scenario areas" and built by their scenario phase. No scenario is playable yet.

The design extends `docs/design-system-table.md` (Canvas, Spacing and the play area's rows, Cards, Piles, Peeking at the other seat, Reading panels, Spotlight, Gestures).

## Design

Not built.

The implementer fills this section, one subsection per element above, in the form of phase 39b's Design: place, room, labels as heard, motion, what a tap or long press does, and which pure module decides it. It states how each piece squeezes and folds with 39b's crowding rule, and where a scenario declares the slot (`widgets.secondPiles`, read from the scenario's definition, as the other widgets are).

## Scenario areas

What the design must cover, and what is left to the scenario phases. When a scenario phase builds an area, it moves the paragraph into `docs/design-system-table.md` and deletes it here.

| Phase | Element | Shared (51b) | The scenario phase adds |
| --- | --- | --- | --- |
| 52 | Evil Creatures deck and discard | the second slot with a deck and its own discard pile | its cards' words |
| 54 | Caves deck | the Caves deck pile | its cards' words |
| 57 | Side-quest area (scenario 6) | the second slot's room rule | the side-quest deck, the current side quest and the placement of defeated side quests (`emce.side-quests`), built in phase 57 from this design |
| 58 | Discover look strip | the strip | its cards' words |
| 59 | Gundabad quest deck (scenario 8) | the quest scale and the fold stack | the shuffled stage-2 deck, the faceup 2A, flipping to B and bypassing (`emce.gundabad-quest-deck`, `emce.bypassing`), built in phase 59 from this design |

The design records, for the side-quest area and the Gundabad quest deck, where they stand, what they share with the Caves deck pile and the second slot, and what must stay clear. It does not build them. Every other element of the table is built here.

## Cards it must hold

Codes come from `data/scenarios/*.json` and `data/cards` after phase 49.

| Element | Cards |
| --- | --- |
| Evil Creatures deck | the Wilderlands enemies of scenario 1 (`evilCreaturesDeck` in its scenario file) |
| Caves deck | Lost Caves (`cavesDeck`), scenarios 3, 4 and 8 |
| Guarded treasure | the nine EMCE treasures (12166-12204, those with type treasure) attached as guarded objectives |
| Discover and Loot | the Ghost of Framsburg's Loot and Hazard cards |
| Scenario areas | the eight side quests (`sideQuestDeck`), the seven Exploring Gundabad stage 2s |

## Build

Not built. The implementer lists the pure modules (Node-tested), the selectors (`PileId` gains the Evil Creatures and Caves piles; `PILE_WORDS` and the pile list follow), the drawing and the web list's words, as phase 39b's Build does. State comes from the Wilderland family (phase 51); a test state is built as `seat-fixture.ts` builds one.

## Tests

Not built. At least: no two zones or piles overlap and every slot keeps a 44 pt hit or is folded, at the screens phase 39b's `sea-layout.test.ts` covers; a Fellowship, Mirkwood and Dream-chaser table unchanged; no sheet offers a number entry.

## E2E

None until a scenario deals the pieces; the flows for the phone checks go in the scenario phases (52 and 54 deal them first).

## Exit

- `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm data:check` pass. Every other campaign's golden, layout test and flow passes without edits to its expectations.
- `docs/design-system-table.md` describes what this phase built, rewritten in place.
- In the same change, `docs/brief.md` (Table screen) names the Caves deck pile, the Evil Creatures deck and discard pile, the guarded treasure and the Discover look strip, each with the span that creates it.
- The Scenario areas section stays here for the phases that build the side-quest area (57) and the Gundabad quest deck (59).
- `STATUS.md` lists the phone checks as open in a cloud session.
- `/ux` once, and one review round (`.cursor/agents/orchestrator.md`, "One review round").
