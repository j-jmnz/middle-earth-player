# Handover: the table's layout redesign

User request (2026-10-29), verbatim: "Create a handover for the table layout redesign, include the next: if there's space
available, create more space between the players hand engaged section and staging, render a better quality of the cards on the
table, increase the grow effect when sliding the players hand carousel, make the players played cards wrap when there are too many
on one row, spacing should be dynamic all around".

Five pieces of work, below in the order to do them: (1) dynamic spacing, which (2) wrapping the play area builds on, then (3) the
card pictures' quality, which (4) the bigger grow needs, and (5) the docs. Base the work on `main` (Carved Stone is merged; the
table already has its quest scale, ring threat dial and phase ticks).

## Read first

- `CLAUDE.md` and `.cursor/rules/authority.mdc` (repo rules). `docs/architecture.md` wins on how the code is split: `src/play`
  must not import `src/screens`.
- `docs/design-system.md`, section "Table — landscape": the zones, the hand, the gestures (the scrub), the motion tokens. Every
  change below must be written back there.
- `docs/architecture.md`, section "Images": decoded pictures are released when their card leaves the table. Keep that.

## Where the table is laid out today

All the geometry is one pure function, `tableLayout` in `src/play/layout.ts` (426 lines; `layout.test.ts` covers it). The canvas
(`src/play/table-canvas.native.tsx`) calls it with the canvas size, the zones' views, the piles and options (`raised`, `deckTop`,
`attacker`, `preview`, `bottomInset`, `scale`), and draws the slots it returns. Drags and taps hit-test the same slots in
worklets (`hitSlot`, `hitDrop`). Card motion (`useCardMotion`) animates any slot that moves between two layouts, so a reflow
animates without extra work.

- **Card size** (`cardSize`): the largest card that fits three rows plus the hand's strip in the height, and 7.5 cards
  (six plus the 1.5-card left column) in the width, capped at `CARD_MAX` 96 pt and floored at `CARD_MIN` 34 pt (Medium's sizes,
  times the UI scale).
- **Fixed spacing:** `GUTTER` 8, `GAP` 6, `PEEK` 10, `MARK` 16 (times the UI scale). Nothing grows with the room.
- **Rows** are stacked from the top: staging at `gutter`, the engagement area one `gap` under it (as deep as its deepest stack
  of shadow cards), the play area one `gap` under that (`card.h + 2 * peek`). The hand is anchored to the bottom
  (`handY = height - bottom - max(handMin, card.h * HAND_SHOW)`). So **all spare height collects between the play area and the
  hand**; staging, engaged and play sit tight at the top.
- **Left column:** the quest card (sideways) level with staging, the active location level with the engagement area, the deck
  and discard level with the play area. It follows the rows' y values, so it moves with any spacing change.
- **Rows that do not fit** overlap: `rowXs` squeezes the items evenly (`placeRow` for staging and play, `placeEngaged` for the
  engagement area). There is no wrapping anywhere.
- **The hand** fans along the bottom edge (`FAN_DROP` 2 pt a card, a 0.03 rad turn a card), each card keeping a 44 pt strip
  (`handCardSize` narrows cards in a long hand before the strip gets thinner).

Measured with `cardSize` and the stacked rows (canvas sizes are estimates of the room left of the dock and right of the quest
scale; measure the real ones on a device):

| Canvas | Card | Spare height today |
| --- | --- | --- |
| Phone, 844 × 390 screen (canvas about 520 × 350) | 57 × 80 | about 8 pt |
| Large phone (canvas about 600 × 380) | 64 × 90 | about 8 pt |
| Tablet landscape (canvas about 760 × 700) | 94 × 132 (cap) | about 180 pt |
| 12.9" tablet (canvas about 980 × 920) | 96 × 134 (cap) | about 390 pt |

So on a phone the height is already what limits the card, and there is almost no room to give; on a tablet the card hits its cap
and hundreds of points sit in one band above the hand. "If there's space available" is mostly the tablet.

## 1. Dynamic spacing "all around"

Goal: when there is room, it is shared out between the rows (staging, engaged, play, hand) and the edges, rather than piled above
the hand; when there is none (a phone), the layout is today's.

