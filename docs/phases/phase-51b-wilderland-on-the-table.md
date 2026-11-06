# Phase 51b — Wilderland on the table

Depends on: phase 51
Blocks: phase 52 (its phone half; its engine half needs only phase 51)

Plan: [docs/plans/done/ered-mithrin.md](../plans/done/ered-mithrin.md), "Phase 51b: Wilderland on the table" and "Notes for the orchestrator". Analogue: [phase 39b](done/phase-39b-ships-on-the-table.md).

## Goal

The table holds the Wilderland family's pieces on every screen down to 667 × 375 with two seats, within the phase 39b limits (`docs/phases/done/phase-39b-ships-on-the-table.md`, Crowding: squeeze, then fold; The second pile slot). It reuses 39b's second pile slot and `row-fold.ts` and adds no zone box, no felt, and no control that types a number. It gives the table:

- the Caves deck pile beside the encounter pair (`emce.caves-deck`);
- the Evil Creatures deck and its discard pile (`emce.evil-creatures-deck`);
- a guarded treasure's attached state (`emce.treasure`, `emce.guarded-x`);
- the Discover look strip (`emce.discover`).

The pieces that only one scenario uses are designed in "Scenario areas" and built by their scenario phase. No scenario is playable yet.

The design extends `docs/design-system-table.md` (Canvas, Spacing and the play area's rows, Cards, Piles, Peeking at the other seat, Reading panels, Spotlight, Gestures).

## Design

The rules are `emce.caves-deck`, `emce.evil-creatures-deck`, `emce.treasure`, `emce.guarded-x` and `emce.discover`. The visible result is in `docs/design-system-table.md` (Piles, Cards, Motion); this section says only how each element uses 39b's pieces.

- **The Evil Creatures deck and discard pile.** The second slot's two places, as the Corsair pair stands: under the encounter pair at the right end of the engagement area, as wide as the pair. The slot is declared by the game having dealt the deck (`secondPilesOf` in `store/pile-ids.ts` reads `piles.evilCreaturesDeck`), so every other table is unchanged. Squeeze and fold are 39b's (`row-fold.ts`); the slot takes the same width the Corsair pair does, so the engagement row holds what it holds there. Labels: "Evil Creatures deck, 5 cards", "Evil Creatures discard pile, 2 cards". Only the discard pile opens its list. Motion: a revealed enemy comes off the deck, one that leaves play glides to the discard pile, a reshuffle glides the discard pile to the deck (`motion.ts`). The pure modules: `store/pile-ids.ts`, `layout/layout.ts`.
- **The Caves deck.** The slot's left place alone, with no outline in the right place. Its cards are discarded to the encounter discard pile, so it has no pile of its own to show; it opens nothing and says nothing of its cards. Label: "Caves deck, 6 cards".
- **A guarded treasure.** Already a guarded pair in staging (`guard` on the attached encounter card); the preview and the screen reader say who guards it, or that it is free of encounters (`cards/dungeon-preview.ts`, `treasureSpeech`). No record offers the claim yet, so the line says only "Free of encounters". No new control.
- **The Discover look strip.** The engine states the keyword's result as a step (`discover`), since it resolves in one step with nothing to answer. The banner tells it in beats (`words/wilderland.ts`), and the last beat lays the cards that went to the discard pile in the Sailing test's strip (`look-strip.ts`), by ids the beat carries (`look:` prefix), without medallions, under the veil, in the engagement and play bands, as the banner's last line; the Loot objective and the Hazard are ringed above the veil where they stand. A Discover that asks which of several Loot objectives to attach is the choice tray's ordinary pick.
- **Where a scenario declares the slot.** From the game's state, as the Corsair pair is: `secondPilesOf` reads `corsairDeck`, `uncharted` and `piles`. A game deals one family of second-slot piles.
- **Spiders and Orcs decks** (Lost in Mirkwood) are not shown; phase 53 designs them from this slot.

## Scenario areas

What the design must cover, and what is left to the scenario phases. When a scenario phase builds an area, it moves the paragraph into `docs/design-system-table.md` and deletes it here.

| Phase | Element | Shared (51b) | The scenario phase adds |
| --- | --- | --- | --- |
| 52 | Evil Creatures deck and discard | the second slot with a deck and its own discard pile | its cards' words |
| 54 | Caves deck | the Caves deck pile | its cards' words |
| 57 | Side-quest area (scenario 6) | the second slot's room rule | the side-quest deck, the current side quest and the placement of defeated side quests (`emce.side-quests`), built in phase 57 from this design |
| 58 | Discover look strip | the strip | its cards' words |
| 59 | Gundabad quest deck (scenario 8) | the quest scale and the fold stack | the shuffled stage-2 deck, the faceup 2A, flipping to B and bypassing (`emce.gundabad-quest-deck`, `emce.bypassing`), built in phase 59 from this design |

The side-quest area and the Gundabad quest deck stand as follows, so phases 57 and 59 build from the same slot and clear the same space:

- **Side-quest area (57).** Fire in the Night deals the side-quest deck and no other second-slot deck, so the deck is the second slot's left place alone (as the Caves deck is) with "Side quests" under it. The current side quest stays in staging (`emce.side-quests-in-play`), an ordinary staging card: mark it where it stands (a ring or a tag) and name it in the quest readout, rather than giving it the second active-location place. "Side quests" under the deck needs a fit check at 667 × 375 beside the pile's count strip. A defeated side quest goes to the victory display, which is already a pile. What must stay clear: the engagement row's room (the slot is the 39b width) and the quest card at the left column's top.
- **Gundabad quest deck (59).** Mount Gundabad also deals the Caves deck, so the second slot is taken. The stage 2s are not a pile in the slot: the current 2A lies in the quest card's place (sideways, level with staging) and the rest of the deck peeks out behind it, shown as one pile-sized stack at the quest card's right edge with a count strip "+n" and its own word ("Stages"), and no list. Staging narrows by the stack's width, and the staging fold stack at staging's left end stays clear of it. A bypass slides the current stage under that stack and the next 2A in. What must stay clear: the quest scale, the left column's active location, the staging fold stack, and the 44 pt hit of the stack.

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

- **Pure modules** (Node-tested): `src/play/store/pile-ids.ts` (`PileId`, `SecondPileId`, `PILE_WORDS`, `secondPilesOf`, `isDiscardPile`, `opensList`; `selectors.ts` re-exports them), `layout/layout.ts` (the slot's decks and discard piles), `words/wilderland.ts` (Discover's beats, log line and strip ids), `store/outcome.ts` and `store/log.ts` (the `discover` step), `cards/dungeon-preview.ts` (`treasureSpeech`), `motion/motion.ts` (the second slot's decks and the refilled pairs).
- **Engine.** One additive step, `discover` (`rules/core/intents.ts`, pushed by `families/wilderland/discover.ts`): the cards looked at, the Loot objective and the Hazard. No state field, no rule change, no `ENGINE_VERSION` change.
- **Selectors.** `PileId` gains `evilCreaturesDeck`, `evilCreaturesDiscard` and `cavesDeck`; `table-canvas-views.ts` always subscribes to each and returns null while `secondPilesOf` lacks it.
- **Drawing.** `pile-piece.native.tsx` (words "Creatures", "Caves"; the encounter back), `table-canvas.native.tsx` (the strip from the beat, the treasure's spoken line), `table-canvas.tsx` (the web list). The compiler test stays at zero bailouts.
- **Test state** comes from `store/wilderland-fixture.ts`, as `sea-fixture.ts` builds the sea family's.

## Tests

- `layout/wilderland-layout.test.ts`: no two zones or piles overlap and every pile keeps a 44 pt hit, for the Evil Creatures pair, the Caves deck, two seats and a crowded row, at the screens `sea-layout.test.ts` covers; the slot's place and the engagement area narrowed only while it is dealt; a guarded treasure as a pair that folds as one; the look strip's cards.
- `scenarios/wilderland-table.test.ts`: the selectors, the pile words and reader labels, the cards' motion to and from the piles, the treasure's preview and speech, and Discover's beats, log line and strip ids.
- `rules/families/wilderland/discover.test.ts`: the `discover` step.
- The Fellowship, Mirkwood and Dream-chaser tables are covered unchanged by the existing `layout.test.ts`, `sea-layout.test.ts` and goldens. No sheet built here offers a number entry.

## E2E

None until a scenario deals the pieces; the flows for the phone checks go in the scenario phases (52 and 54 deal them first).

## Exit

- `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm data:check` pass. Every other campaign's golden, layout test and flow passes without edits to its expectations.
- `docs/design-system-table.md` describes what this phase built, rewritten in place.
- In the same change, `docs/brief.md` (Table screen) names the Caves deck pile, the Evil Creatures deck and discard pile, the guarded treasure and the Discover look strip, each with the span that creates it.
- The Scenario areas section stays here for the phases that build the side-quest area (57) and the Gundabad quest deck (59).
- `STATUS.md` lists the phone checks as open in a cloud session.
- `/ux` once, and one review round (`.cursor/agents/orchestrator.md`, "One review round").
