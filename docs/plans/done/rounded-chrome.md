# Rounded chrome: round controls, fewer boxes, fewer words

The user approved this redesign of the chrome on 2026-10-30. They took every recommendation in the proposal (artifact "Rounded Carved Stone"). The decisions below are settled. When this work is done, `docs/design-system.md` describes the result, and this file moves to `docs/plans/done/`.

## Settled decisions (user instruction, 2026-10-30)

- **Every control is a capsule.** That covers every button, chip, toggle, segmented track and its thumb, search field, stepper and badge, with a radius of half the height. Full-width primaries are capsules too.
- **Containers.**
  - A floating container has 20 pt corners: the dock, choice tray, popover, phase carousel, reading panels, toast, banners and the quest-advance overlay. Parchment sheets take 24 at their top.
  - An item has 12 pt corners: list rows, radio tiles, stat tiles, covers, poster tiles and book tiles. That is the container's radius less its padding.
  - Card pictures keep `cardCorner()`.
- **Four button styles and no others.**
  - **Primary**: the accent fill, 52 pt tall (44 compact, 46 in the table's command column). Its label is Marcellus SC 17, tracked 1.2. There is one primary per screen.
  - **Secondary**: a tonal fill (bone at about 8% on Dark, the light theme's equivalent), 44 pt tall, with a Marcellus SC 15 label in the accent.
  - **Text**: words in the accent with no fill, and a capsule fill while pressed.
  - **Glass**: the round 44 pt icon button, plus a 44 pt glass capsule for a word (History, Manage, Import).
- **Buttons are quiet.** No glow, no inset lit edge, no drop shadow and no 1 pt ground ring on any button. Depth comes from tone alone. The primary keeps a soft vertical fill.
  - Pressed: a button darkens about 8%. The primary also keeps its 1 pt sink.
  - Disabled: one look everywhere, the same shape at 35% opacity, with the sentence that says why beside it. There is no dashed edge, no ink border and no flat dark plate.
- **One layer, never nested.**
  - Content sits on the fog.
  - A surface is earned only by a layer that floats over the page (the dock, tray, popover, sheet or ActionBar), by a tappable row or tile, or by parchment.
  - A surface never holds another surface.
  - Tappable list rows keep their soft wash and their chevron, as the cue that they can be tapped.
  - Section headings lose the rule that fades out to their right.
- **Borders only where they mean something.** Keep these:
  - the selected ring;
  - the attacking or engaged enemy's red ring;
  - the sphere rings on portraits;
  - the rings on the threat dial and the quest scale;
  - the rings on the path stops;
  - the combat banner's red top band;
  - the log's ruled lines on parchment.

  Every other border, hairline, dashed outline or divider in the chrome goes.
- **The card screen** keeps the card's text below its picture, without the panel.
- **Untouched**:
  - the fog and backdrops (`backdrop*.ts(x)`, `backdrop-scenes.ts`, `art.tsx` veils);
  - the palette's colours;
  - the type faces;
  - card art crops;
  - the table canvas, which is all of `layout.ts`, `table-spacing.ts`, card positions and sizes, the hand, piles, tokens and the marks on cards;
  - the quest scale's place and width;
  - motion tokens;
  - every engine rule and number.
- **Keep** every testID, every screen-reader label (a control that loses its visible word keeps its spoken label), the 44 pt targets and the one-primary rule. A string removed from the screen stays in the accessibility label where it carries information.

## Tasks, in order

Each task updates the passage of `docs/design-system.md` that it supersedes, following `.cursor/rules/docs-standards.mdc`: rewrite the passage, no history. Each task also updates the tests and `.maestro/*.yaml` flows that read a string or a style it changes.

### 1. Tokens and the button system

- `tailwind.config.js`: the radius scale becomes `control` (999px), `item` (rem 12) and `container` (rem 20), plus `sheet` (rem 24) for the top of a parchment sheet. Move every use of `rounded-button`, `rounded-chip`, `rounded-tile`, `rounded-card`, `rounded-hero`, `rounded-pill`, Tailwind's bare `rounded` and `rounded-sm` onto them, then delete the old keys. Do the same for literal `borderRadius` numbers in chrome views (`20*s`, `16*s`, `18*s`, `14*s`, `10*s`, `6*s`, 3, 4). The 2.3 pt corner of a canvas card, and `cardCorner()`, are not chrome.
- `src/play/surfaces.ts`:
  - `accentPlate` loses its glow, its lit and dark inset edges and its night ring.
  - `slateSurface` becomes the flat tonal secondary fill, with no shadow.
  - `glassSurface` loses its shadow.
  - `segmentSurface` and `sunkSurface` go flat: a tonal track and a lighter thumb, with no inset shadow.
  - Panels, tiles and parchment keep their depth.
  - Nothing in the backdrop changes.
- `src/screens/chrome-buttons.tsx`:
  - `PrimaryButton`, `SecondaryButton`, `TextButton`, `IconButton` and `PillButton` (44 tall, `rounded-control`) follow the four styles. `ToggleChip` becomes a 36 pt capsule in a 44 pt target: tinted when on, with its foot bar gone.
  - `SearchField` and `Segmented` (`src/play/segmented.tsx`) become capsules.
  - Disabled takes the one look described above.
- Fold the duplicates into the four styles:
  - `ChromeButton` and `ChromePrimary` (`src/play/sheet-paper.tsx`) draw the same shapes and fills as Secondary, Text and Primary. `src/play` cannot import screens, so the shared surface or style lives in `src/play`, and the screens' components read it there.
  - `SettingTextButton` (`src/play/setting-rows.tsx`) becomes the Text style.
  - `NewDeckButton` (Decks) becomes a round glass `IconButton` labelled "New deck". This removes the second primary.
  - The Cards tab's `FilterButton` becomes a Secondary with its count badge.
  - "Applied only" becomes a `ToggleChip`.
  - The `SphereToggles` become capsules.
  - The filter sheet's chips become capsules with no border, and its native `Switch` becomes `SettingSwitch`.
  - `CountStepper` becomes a capsule.
  - The hero ✕ keeps its 28 pt disc with a 44 pt hit slop.
  - The Decks header's Import and Manage, and History and Manage elsewhere, are all glass capsules.
  - Packs becomes a glass capsule.
  - The defeat screen's "Back to path" becomes the primary.

### 2. The table chrome

The canvas and its layout are not touched (Settled decisions). The table menu, the dock's popovers and the carousel keep their behaviour, ids and motion.

**Top bar**
- The threat dial shows the number alone. The word THREAT goes from the disc, and the label keeps "threat". Its rings, ticks and warming stay.
- The phase rail shows the phase name and its ticks. The "Round 3 · Staging" line goes from view. `rail-round` and `rail-current` stay in the accessibility tree, for example as the rail's label. The round shows in the carousel.
- The menu button becomes the round glass `IconButton` in the play style, with its three dots.

**Command column**
- The dock has no panel: no `panelSurface` and no corners. It stands on a horizontal fade from transparent to the night, from the canvas side to the right edge.
- The step overline goes, because the rail names the phase. Two-handed play keeps the seat, at the start of the title.
- The readout is inline, with no sunk band. During the Quest phase, while the quest scale shows, the dock does not draw its own willpower-against-threat readout.
- The "i" pill becomes a 26 pt round button beside the title, with a 44 pt target.
- The primary is the capsule. Answers are Secondary capsules. Reading aids (Undo, Read, List, Actions, More, Choose) are Text-style words on one row.
- The armed line and its timer bar keep their behaviour.

**Choice tray**
- The choice is not a separate panel standing on the dock. Its options are rows in the command column, in the column's own space above the buttons. Each row has no plate and gets a 12 pt accent wash when picked.
- The count overline goes. The dock's title asks the question, for example "Choose a defender".
- A row shows the card picture, the name, the deciding stat and the foreseen-damage pill.
- Folding, the outside-tap rules and the screen-reader default stay.

**Quest scale**
- Same place, same width.
- It shows the threat dial, the difference between the dials ("+1" in ok, "−2" in danger, "Even") and the willpower dial, each dial with one small word under it.
- STAGING, "committed" and the 2 pt line between the dials go.

**Other panels**
- **Phase carousel**: one panel with 20 pt corners and two columns: the round's seven phases ("Round N" at the top), then the steps of the phase being read, as a plain dot timeline with each Stop switch on its row. The Stops switch for the whole table sits at the top right.
  - The phase cards, their borders, the number discs, the "Now" chip, "Phase N of 7", the divider and the arrows all go.
  - A tap on a phase shows its steps. The current phase is shown on open.
- **Menu and popovers**: 20 pt corners and 12 pt rows. No chevrons and no divider. Leave the table is set apart by 8 pt of space and its danger word.
- **Reading panels**: parchment, or night for settings, with 20 pt corners. "✕ Close" becomes a round ✕ icon button labelled "Close". Pile-list tiles and threat rows lose their borders; the log keeps its ruled lines.
- **Banner**: 20 pt corners, with its hairline gone. The combat banner keeps its 3 pt red top band.
- **Peek pill**: its hairline goes.
- **Card preview**: the related rows lose their borders, and Details is a Secondary.
- **Quest-advance overlay**: the card placeholder takes `cardCorner()`, Begin is the capsule, and the stage is named once (task 4).

### 3. Containers on the screens

Remove the surfaces that break the one-layer rule:

- **Campaigns**
  - `StartPanel` drops its panel, and its radio tiles sit on the ground.
  - The True solo / Two-handed seat tiles become a stretched `Segmented`, like the standalone briefing's Players switch, keeping `seat-*` testIDs and the radio-group semantics.
  - The managed and archived save panels stay; they are things put away.
- **Scenarios**: the in-progress `Panel` around the scene goes, and the scene banner is the button.
- **Card screen**
  - The five stat tiles become one row of numbers with their small caps words and no surfaces.
  - The text and errata lose their panels.
  - `DeckUse` rows stay as rows.
- **Rule**: the text loses its panel. On a tablet, the panel round the page goes.
- **Briefing seat** (`seat-picker.tsx`)
  - The picked deck's panel goes. Its name and a Text "Change" sit on one row, with the hero tiles under them.
  - The dashed Ring-bearer slot goes; once picked, the chosen Ring-bearer shows as the fourth tile.
  - The Ring-bearer rows lose the word "Choose", and the whole row is the button, with its label "Choose Frodo Baggins, The Black Riders".
- **Deck editor**
  - `DeckAnalytics` loses its panel.
  - The type totals (Allies 21 …) move into the jump chips.
- **Path**
  - The Pool line loses its wash.
  - "Campaign log" becomes a Text button.
  - The won summary's outer `Panel` goes, keeping `WonRow`.
  - "Campaign complete." loses its panel.
- **Game report** (resolution and standalone outcome): each section is a heading and plain content, with no `Panel`.
- **Section headings** (`Section`, `SectionHeading`, `FoldSection` header): the fading rule goes.

### 4. Borders and words

**Borders**
- Remove the borders not kept by the Settled decisions:
  - the toast edge;
  - the moment banner hairline;
  - the peek pill hairline;
  - the threat delta badge edge and the non-compact `ThreatRing` border;
  - the paper `Tile` and `ReadoutView` borders;
  - the filter sheet's chip borders and its `OptionRow` `border-b`;
  - every carousel border;
  - the borders on the card preview's related rows;
  - the dashed empty hero slot and the dashed booklet placeholder;
  - the paper and dashed disabled primaries;
  - the primary's night ring;
  - the pool cell's "in deck" ring;
  - the `card-pool.tsx` divider and `PopoverDivider`;
  - the not-applied left rule;
  - the PortraitRow night border and Portrait's no-ring hairline;
  - the OutcomeTitle's inset ring.
- An empty pile on the canvas keeps its dashed outline, because the canvas is not touched.

**Words.** Each old string becomes the new one, or goes. Where a test names the old string, update the test.

| Where | Change |
| --- | --- |
| Standalone briefing | "No campaign card, boons or burdens. A win is scored; nothing is written to a campaign." goes (the Scenarios tab says it). |
| Standalone outcome | "A standalone game writes nothing to a campaign." goes. |
| Briefing, Difficulty | `DIFFICULTY_NOTES` drop their "Easy:" / "Normal:" lead: "Full encounter deck, no starting resources." |
| Deal bar | `dealSentence`'s "{difficulty} difficulty. Dealing starts the scenario." goes. "A scenario is already open. Dealing again drops it." stays. |
| Seat picker | "Choose the deck this seat plays." goes. "Choose the Ring-bearer" becomes the section heading "Ring-bearer", and the rows lose "Choose". |
| Briefing error | The missing Ring-bearer problem reads "Seat N needs a Ring-bearer." |
| Campaigns start | "N scenarios" under the art's title goes, "Start {name}" becomes "Start campaign", and "Chosen once for this campaign" becomes "Can't be changed later." |
| Campaigns hero | The overline "Campaign · {seats}" becomes "{seats}". |
| Deck editor | `heroLine` becomes "Threat N" (the fan shows the heroes), and `countLine` ("3 heroes · 50 cards") goes. |
| Deck cover and row | "3 heroes · N cards" shows only when the deck is short ("48 of 50 cards"). |
| Settings | "System follows your phone." and "Follow system uses your phone's setting. Always keeps motion off." go. |
| Rules | The glossary count beside its heading goes. |
| History | The "N runs" count goes. |
| Resolution and outcome | "Lower score is better." is said once, under the score. |
| Pool filter sheet | The overline "Filter" over "Card pool" becomes the title "Filter". |
| Quest advance | One stack: the overline "Stage N of M", then the stage name. "Cannot advance yet: The players cannot …" becomes the rule's own sentence, with no lead. |
| Dock | The step overline goes (task 2). "The only choice now: one tap sends it" stays. |
| Pile list | "Can be played from here now. Tap to play it." becomes "Playable now". |
| Log panel | "Round N" under "Log" goes. |
| Reading panels | "✕ Close" becomes the round ✕ (task 2). |

## Out of scope

- The fog and backdrops.
- The palette.
- The table canvas and its layout.
- The engine.
- `data/`.
- New screens.
- A second theme pass beyond keeping Light working with the same tokens.

## Exit

- `pnpm test`, `pnpm lint`, `npx tsc --noEmit` and `pnpm data:check` are green.
- `contrast.test.ts` holds for every pair a change touches.
- Phone checks stay open in a cloud session: they are listed in `docs/phases/STATUS.md`.
