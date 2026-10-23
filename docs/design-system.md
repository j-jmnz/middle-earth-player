# Design system

Visual authority for chrome. Product rules stay in [brief.md](brief.md). Structure stays in [architecture.md](architecture.md). Later screen phases use these tokens. They do not invent a palette, a type scale, or a second styling system.

The look comes from the materials on the source shelf, sampled for color only. Player cards in `.cache/sources/ringsdb/`: hero `141001`, ally `141006`, events `141010` and `141011`, attachments `141013` and `141014`. Scenario scans in `.cache/sources/reading/a-shadow-of-the-past/`: an enemy, a location, a treachery, an objective, and a quest stage. The Fellowship booklet and the Learn to Play, covers and a few interior pages, including the spheres page. No card text and no booklet prose is copied here.

One theme. Both OS schemes map onto it. `userInterfaceStyle` is `light`. `global.css` sets `color-scheme: light`. NativeWind `colorScheme` is set to `light` when the root layout loads, and again if the OS scheme changes. There is no dark variant.

## Performance

Feel outranks decoration.

- A list is a FlashList. A row is one pressable, one text node, and at most one image decoded at 32×44. No blur, no shadow, and no gradient on a row. The name still shows when the file is missing.
- Press feedback is an immediate fill. Nothing animates on the scroll path.
- This phase adds no motion. Later sheets and phase changes use Reanimated, and they snap when the OS asks for reduced motion. The animation does not gate the rule.
- The first screen paints from SQLite. It does not wait on a font, an image download, or a catalog count. Type is the system face. No downloaded font, no icon font, no new package.
- The table is one Skia canvas. Card pictures stay on that canvas. Chrome text and buttons are React Native. `src/play` cannot import `src/screens`. The canvas clear color is the `table` token below, copied into play when the table is built.

## Color

Values live in `src/screens/palette.js`. `tailwind.config.js` maps them to utilities. A screen uses the utility or `palette`. It does not write a new hex. `app.json` splash and adaptive-icon backgrounds are `paper`.

Contrast is WCAG against the surface the text sits on. Body text uses a pair at or above 4.5:1. A color that misses that ratio is a mark, next to a word in `ink` or `paper`.

| Token | Hex | Use | On `paper` | On `table` |
| --- | --- | --- | --- | --- |
| paper | `#F3EBD6` | Page, sheets, phase rail, splash | — | 14.1, so this is the text color on the canvas |
| pressed | `#E6DFC9` | Pressed fill | ink 11.0, muted 5.7 | — |
| ink | `#2C291B` | Body, titles, primary labels | 12.3 | 1.2, do not put ink on the canvas |
| muted | `#5C5346` | Secondary sentences, inactive tabs, neighboring steps | 6.4 | — |
| heading | `#6E241C` | Short labels such as Errata | 9.1 | — |
| line | `#7A6C3E` | Hairline borders and rules | 4.4, not text | — |
| table | `#241C18` | Canvas ground, filled primary button | paper text 14.1 | — |
| threat | `#6B302C` | Threat number, enemy mark | 8.5 | mark only |
| treachery | `#3A221C` | Treachery mark | 12.4, mark with the word | mark only |
| quest | `#8F877E` | Quest mark | 3.0, mark only | mark only |
| location | `#7A5840` | Location mark | 5.4, mark with the word | mark only |
| objective | `#A68448` | Objective mark | 2.9, mark only | mark only |
| leadership | `#B06098` | Sphere pip | 3.6, mark only | mark only |
| tactics | `#E03848` | Sphere pip | 3.7, mark only | mark only |
| spirit | `#54A8C0` | Sphere pip | 2.3, mark only | mark only |
| lore | `#62B02A` | Sphere pip | 2.3, mark only | mark only |
| fellowship | `#7A5C38` | Sphere pip | 5.2, mark with the word | mark only |

Ratios are WCAG, rounded to one decimal. Body text uses ink, muted, or heading on `paper` or `pressed`, or `paper` on `table`. Each of those pairs is at or above 4.5:1.

Neutral has no pip color. The word Neutral is enough. Sphere and encounter marks are an 8 point square or disc (`bg-leadership`, `bg-threat`, and the rest) beside the word in `ink` on paper, or beside the word in `paper` on the canvas. Color is never the only signal for locked, current, completed, refused, or failed.

`paper` is the booklet page. The page's lightest field measures near `#F1ECD8`, and the token is `#F3EBD6`. `ink` is the booklet's body brown. `heading` is the booklet's dark red. `line` is the gold rule on that page. `threat` is the enemy's dark red field. `treachery` is the near-black field of a treachery frame. `quest` is the stone of the quest banner. `location` is the brown frame beside a location text box. `objective` is the gold of the objective text box. `table` is the near-black outer edge of a card. Sphere pips are the printed icons: leadership from attachment `141013`, tactics from attachment `141014`, lore from event `141011`, spirit from event `141010`, fellowship from the metal ring on hero `141001`.

## Type

One scale, shared by every screen. System face. Four sizes. Do not add a fifth.

