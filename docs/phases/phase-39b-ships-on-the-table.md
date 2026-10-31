# Phase 39b — Ships on the table

Depends on: phase 39
Blocks: phase 40 (its phone half; its engine half needs only phase 39)

Plan: [docs/plans/dream-chaser.md](../plans/dream-chaser.md), "Phase 39b - Ships on the table" and "Notes for the orchestrator and the implementer agent". User request, 2026-10-30: "how to handle ships and their cards on the board in the limited board space." The user chose the Heading dial, folding into a "+n" stack, the Corsair piles on the board and the Island Map chip with a panel (2026-10-30).

## Goal

The table holds the sea family's pieces on every screen down to 667 × 375 with two seats: the ship-objectives and their attachments, the Heading, ship-enemies in staging and engaged, the Corsair deck and its discard pile, Boarding, the Sailing test's look, and the combat spotlight between ships. One crowding rule decides what squeezes and what folds when a row runs out of room. The pieces that only one scenario uses (the Stormcaller's area, the Island Map, the Uncharted and Grotto decks, cards under The Havens Burn, Grapple) are designed here and built by their scenario phase. No scenario is playable yet.

The design extends `docs/design-system-table.md` (Canvas, Spacing and the play area's rows, Cards, Piles, Peeking at the other seat, Reading panels, Spotlight, Gestures). It adds no zone box, no felt, and no control that types a number.

## Design

### Ships in the play area

- A ship-objective is an objective ally and a character for all purposes (`dcce.ship-objectives`), so it stands in its controller's play-area row, drawn at the table's card size like any character. No rule ties a hero or an ally to a ship, so no character is grouped under or beside one.
- **Order.** A seat's row is: its player side quest (Cards), then its ships, then its heroes and the rest. The Dream-chaser comes before any other ship. After the last ship the row keeps one extra gap (`SHIP_GAP`, one `GAP`), so the ships read as a group without a box.
- **Two seats.** Each seat's ship stands in that seat's row. The other seat's ship is seen by peeking at that seat (Peeking at the other seat).
- **True solo.** The player takes the Dream-chaser and one other ship (`dcce.prepare-your-fleet`). Both stand first, the Dream-chaser leftmost. A Dol Amroth Warship the players take through The Beacon (12136) joins the ships in the same way.
- **Attachments.** The Modification boon (11172 to 11175) and the Heading card (11084) peek out under their ship as any attachment does (Cards), the most recent lowest. The Heading card is under the Dream-chaser only. Ships are immune to player card effects, so these are the only attachments a ship carries.
- **Stats and damage.** The ship's printed stats are on its picture. A Modification's change is an effect pill down the left edge (Tokens and effects). Damage is the damage token with its count, up to the ship's hit points (18 on the Dream-chaser). The preview lists the attachments, the effects and the ship's lines.
- **Crowded play area.** The existing plan applies (`play-area.ts`): wrap, then shrink to `PLAY_FLOOR`, then overlap. In two stacked rows the ships go to the front row's left end, so their attachments still peek and their damage stays in reach.

### The Heading

The setup attaches the Heading card to the Dream-chaser and sets it on-course (`dcce.prepare-your-fleet`). All players share one heading (`dcce.heading`). The card creates one piece, the Heading dial, and the table adds nothing else for the heading.

- **Steps and icons.** The four steps are Sun (on-course), Cloud, Rain and Storm (off-course, Storm the worst), in the order a counterclockwise quarter turn brings them to the pointer (`dcce.heading`; the 11084 ledger note).
  - The icons and the Sailing success symbol are game icons, built by `scripts/data/icons.ts` from an online source recorded in `data/sources.json` (`dcce.heading` and `dcce.sailing-tests` quote them as glyphs U+F2090 to U+F2094 of the MEC111 font).
  - If no source carries them as vectors, that is a question for the user. Do not draw substitutes.
- **The Heading dial.** It goes in the top bar after the seat dials, while the Heading card is in play (`heading`).
  - It is the Life dial's frame (Top bar): 46 pt, with no number, and "Heading" as its label.
  - The disc holds the current step's icon. The ring is four quarter arcs, lit clockwise from the top: Sun four, Cloud three, Rain two, Storm one.
  - Colour: Sun in the accent, Cloud and Rain in bone, Storm in threat red with the disc filled. The icon's shape and the arcs carry the step without colour.
  - `heading-value` is clear text with the step's word ("Rain"), as `rail-current` is.
  - It is heard as "Heading, Rain, off-course, two steps from on-course". Its hint is "Shows the Heading card".
- **A shift.** The dial pops as the threat dial does (`dialPopRise`, `dialPopSettle`). A badge (`heading-delta`) says the direction of the change for three seconds: "Toward Sun" on an accent wash, or "Toward Storm" on a threat-red wash. It is heard as "Heading shifted off-course, now Rain". A Sailing test that shifts twice pops twice, once per engine step. Reduced motion keeps the dial still and shows the badge.
- **A tap** opens the Heading card's preview, as the Eye opens the Nightmare card. The preview is titled "Heading · Rain (off-course)", lists the four steps with the current one marked, and draws the card turned a quarter turn per step, as the rule turns it. A peek never changes the dial.
- **On the card.** The Heading card peeks under the Dream-chaser (Ships in the play area). The dial is what the player reads at a glance.

### Ship-enemies, staging and combat

- A ship-enemy is an enemy for all purposes (`dcce.ship-enemies`). In staging it shows its engagement cost pill, and its cost puts a tick on the threat dial (Raider Flagship's 50 sits at the ring's end). Engaged, it stands in the engagement area with its shadow cards, as any enemy does.
- **Pickers.** The defender pick for a ship-enemy's attack glows the ships and veils every other character. The veiled card's preview gives the engine's reason: "Only a ship can defend against Corsair Warship" (`dcce.ship-enemies`). Attacking a non-ship enemy veils the ships: "A ship attacks only Ship enemies" (`dcce.ship-objectives`). Raider Flagship (12124) veils every non-ship attacker the same way. The words are the engine's refusal (phase 39); the table adds none of its own.
- **Undefended.** The hit goes to a ship (`dcce.ship-enemies`). With one ship, One answer, one tap names that ship and draws it beside the enemy. With two ships, the pick asks which one.
- **Spotlight.** Nothing new. A ship defending against a ship-enemy, an undefended hit on a ship, and ships with heroes attacking a ship-enemy are clashes like any other (`clash.ts`). The ship stands as the target or in the attackers' fan, with its own defense or attack on the medallion. A destroyed Dream-chaser burns, and the loss banner follows.

### The second pile slot

- **Place.** A scenario that prepares a second deck gets one more slot of piles: the Corsair deck (`dcce.corsair-deck`), the Uncharted deck (`dcce.uncharted-deck`) or the Grotto deck (`dcce.grotto-deck`). The slot sits under the encounter deck and its discard pile, at the right end of the engagement area, and is as wide as the encounter pair.
- **Room.** The engagement area narrows by that width and a gap, and only while the scenario declares the slot (`widgets.secondPiles`, read from the scenario's definition, as the other widgets are). On a phone that costs about one and a half cards of the engagement row.
- **Why there.** Boarding brings Corsair cards straight into the engagement area beside the slot, and the pair lines up under the encounter pair as one column of piles.
- **Corsair deck (built here).** Piles `corsairDeck` and `corsairDiscard`, drawn as Piles says.
  - The deck shows the printed encounter back (the Eye), with "Corsair" under it. Its discard pile shows its top card, with "Discard" under it.
  - They are heard as "Corsair deck, 9 cards" and "Corsair discard pile, 2 cards".
  - Only the discard pile opens a list (`pile-list`, titled "Corsair discard pile").
  - A non-ship enemy that is discarded leaves toward the Corsair discard pile (`cardLeave`). The reshuffle glides the discard pile's cards to the deck (`cardDepart`), and the deck's count pops.
  - Peeking leaves the slot where it is: it is shared, like the encounter piles.
- **One deck alone.** The Uncharted and Grotto decks have no discard pile: their locations shuffle back into the deck. A deck alone takes the slot's left place, and the right place stays empty, with no dashed outline.
- The Island Map's chip takes the same slot (Scenario areas).

### Boarding

When a ship-enemy with Boarding X engages from staging, the engine reveals X Corsair cards engaged with that player (`dcce.boarding`).

- **Motion.** Each card comes off the Corsair deck as Reveal says: the Eye, the turn, the pop. It then moves into the engagement row (`cardArrive`), the cards 90 ms apart (`stagger`).
- **Banner.** The beat names the ship and the count: "Boarding 2 · Corsair Warship: 2 Corsairs engage Player 1" (`sea-words.ts`). The ship's ring follows the banner's current beat.
- No spotlight plays, because a reveal is not an attack. An empty Corsair deck that reshuffles mid-reveal plays the reshuffle first.

### The Sailing test

The test comes at the start of the quest phase, before the commit, and the quest scale is up (`dcce.sailing`, `dcce.sailing-tests`).

1. **Shift off-course.** The engine shifts the heading as the test opens, before the commit. The Heading dial pops and shows its badge, and the commit already reads the shifted step.
2. **Commit to the test.** This is a multi pick on the play area. Picked characters wear the picked mark and exhaust once confirmed. They get no willpower pill, because this is not the quest commit.
   - The primary counts the picks ("Commit 2").
   - The readout gives the engine's count: "Looks at 3 cards · the Dream-chaser counts as 2". With Enlarged Quarters (11174:B) or Sea-ward Tower (12134) the readout names them.
3. **The look strip** (`look-strip.ts`). The looked-at cards come off the encounter deck face up and stand in a strip laid over staging, at the table's card size, 90 ms apart. Staging, the engagement area and the play area under the strip carry the 45% night veil.
   - **Success marks.** A card whose ledger side prints the success symbol (`sailingSuccess`) wears a 22 pt night medallion with that icon in the accent, straddling its foot, upright. It pops in after the card turns (`popRise`, `popSettle`). With two symbols it reads "×2". A card with none wears nothing.
   - **Dock.** The title reads "Sailing test · 2 successes". The readout shows what one tap on Shift on-course does and the symbols still to ask after it: "Rain to Cloud · 1 more symbol". The answer is whatever the family's moment asks: a shift and its alternative while a symbol is left to answer, or Done alone when none is (none found, or the heading is back on Sun), so the strip never goes without its answer.
   - **Room.** One band holds as many cards as its width allows a gap apart, then squeezed to 44 pt steps. Past one band the strip uses the engagement band, then the play band. Past three bands the cards overlap closer than 44 pt; a tap in a look only previews, and nothing is picked.
   - **List.** List on the dock (`sheet-list`) opens the looked-at cards as read-only tray rows (`sheet-look-<id>`). Each row has the success icon and the word "Success" when the card has one, and a tap on it opens the card large. This is also the screen-reader path, and the default while a screen reader is on.
   - **Discard.** On the answer the strip glides to the encounter discard pile (`cardDepart`). A short deck reshuffles first, and the banner says so.
   - Reduced motion shows the strip, the medallions and the discard at once.
4. Actions are open before and after the test, not during it (`dcce.sailing-tests`). The table offers none while the strip is up.

### Crowding: squeeze, then fold

`row-fold.ts` is a pure module, the table's crowding budget as `dock-budget.ts` is the dock's. It lays out staging and the engagement area. Every scenario uses it. A row whose steps stay at 44 pt or more lays out exactly as `rowXs` does today, which a test pins for the Fellowship and Mirkwood tables.

1. **Natural.** Groups stand a gap apart. A group is a card with its stack, a guarded pair, an engaged enemy with its shadows and fighters, or the Stormcaller's area.
2. **Squeeze.** Groups overlap evenly while every step between them is at least a 44 pt target (`touch`). The steps inside a group do not change.
3. **Fold.** When even 44 pt steps do not fit, groups leave the row, one at a time in fold order, into a fold stack at the row's left end, until the rest fits at 44 pt steps beside it.
   - **The fold stack** is pile-sized. It shows the top folded card's face, a count strip "+3" and the word "More". It is heard as "3 more cards in staging" and hit-tested at 44 pt (`hitBounds`).
   - **A tap or a long press** opens the row's list on the reading panels' frame (`row-list`, `row-list-close`, tiles `row-card-<id>`). A tile shows the card large and sends nothing.
   - **Never folded.** A card the open moment asks about, picks, or names in the banner's current beat never folds. A folded card is not on the table (`onTableFor`), so a pick that reaches one opens as the choice tray, as a card out of play does today.
   - **Fold order in staging:** the Stormcaller's area while it is not at the players' stage; then cards the players control (a freed tower); then guarded pairs; then locations; then enemies. Within each, the leftmost goes first.
   - **Fold order in the engagement area:** enemies that are not attacking and not in the open moment, oldest first.
   - The quest scale, the threat dial and the threat panel still count every folded card.
- **Stacks in staging.** A staging card with cards under it (a grappled arm, Black Key on the Raider Flagship) shows one peek with a "×2" count on it when it holds more than one. Staging keeps one peek of depth only while such a card is there, so a staging row with nothing under any card is unchanged.
- **The look strip** is not folded (The Sailing test).

How it plays out:

| Screen (Medium) | Card | Engagement area with the second slot | What happens first |
| --- | --- | --- | --- |
| 667 × 375 | about 49 × 69 | about 5 cards a gap apart, 6 at 44 pt steps | a staging of six or more groups, or Boarding into an engaged row of five, squeezes and then folds |
| 844 × 390, insets 47 | about 52 × 73 | about 5, then 7 | as above, one card later |
| 1024 × 768 and larger | 92 and up | 4 a gap apart, 8 or more at 44 pt steps | squeeze only, in practice |

At Large every row holds about one card fewer, and at Small about one more. The numbers belong to the code: the tests pin them, and this table only shows the order things happen in.

### The rule that no control types a number

Every sea moment is either a pick and a confirm, or an engine step that the table only draws. The fleet choice is the seat picker's (phase 39). Attaching a Modification, "deal 2 damage to a ship for 1 resource", the Sailing commit, a defender, an attacker, which ship takes an undefended hit, a travel on the Island Map, and freeing a tower are all picks. Heading shifts, success shifts, Boarding, the Corsair reshuffle, Aflame damage, cards placed under The Havens Burn, the Stormcaller's progress and Grapple are all engine steps. The Heading dial has no stepper: a tap previews the card. No sheet built here offers a number entry, and a test checks that.

### Scenario areas

Each paragraph below is built by its scenario phase, from the shared pieces above. When the scenario phase builds it, it moves the paragraph into `docs/design-system-table.md` and deletes it here.

| Phase | Element | Shared (39b) | The scenario phase adds |
| --- | --- | --- | --- |
| 40 | Ships, Heading, Corsair deck, Boarding, Sailing | everything above | the setup picks: Modification per ship, "deal 2 damage to a ship for 1 resource"; its cards' words |
| 41 | Uncharted deck | the second slot, one deck alone | `unchartedDeck` pile showing the Lost Island face (every copy is the same, `dcce.uncharted-deck`); the flip when Lost Island becomes active; a look at the facedown side, shown in the preview to that look only; the shuffle back into the deck |
| 42 | Cards under The Havens Burn; Aflame | damage tokens on locations; `under` cards are not drawn | the under-count pill: a night pill at the host's foot, as the engagement cost pill, "2 under · lose at 5", threat red when one more card loses (11038); the Aflame value and damage in the preview |
| 43 | The Stormcaller's area | fold order; the 30% night veil | see below |
| 44 | Grapple | staging stacks: one peek with a count | the facedown arms under their location, the location's threat pill (+2 per arm, from the engine), "Grappled: 2 facedown enemies" in the preview, the detach flip into staging |
| 45 | Island Map | the second slot; reading panels | see below |
| 46 | Grotto deck | the second slot, one deck alone | `grottoDeck` showing its top card's Grotto face, since players may look at it (`dcce.grotto-deck`); a long press previews that face only; explored Grotto locations glide back to the deck, and Underwater ones go to the victory display |
| 47 | Raider Flagship, four towers, Dol Amroth Warships | ship-enemies; Guarded pairs (Cards); fold order; ships first | the towers' words; freed towers as cards the players control in staging, whose Actions reach the action window's tray when folded; Send for Help set aside and not drawn |
| 48 | From Sea to Land | the second slot | when the Corsair pair merges into the second encounter deck, the slot closes and the engagement area takes the room back (the cards slide); the inactive deck is not drawn until it becomes the encounter pair, in place |

**The Stormcaller's area (phase 43,** `dcce.stormcallers-area`, `dcce.stormcallers-area-stages`).

- **Place.** The area is the first group of the staging row, right beside the players' quest card. It holds the Stormcaller's current stage (2C to 4C), drawn sideways at a staging card's sideways footprint with its progress / quest points strip. The area's cards (the Stormcaller first, then Sahír's Escort, Vast Coastland) stand over the stage's right part, stepped as a guarded pair (`PAIR_STEP`).
- **Not at the players' stage.** The area's cards carry the night veil at 30%. Their previews say "In the Stormcaller's area: not in the staging area, immune to player card effects". The area is the first group to fold, as one fold stack titled "Stormcaller's area".
- **At the players' stage.** The veil lifts and the cards count as staging, in place, so nothing jumps. The stage's preview says "Same stage as the Stormcaller".
- The Stormcaller's progress pops the strip as the quest card's does. Its stage advance uses the Quest advance pieces.

**The Island Map (phase 45,** `dcce.island-map`, `dcce.exploration`).

- **Staging.** The locations next to the active location are in the staging area, so the staging row draws them as staging cards, beside the enemies. The active location is drawn in the active-location slot, even though it stays in its map position.
- **The chip.** It takes the second slot, at the engagement row's height: a 5 × 3 grid of small portrait cells (`island-map-chip`), with the Temple column at the right as printed.
  - Each cell shows its state: facedown Lost Island (faint), turned face up (bone), next to the active one (bone ring), active (accent fill with the resource token art as the marker).
  - The chip is one 44 pt-plus target, heard as "Island Map, active: row 2, column 3, 3 locations in staging". A tap opens the map panel.
- **The map panel** (`island-map`, `island-map-close`, cells `island-map-cell-<row>-<col>`).
  - It is a parchment reading panel as wide as five cards across need, up to the table's card size. It is at least 300 pt, no wider than the screen less its insets and 16 pt, and its three rows fit under the top bar.
  - It shows the cards as laid out, the marker, and the secrets under the Temple locations as facedown peeks.
  - A cell's tap previews its card. Travel is picked on the staging row, and the panel sends nothing.
- Directions in card text read from the map as printed ("to the right" is toward the Temple column).

## Cards it must hold

| Element | Cards (codes after the DCCE rule) |
| --- | --- |
| Ship-objectives | 11080 to 11083; 110136 to 110141 (Duskbringer 110138, Glórinaith 110139); Dol Amroth Warship 12123 / 110102 |
| Heading and Modifications | 11084; 11172 to 11175, both sides |
| Ship-enemies | 11022, 11057, 11058, 11177, 12019 / 110042, 12020 to 12022, 12124 to 12127, 12152 |
| Corsair deck | each scenario's non-ship enemies (`corsairDeck` in `data/scenarios/*.json`), Boarding Party 11059, Crowley 11178 |
| Sailing successes | every ledger side with `sailingSuccess` above 0 |
| Scenario areas | The Havens Burn 11038, Dream-chaser location 11039; Stormcaller stages 12016 to 12018; Eye of the Beast and the arms 12050 to 12054; the 15 Island Map locations (`islandMap` in `data/scenarios/temple-of-the-deceived.json`), Temple Guardian 12070 with Gate Key 12071; Grotto locations 12094 to 12104; towers 12134 to 12137 |

## Build

- **Pure modules** (Node-tested): `row-fold.ts`, `look-strip.ts`, `heading.ts` (step to icon, word, arcs, colour token, label, badge and preview turn), `sea-words.ts`. Layout changes go in `layout.ts`, `play-area.ts` (ships first, `SHIP_GAP`, ships in the front row when stacked) and `top-bar-layout.ts`.
- **Selectors.** `PileId` gains `corsairDeck` and `corsairDiscard`; the scenario phases add `unchartedDeck` and `grottoDeck`. `PILE_WORDS` and the pile list follow.
- **Drawing.** The Heading dial in `table-chrome.tsx` and `table-top-bar.tsx`. The medallion, the fold stack and the second slot on the Skia canvas. The web list (`table-canvas.tsx`) names each new piece in words: "Heading: Rain (off-course)", "Ships: Dream-chaser, 3 damage", "Corsair deck 9 · Corsair discard pile 2". The web list does not fold.
- **State** comes from the sea family (phase 39). A test state is built as `seat-fixture.ts` builds one (`sea-fixture.ts`).

## Tests

Node tests the implementer writes:

- `src/play/row-fold.test.ts`: the three tiers. Every step is at least 44 pt at Small, Medium and Large. The fold order in staging and in the engagement area. A card the moment asks about never folds. With no fold the result equals `rowXs`.
- `src/play/layout.test.ts`:
  - the second slot under the encounter pair, and the engagement area narrowed only when it is declared;
  - ships first in the row, after a side quest, the Dream-chaser leftmost, `SHIP_GAP` after them, two ships in solo;
  - ships in the front row when the play area stacks;
  - one staging peek with a count;
  - a Fellowship and a Mirkwood table unchanged.
- `src/play/sea-layout.test.ts`, at 667 × 375 (insets 0) and 844 × 390 (insets 47) at Small, Medium and Large, and at 1024 × 768 and 1366 × 1024 at Medium and Large, for a solo table with two ships and a two-seat table:
  - no two zones or piles overlap;
  - every slot keeps a 44 pt hit or is folded;
  - the fold stack and every pile hit at 44 pt.
- `src/play/look-strip.test.ts`: the bands and steps for 1 to 12 cards at each screen above, with and without the quest scale; the success marks from the ledger.
- `src/play/heading.test.ts`: every step's icon, word, arcs, colour, spoken label, badge and preview turn.
- `src/play/top-bar-layout.test.ts`: two seats and the Heading dial at 667 × 375 keep the rail centred; at Large the dials scroll and none is cut.
- `src/play/scale-budgets.test.ts`: `row-fold` and `look-strip` are proportional at Large.
- `src/play/clash.test.ts`: a ship defends against a ship-enemy; an undefended ship-enemy attack hits a ship; ships and heroes attack a ship-enemy together.
- `src/play/table-choice.test.ts`:
  - a pick on a folded card opens the tray;
  - the ship-enemy defender pick veils non-ships with the engine's reason;
  - Raider Flagship's attacker pick;
  - the Sailing commit readout counts the Dream-chaser as 2, from the engine;
  - every sea sheet's options are cards or answers, never a number.
- `src/play/selectors.test.ts`: the Corsair pile views; a peek keeps the second slot and the Heading dial.
- `src/play/sea-words.test.ts`: the Boarding beat, the Sailing titles and readouts, the pile words.

## E2E

Two flows, which need fixtures. A fixture is a real dealt game, so the fixtures need a sea scenario that deals.

- **`.maestro/sea-table.yaml`**, fixture `sea-solo`: Voyage Across Belegaer, true solo, two ships, parked on the first Sailing test's commit.
  1. Assert `heading` and `heading-value` "Cloud" (the test has shifted it off-course).
  2. Commit the Dream-chaser through `sheet-list` and its `sheet-option-<id>`, then confirm.
  3. Assert the look's `sheet-look-*` rows and `readout-result`.
  4. Answer the moment, then assert `heading-value` and `heading-delta`.
- **`.maestro/sea-duo.yaml`**, fixture `sea-duo`: two seats.
  1. Peek at the seat without the Dream-chaser (`threat-1`) and assert that `heading` is still shown.
  2. Tap `heading`, assert `card-preview`, and close it.

If Voyage does not deal before phase 40, both fixtures (`scripts/e2e-fixtures.ts`) and their runs move to phase 40's phone half, and `STATUS.md` says so. In a cloud session the runs stay open.

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass. Every Fellowship and Mirkwood golden, layout test and flow passes without edits to its expectations.
- `docs/design-system-table.md` describes what this phase built, rewritten in place:
  - Top bar: the Heading dial.
  - Canvas and Piles: the second pile slot, the Corsair pair, the fold stack.
  - Spacing and the play area's rows: ships first; Squeeze, then fold; staging stacks.
  - Cards: ship pickers and the success medallion.
  - Motion: Boarding, the look strip.
  - Peeking at the other seat: the shared pieces stay.
  - Reading panels: the row list.
- In the same change, `docs/brief.md` (Table screen) names the Heading dial, the Corsair deck and its discard pile, and the fold stack, each with the span that creates it.
- The Scenario areas section stays here for phases 41 to 48.
- STATUS.md lists these phone checks as open:
  - the Heading dial and its badge at 667 × 375 with two seats;
  - a Sailing test's strip and medallions in the quest phase;
  - Boarding into a full engagement row;
  - a fold stack and its list;
  - the Corsair piles' labels at Large;
  - the two flows.

One review round (`.cursor/agents/orchestrator.md`, "One review round").