Suggested shape (decide the numbers on a device):
- Lay out at today's minimums first (as now). Spare height = `height - bottom - (bottom of the hand's strip region in use)`, the
  band that is empty today.
- Share the spare height between four gaps: staging ↔ engaged, engaged ↔ play, play ↔ hand, and the top gutter. Give the
  engaged ↔ play and play ↔ hand gaps the larger shares (the user named the hand, the engagement area and staging), and cap each
  gap (for example 3× its minimum, or a share of the card height) so a tall tablet does not float the rows apart; whatever is
  left after the caps can let the card grow past `CARD_MAX` or stay as ground at the bottom of the play band.
- Do the same across: spare width (when the card is at its cap) widens the gutters and the gap between the left column and the
  centre, again with caps.
- Keep it a pure function of the inputs, as now: put the shares and caps in named constants (Medium's sizes times the scale),
  never a device check. Phones must come out unchanged (spare ≈ 0), which a test should pin.
- The combat marks (`MARK`), the peeks (`PEEK`) and the 44 pt floors (`touch`, `MIN_TARGET`) stay as they are.

Things that read the rows' positions and must still agree: the left column (follows the row y values), `zones.*` rectangles (the
drop targets in table-view and the screen-reader fallback), the spotlight (`spotlight-plan.ts` reads the layout), the hand
scrub's `strip` (`hand-scrub.ts`, from `zones.hand`), and the peek of the other seat's table.

Tests: extend `layout.test.ts` ("the table's layout at a UI scale") with a phone canvas that matches today's geometry, a tablet
canvas whose gaps grow but stay under their caps, and the existing "every card inside the canvas" check across both. The
scenario table tests (`dol-guldur-table.test.ts`, `nibin-table.test.ts`, `oath-table.test.ts`, `side-quest-table.test.ts`,
`table-choice.test.ts`, `spotlight-plan.test.ts`, `store.test.ts`, `knife-sheets.test.ts`, `tray-logic.test.ts`) call
`tableLayout`; fix any that pin exact y values rather than loosening them.

## 2. The play area wraps

Goal: when the player's cards in play do not fit one row, they wrap onto a second (and third) row instead of overlapping.

- Today `placeRow(views.play.entries, "play", ...)` squeezes them via `rowXs`. Write a wrapping placement for the play area only
  (staging and engaged keep squeezing unless the user asks): fill a row left to right at the normal `gap`; start a new row when
  the next card (its footprint: an exhausted card is sideways, `footprint`) would not fit; keep the attachments peeking under each
  host (`placeUnder`) and committed characters a half peek higher.
- Where the extra rows go: first into the spare height from step 1 (the play band grows downward toward the hand). When there is
  not enough (a phone), choose one and record the decision in design-system.md: (a) shrink the play area's cards so two rows fit
  in today's band (a row of cards smaller than the rest of the table); (b) let the second row overlap the top of the hand's strip
  (the hand peeks, and the scrub raises it anyway); or (c) fall back to today's squeeze below some card size. Recommendation:
  (a) on a phone, with a floor (for example 0.7 of the table card, never under the 44 pt touch strip a card needs to be hit) and
  (c) under that floor.
- `zones.play` must cover all its rows (it is the drop target for playing a card from the hand). The deck and discard in the
  left column stay level with the first play row.
- Card motion animates the reflow; check that a card moving from row 1 to row 2 slides rather than jumps.

Tests: a play area of 10+ allies on a phone and a tablet canvas: no two play cards overlap (except attachments under their
host), every card is inside the canvas, the hand's strip is not covered (unless option (b) is chosen), and `zones.play` contains
every play slot.

## 3. Sharper card pictures on the table

What happens today (`src/play/table-images.native.ts`): each picture is decoded once, then redrawn into a surface the size of
the **table card on screen** (`layout.card × PixelRatio`) and the full decode is released. Three things make it soft:

- **The size is the small table card**, but cards are drawn larger: the hand scrub grows a card to `scrubScale` 1.5 and the one
  under the finger by `scrubLiftScale` 1.25 more (about 1.9× the table card), and the raised hand card is the full card. All of
  those upscale the small copy. (The combat spotlight already decodes its own larger copies: `use-spotlight-images.native.ts`.)
- **The downscale has no filtering**: `atSize` uses `drawImageRect(full, src, dst, Skia.Paint())`. Use
  `drawImageRectOptions(full, src, dst, FilterMode.Linear, MipmapMode.Linear)` or `drawImageRectCubic(..., B, C)` (both exist in
  the installed Skia 2.14, `Canvas.d.ts`), or downscale in steps, so a 1200 px scan becomes a 160 px card without aliasing.
- **The draw has no sampling option**: `<Image ... fit="cover" />` in `canvas-pieces.native.tsx` (lines 108, 152, 198) passes no
  `sampling`. Set `sampling` (`SamplingOptions`, `dom/types/Drawings.d.ts`) to linear with mipmaps, or cubic, for any image drawn
  at a size other than its own.

Fix: decode hand cards at the largest size they are drawn (the scrub's lifted size: `SHAPE.scrubScale × SHAPE.scrubLiftScale`,
or the new values from step 4) and the rest at the table card's size; or keep one copy per card at the larger size if memory
allows. Measure memory on a low-end Android with a full table (about 40 distinct codes) before choosing; keep releasing images of
codes that leave the table. Release builds bundle 1200 px JPEGs (`scripts/pack-scans.ts`, `MAX_SIDE`), so the source is sharp;
a dev build without bundled pictures may draw the smaller RingsDB files, so judge the quality on a release build.

## 4. A bigger grow while sliding along the hand

The scrub (`hand-scrub.ts`, `scrub-pose.ts`, `hand-scrub.native.tsx`, tokens in `src/play/motion-tokens.ts` `SHAPE`):
pressed and held, the hand rises and grows to `scrubScale` 1.5 (less when a long hand would not keep a 44 pt slice of each
card), and the card under the finger lifts `scrubLiftRise` 0.35 of its height and grows `scrubLiftScale` 1.25 more.

- Raise the lifted card's grow (for example `scrubLiftScale` 1.5 to 1.6, `scrubLiftRise` to suit, so its whole text is above
  its neighbours) and consider a falloff: the neighbours on each side grow a little (for example 1.15 and 1.05), as a dock
  magnifies, so the slide reads as a wave. A falloff needs `scrubPose` to know each card's distance from the one under the
  finger; the lift clock already runs on the UI thread, so pass the index under the finger as a shared value rather than
  re-rendering.
- Keep the lifted card inside the canvas: at a larger scale the end cards and the top edge can clip. `spreadLayout` already
  reserves the corners' overhang; extend that to the lifted size, and clamp the lifted card's x so its edges stay on the canvas.
- `cancelled` (the finger more than 44 pt above the risen hand) and `pick` read `spread.top`; check the lifted card's new top
  does not move the cancel line under the finger.
- Reduced motion: the scrub's clocks follow `motionScale`; the grow is a pose, not a motion, so it should still apply with motion
  reduced (as now), only snapping.
- Do this after step 3, or the bigger card is a bigger blur.

Tests: `hand-scrub.test.ts` (spread geometry; add the lifted card staying inside the canvas at every hand size from 1 to 12 and
at Small and Large) and a pure test of `scrubPose` for the falloff values.

## 5. Docs and status

- `docs/design-system.md`, "Table — landscape": the spacing rule (minimums, shares, caps), the play area's wrapping and its phone
  fallback, the new scrub values. Keep the motion token table in step with `motion-tokens.ts`.
- `docs/phases/STATUS.md`: a section for this work. A cloud session has no phone or tablet and the web build lists the table's
  zones instead of drawing the canvas, so every visual check stays open there; the geometry is covered by unit tests.
- Delete this handover when the work is merged.

## Checks before merging

`pnpm test`, `pnpm lint`, `npx tsc --noEmit`, and `pnpm data:check` (unchanged data). After the implementer's green exit, run the
`reviewer` agent on the diff and `ux` (it changes `src/play`). On a device: a phone in landscape at Small, Medium and Large, and a
tablet in landscape, with a crowded table (5 enemies engaged, 10 allies in play, 8 cards in hand), in Dark and Light.

## Prompt to start the work in a new session

Paste below the line into a new Claude Code session on `j-jmnz/middle-earth-lcg`.

---

Implement the table layout redesign described in `docs/handover/table-layout.md`, on a branch from `main`. Read the repo rules
(`CLAUDE.md`, `.cursor/rules/authority.mdc`) and the handover, then do its steps in order: dynamic spacing, the play area
wrapping, sharper card pictures, a bigger grow in the hand scrub, then the docs. Keep `tableLayout` pure and tested, keep phones'
geometry unchanged where there is no spare room, and record each decision the handover leaves open in
`docs/design-system.md`. Run the checks the handover lists; device checks stay open in `docs/phases/STATUS.md`.