| Name | Class | Size / line | Weight | Use |
| --- | --- | --- | --- | --- |
| display | `text-display` | 36 / 44 | semibold | Screen title, one line or a short wrap |
| title | `text-title` | 28 / 36 | semibold | Sheet title, choice name |
| body | `text-body` | 24 / 32 | regular | Rows, sheet text, errors, card text |
| label | `text-label` | 18 / 24 | regular, semibold when current | Tabs, step names, meta such as the collector code |

A long sentence is body, not display. The screen title is the only display text on that screen.

## Spacing, radius, border

The same scale as the type: the 4-point steps already in Tailwind. Do not invent a second scale. The steps this chrome uses are 8 (`mt-2`), 12 (`ml-3` beside a row image), 16 (`mt-4`), 24 (`px-6`, `mt-6`), and 44 (`min-h-11`).

- Page inset: `px-6` (24). Top inset: `pt-safe`. Bottom inset on a control that sits at the home indicator: `pb-safe`.
- Gap under a title before a list: `mt-4` (16). Gap before a following paragraph: `mt-6` (24).
- Minimum target: `min-h-11` (44). The phase rail, choice buttons, back, close, and tabs clear the notch, the status bar, and the home indicator.
- Radius: `rounded-control` (8) on a filled button. `rounded-sheet` (12) on a sheet. Rows are square.
- Border: `border` (1) and `border-line`. A sphere or encounter mark may use `border-2`.

## Components

Shared pieces live in `src/screens/chrome.tsx`. They are views and text. They do not fetch, and they do not import `src/rules` or `src/play`.

| Piece | What the player sees |
| --- | --- |
| `Screen` | Paper page, inset, top safe area |
| `ScreenTitle` | Display, ink, header |
| `BodyText` | Body, ink or muted |
| `ListRow` | Body ink, 44 point row, pressed fill. No image, no shadow |
| `BackButton` | The word Back, semibold, pinned to the bottom safe area |
| `TextButton` | Semibold body ink, 44 point target, pressed fill. The label is the action |
| `PaperTabBar` | Three text tabs. Current is semibold ink. The others are muted. Pressed fill. No icons |

Filled primary, for a later screen that commits something. One per screen. Paper text on `bg-table`, `min-h-11`, `rounded-control`, `font-semibold text-body`. Pressed state darkens in the same frame. Disabled is `bg-pressed` and `text-muted`, and the sentence above it says why. A second filled button on the same sheet is wrong. Other actions are text buttons: semibold body ink, `min-h-11`, pressed fill.

Back, Close, and Undo are those text buttons. They are labeled. They are not swipes.

## App mark

The splash and the home-screen icon are a single ink ring on `paper`. They are not card art and not a booklet illustration. The splash background is `paper`, so the first frame matches the first screen. The ring is bundled. Startup does not decode a card.

## Screens

### Campaign list — built

`src/screens/routes/(tabs)/index.tsx`. Title Campaigns. Campaign names in body ink. No saves: "No playthrough exists" in muted. The list does not read `cards`.

Phase 10 adds the real rows. A locked campaign shows the name, the scenario count, and the word Locked, in muted, and it is not pressable. The open playthrough is one row: name, seat count, and the word Current if it is not the only row. That row is the primary. When nothing is open, one filled button reads Start Fellowship. Empty, locked, and current stay readable without color.

### Packs — built

`src/screens/routes/(tabs)/packs.tsx`. Title stays put. Names are `ListRow`s on a FlashList. The title is outside the list. No packs: "No packs are in the catalog." in muted. The list queries the open catalog, so it has no second wait. A failed open is the database screen.

### Pack cards — built

`src/screens/routes/pack/[code].tsx`. Title is the pack name. Rows open a card. A row is the name plus at most one 32×44 picture when a file exists. No cards: "This pack has no cards." Unknown pack: title Pack, and the body names the code, "Pack {code} is not in the catalog." Back is `pack-back`.

### Card — built

`src/screens/routes/card/[code].tsx`. The name is the title. The collector code is a muted label under it, and it stays on screen (`141001` for the Maestro flow). A missing card uses the title Card and a body sentence that names the code: "Card {code} is not in the catalog." Errata is a heading label plus the errata in body ink. Back is `back`.

The picture sits under the title, at most the page width, with `expo-image` at that size. Text still shows while the file is missing. A list does not decode the native card. The table does not move its picture here.

### Decks — placeholder built

`src/screens/routes/(tabs)/decks.tsx`. Title Decks. "The deck editor is not in this build."

Phase 6 replaces the sentence with the editor. It uses these tokens.

- Hero slots: three rows. Empty slot says Empty. A saga hero shows the words Saga only, not a color.
- The count against 50, the copy limit, and the sphere word sit in body or label. The sphere pip is a mark beside the word.
- Filters are one sheet, opened by a text button labeled Filter. The sheet has one filled button, Apply. Search is a field above the list. The list is a FlashList. A row is the card name, the type word, the sphere word, the cost, and at most one 32×44 picture. No sticky headers if the pinned FlashList is 2.0.2. This install is newer, and the row still stays flat.
- Save is the one filled primary. A refusal names the card and the rule in body ink. It does not save. The button does not commit until the sentence is on screen.
- Import is a text button, not a second primary.

### Debug — dev

`src/screens/routes/debug.tsx`. A paper screen on the stack. It uses the existing type scale and no new color. A text button labeled Debug on the campaign list, in thumb reach, opens it. It is not a tab. Remove the button and the route before phase 11.

### Database — built

`src/screens/database-error.tsx`. Title Database. The message names the failure. Test id `database-error`. No retry control, because this screen has no retry.

### Tabs and splash — built

Campaigns, Packs, Decks. `packs-tab` stays on Packs. Splash background `#F3EBD6`.

### Campaign path — not built

Phase 10. A vertical list of the six scenarios, not a map. Each row is the scenario name plus one word: Locked, Current, or Completed. Locked is muted and not pressable. Current is semibold and is the primary (Begin). Completed adds the chosen reward in body ink under the name. The pool sits under the path as names, not a second card grid. Log is one text button. Booklet is one text button. One filled action at a time.

### Log — not built

Phase 10. Display title is the campaign name. Sections use the label size and `text-heading`: Heroes, Fallen heroes, Threat, Boons, Burdens, Scenarios, Score, Notes. Values are body ink. A permanent boon names the hero it is stuck to. Score stays 0 until a cited formula exists. Notes are the only free text. Save notes appears as the filled primary only after the text changes, and it says Save notes. Otherwise Back is the text button.

### Briefing — not built

Phase 10. Title is the scenario name. Stages in order, body. Encounter sets and counts, body. Easy and Normal are two text choices with the selected word semibold and the word Easy or Normal. The unselected one is muted. Deck picker is a row per saved deck. No saved decks: "No deck is saved." in muted. The Ring-bearer slot is a row, labeled Ring-bearer. A validator error names the card and the rule in body ink. Deal is the filled primary. It is disabled, and the error stays visible, until the loadout is legal. The button label is Deal, and the sentence above it says that dealing starts the scenario.

### Table — not built

Phase 11. Do not build a React Native view per card.

- Canvas clear color is `table` (`#241C18`). Cards are pictures at on-screen size. Text on a card is the picture.
- The phase rail is a paper bar at the bottom, above the home indicator. The current step is semibold body ink and is fully visible. Neighboring steps are label muted and may truncate. The current step never scrolls away. The rail does not show every step at unreadably small type.
- Threat sits on that bar: the word Threat in label muted, the number in `text-threat`. Life, when the script declares it, is the word Life plus the number in ink. Neither number is typed by the player.
- Zones the player needs (staging, engaged, play area, hand, active location, pinned quest) are regions of the canvas. Their names, when shown, are paper text. A quest, location, enemy, or treachery mark uses the token and the word.
- A choice opens a paper sheet (`rounded-sheet`) over the rail. The sheet repeats the current step name so the player still knows where they are. The consequence is a body sentence. One filled primary. Other legal choices are text buttons. Hide and trigger sheets use the same sheet. A failed test says Failed and shows the numbers the engine computed. Passed says Passed. Shadow cards stay face down until that attack. No stepper, dial, or phase scrubber.
- A tap shows the pressed fill in the same frame. A drag stays on the UI thread. Reduced motion snaps the sheet.

### Resolution — not built

Phase 11. Title is the outcome in words. A loss has no reward screen: the sentence says the scenario was lost, and one text button returns to the path. A win lists the script's choices. Each option is a row. The selected row is semibold. Confirm is the one filled primary, and the sentence above it names what will be written to the log. The choice is not committed by the row tap alone.

### Booklet — not built

Phase 10. Full-screen reader. The PDF page is the PDF. Chrome around it is paper. Close is a text button in the bottom safe area and returns to the screen that opened it. A missing file names the book: the title is the book name, the body says it is not on this phone, and the filled primary is Add booklet. Turning a page does not animate when reduced motion is on. The reader is not a Skia surface and not a WebView.

### Card pool — not built

Phase 6, beside the deck editor. Same row and filter sheet as the deck list. No matches: "No cards match." in muted. Opening a row pushes the card screen. The pool writes nothing.

## States

| State | Treatment |
| --- | --- |
| Empty | A muted body sentence that says what is missing. The title stays. |
| Loading | The splash is the startup wait. A later wait shows the title and the word Loading in body ink. No spinner package. |
| Error | Body ink. The sentence names the card, the book, or the failed open. Not a generic failure. |
| Locked | The word Locked, muted, not pressable. |
| Current | Semibold ink, and the word Current when the row is not obvious. |
| Completed | The word Completed, plus the reward name. |
| Refused | Body ink naming the card and the rule. The save does not happen. |
| Failed test | The word Failed, plus the engine's numbers. Threat color may mark the row. The word is required. |

An irreversible control (Deal, Confirm, a resolution choice) shows the consequence in body text before it commits.
