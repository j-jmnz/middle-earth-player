# Plan: Screen reader parity (VoiceOver and TalkBack)

## Context

The user wants every menu, every screen, and above all every game to be fully usable and playable with VoiceOver (iOS) or TalkBack (Android).

User decisions (2026-11-05):
- **The table becomes a reader table.** With a screen reader on, the phone draws a native list of the board in place of the Skia canvas: zones as headings, each card a button that says its whole state. It is built from the web list in `src/play/canvas/table-canvas.tsx`.
- **The platforms are iOS and Android.** The web build stays as it is.

### What already works (reuse it, do not rebuild it)

**The shared store.** `src/ui/accessibility.ts` is the one accessibility store, read through `useScreenReader` (`src/ui/screen-reader.ts`).

**Choices on paper.** With a screen reader on, every pick, multi, distribute and trigger sheet is listed in the tray:
- `src/play/choice/use-table-choice.ts`, the `asked` condition;
- `src/play/choice/tray-logic.ts`, `tapRoute` and `outsideLayers`;
- the tiles carry their stats and selected state (`sheet-paper.tsx`).

**What turns off with a reader.** The hand scrub, the combat spotlight and every drag. Armed buttons wait longer (`dock/buttons.tsx`, `ARM_READER_MS`).

**Words for piles and special cards.**
- Piles and fold stacks: `pile-speech.ts`.
- Special cards say their state through `areaSpeech`, `grappleDetail`, `treasureSpeech`, `controlSpeech` and `info().loss.speech`, which `cardSpeech` gathers.

**Text the game already has.**
- The log: `store/log.ts`, `logLines`, shown in `LogPanel` (`reading-panels.tsx`).
- Outcomes: `store/outcome.ts`.
- Printed text: `cards/ledger.ts` and `cards/card-text.ts`, through `CardTextView`, whose icons speak their word.
- Readouts: `readouts/readout.ts`.
- Board selectors: `store/selectors.ts`, `zoneSelector` and `pileSelector`.

**Labelled controls.**
- Table: the threat dials, the phase rail and carousel, the card preview (adjustable, with escape), the table menu (modal, focus on its first row), and the banner (with a Dismiss action).
- Kit: `ListRow`, `NavBar`, `FoldSection`, `RadioTile`, `ToggleChip`, `CountStepper`, `SheetModal`, and the toast.
- Decks: reordering has Move up and Move down.

### The gaps

**The one that blocks play.** A reader cannot play a card from the hand. `PlayCard` is offered only through `windowSheet().plays` (`bar-sheets.ts`), and that is a tap or a drag on the canvas: the Actions sheet holds only Trigger intents, and no reader button covers a hand card. A reader also cannot explore the board: the heroes, the play area, staging, the engaged enemies and the quest exist only on the canvas.

**On the table.**
- A refusal (`sheet-refusal`, `cannotPay`) is not announced.
- A new moment is not announced, and focus does not move to it.
- No long-press alternative exists on the canvas.

**On the screens.**
- Long presses have no accessibility action; the one name for them is "Show card".
- The booklet's pages are not readable on Android.
- The card zoom picture has no label.
- Some segmented controls have no group label.
- The Ring-bearer candidates are not radios.
- `PaperSheet` titles are not headers.
- Some things are announced twice: the toast, and the resolution's ", selected".

### Independence from ordinary play

The screen reader path is entirely separate from ordinary play (user instruction, 2026-11-05). With no screen reader on, the app looks, moves, sounds and plays exactly as it does now. This covers the canvas, gestures, drag, the hand scrub, the spotlight, motion, haptics, timings, words on screen, layout, and the web build.

- **One gate.** All new reader behaviour is gated on `useReaderMode()`, a new hook in `src/ui/screen-reader.ts` that returns `Platform.OS !== "web" && (useScreenReader() || a development build's override)`, the override being `EXPO_PUBLIC_FORCE_READER=1` for the Maestro flow. The plain `useScreenReader()` answers yes on web, so it is not a gate for anything new.
- **The reader's own files.** New reader code lives in its own files: `card-speech.ts`, `reader-table.tsx`, `announce.ts`, `use-reader-focus.ts` and `long-press-action.ts`. The ordinary path does not import a reader file, except through one switch at the point where the reader takes over, such as `table-canvas.native.tsx` choosing `ReaderTable`.
- **Ordinary files gain only accessibility props.** A shared file can gain `accessibility*`, `importantForAccessibility` and `onAccessibilityAction` props, which a sighted touch user never meets. It does not change what is drawn, how a touch acts, or any text on screen. When a reader needs different words (a note, a hint), they are a field read only under `useReaderMode()`; the visible string stays the same. The one line in an ordinary file that is not an accessibility prop is the booklet route's `reportBookletPage`, which tells the reader-only button which page is showing.
- **Tests stay as they are.** No golden, fixture, Maestro flow or existing test assertion changes, except the import of moved `announceForAccessibility` calls. The engine (`src/rules`) and `data/` are not touched.
- **The reviewer checks it.** `reviewer` checks each section's diff against these rules and blocks any change that reaches a user with no screen reader on.

### How the work runs

The plan runs through `orchestrator` with Sonnet implementers, one commit per section. Then one review round: `reviewer` on every section, and `ux` on the sections that touch `src/play` or `src/screens`.

Every change follows `.cursor/rules/code-standards.mdc`:
- zero React Compiler bailouts (`src/play/compiler.test.ts`);
- `src/screens` imports nothing from `src/rules`;
- the file-size check passes (`scripts/checks/file-size.test.ts`).

A change people can see or hear updates `docs/design-system.md` or `docs/design-system-table.md` in the same section. Run `pnpm docs:index` after a heading change.

Vitest runs in node with no renderer, so everything spoken is built by **pure functions** and tested as strings. Components only pass those strings on.

## 1. Card speech and one announcer

**`src/play/words/card-speech.ts`**
- `cardSpeech(game, seat, cardId, deps)` returns `{ label, hint }`. The label says:
  - the name, and the type when the name does not make it clear;
  - the controller, with two seats;
  - exhausted, and committed;
  - damage against hit points;
  - resources;
  - progress against quest points;
  - the engine's stats (`info()`, `readoutFor`);
  - the attachments and shadow cards, by name;
  - "Not applied";
  - every special sentence that exists now: the island, the area, grapple, treasure, control, the loss.
- The hint says what a tap does in the open moment: "Can be played"; "Can commit"; "Pick to defend, takes 3 damage, destroyed"; "Double tap to show the card" (the cost and the willpower are in the label). It reads `TableHighlight` (`tappable`, `picked`, `marks`, `muted`) and the window sheet's `plays`.
- `zoneSpeech(zone, count, seat, game)` says the zone headings: "Staging area, 3 cards, threat 5"; "Engaged with you, 2 enemies"; "Your hand, 6 cards".
- Pile words stay in `pile-speech.ts`.
- The reader table calls `cardSpeech`. The special sentences a card has always said stay word for word, and the existing tests prove it. The web list (`table-canvas.tsx`) is not touched.

**`src/ui/announce.ts`**
- `announce(text)` queues what it is given, so one line does not cut off the next (iOS drops an announcement made while another is speaking). It moves on at the `announcementFinished` event, and on a timer on Android.
- Every existing `announceForAccessibility` call moves to it: the banner, the peek banner, armed buttons, the area summary, History, folds, the rules, the pool, deck moves and the toast.
- The toast keeps either its announcement or its live region, not both, so Android stops reading it twice.

**Tests**
- `card-speech.test.ts`, on the scenario 1 fixture states: a hero with damage and an attachment; an enemy in staging with its engagement cost; a location with progress; a hand card that can and one that cannot be played; a defender pick with its mark; a face-down card; a peek at the other seat, which offers no action.
- `announce.test.ts`: order; waiting for the finished event; the fallback timer; clearing.

**Docs**
- `docs/design-system-table.md`, new heading "Screen reader": what a card, a zone and a pile say.
- `docs/architecture.md`: `src/ui/announce.ts`.

## 2. The reader table on the phone

**`src/play/canvas/reader-table.tsx`**
- The reader table is its own component. It reads the same selectors as the web list (`zoneSelector`, `pileSelector`, `secondPilesOf`, the sea and look words), and the web list's file is not edited.
- The zones are headers (`accessibilityRole="header"` with `zoneSpeech`), in this order:
  1. the quest and the active location;
  2. staging, then engaged;
  3. your heroes and play area;
  4. the hand;
  5. the piles.
- A card is a button with the `cardSpeech` label and hint, and `accessibilityState.selected` while it is picked. While a pick is open, a card the pick does not ask about is drawn faint and its hint says it is not part of the choice; it is not `disabled`, since TalkBack may block the click and actions of a disabled node.
- **Double tap** is the canvas tap (`onTap`): it plays, picks or opens the preview through `tapAction`, unchanged.
- A custom action **"Show card"** (`accessibilityActions`) opens the preview, as the long press does. A pile's action opens its list.

**`table-canvas.native.tsx`**
- While `useReaderMode()` is on, it renders `ReaderTable` in place of the `Canvas`. When it is off, the canvas branch is the code that runs today, unchanged.
- `onRowFeet` and `reach` still answer, so the command column lays out as before. The gestures are not mounted.

**The window sheet's note.** A sheet gains an optional `readerNote` beside its `note`. The window sheet's is "Cards that say 'can be played' can be played now.", in place of "Tap a glowing card to play it, or drag it". So is any other note that says "glowing", "drag" or "tap on the table" (find them with a grep on `src/play/choice/*sheets*.ts`).
- The dock speaks `readerNote` only under `useReaderMode()`. The visible `note` and every existing sheet test stay as they are.

**Tests**
- `table-list-rows.test.ts`: the order and grouping as a pure function.
- `bar-sheets` notes with a reader on.
- `tray-logic.test.ts`: the tap routes with a reader on.

**Docs**
- `docs/design-system-table.md`, "Screen reader".
- `docs/architecture.md`, Screens: the reader table replaces the canvas while a reader is on.

## 3. The table's moments, refusals and chrome

**Focus**
- Add a hook `useReaderFocus(ref, key)` in `src/ui/`. It uses `AccessibilityInfo.setAccessibilityFocus(findNodeHandle(ref))` once the layout has settled.
- The dock's title takes focus when `sheet.key` changes, and the new title, with its note, is announced.
- Focus does not move while the player is on a card that the new moment still asks about.

**Refusals.** The dock's refusal text and the `cannotPay` refusal (`why.ts`) are announced through `announce`, with the reason.

**Distribute rows** (pay a cost, assign damage)
- Each row is `adjustable`, with increment and decrement actions that add or take away one share, and the value "2 of 3 paid".
- These are accessibility actions only. A touch on the row behaves as it does now. The pure step goes in `tray-logic.ts`, as a new function; the existing ones do not change.

**Roles in the tray.** A pick row is a `radio`, a multi row a `checkbox`, and a trigger row a `button`. Each row's spoken name is its label and detail, from `trayTiles`.

**Combat without the spotlight.** The banner's lines for each attack (`outcome.ts`: who attacks whom, the shadow and its effect, the damage, a destroyed card) are announced in order through the queue. The banner keeps its Dismiss action.

**The log.** The table menu's Log keeps its order, oldest first. Each line is one element, with its cause, and the reader's focus lands on the newest line when the panel opens.

**What is left in the chrome.** A pass over `src/play/chrome`, `readouts`, `phases`, `dream-chaser`, `spotlight` and `src/screens/table`:
- the preview scrim gets a role (`card-preview.tsx`);
- each reading panel and Quest advance is `accessibilityViewIsModal` with a labelled close and `onAccessibilityEscape`;
- the outcome and won/lost moments announce their title.

**Tests**
- `tray-logic.test.ts`: the role and value of each sheet kind, and the distribute step.
- `outcome.test.ts`: the order of the spoken combat lines.
- Pure tests for the focus decision: the key changed, and the focused card is still asked about.

**Docs.** In `docs/design-system-table.md`, add what a reader hears to Command column, Choice tray, Banner, Spotlight and Reading panels.

## 4. Menus and screens

**Shared helper**
- `src/ui/long-press-action.ts`: `longPressA11y(label, onLongPress)` returns `accessibilityActions`, `onAccessibilityAction` and the hint, for every press with a long press.
- Use it in:
  - `TextButton` (`buttons.tsx`), whenever `onLongPress` is set;
  - `ListRow` (`kit/chrome-frame.tsx`);
  - `HeroTile` (`art/hero-tile.tsx`, merged with its Move up and Move down);
  - `pool/cards.tsx`, `deck/grid.tsx`, `routes/pack/[code].tsx`, `briefing/seat-picker.tsx` and `briefing/need-choices.tsx`.

**Sheets and popovers**
- `PaperSheet` (`kit/chrome-frame.tsx`) and `SheetModal` make their title a header and move focus to it on open (`useReaderFocus`). This covers the filter sheet and the deck editor's leave sheet.
- `PopoverFrame` (`ui/popover-frame.tsx`) gains `onAccessibilityEscape`.

**Roles and labels**
- Group labels on the segmented controls: `deck/list-bar.tsx`, `pool/card-pool.tsx`, `briefing/parts.tsx` (difficulty), and `routes/standalone/briefing/[scenarioId].tsx` (seats).
- The sphere chips in `pool/filter-sheet.tsx` become radios that say `checked` alone, with a group label. `OptionRow` gets a hint that it opens a choice. The captions become headers.
- The Ring-bearer candidates (`briefing/seat-picker.tsx`) stay buttons ("Choose …"): none is ever checked, so a radio would say nothing true.
- The resolution tiles (`routes/resolution/[saveId].tsx`) drop ", selected" from their label.
- Each node of the path road (`campaign/path-road.tsx`) gets an `accessibilityLabel` and a state (won, next, locked, coming soon), even when it cannot be pressed. Nothing visible changes.
- The log's notes field (`routes/log/[saveId].tsx`) gets a label. The `Eyebrow` labels that title a group (`kit/chrome-text.tsx`) become headers.
- The card page's picture (`images/picture.tsx`, `InspectCardImage`) gets the card's name. The pinch zoom stays a visual extra. The page already shows the card's text: check it is in the reading order.

**The booklet reader** (`modules/booklet-pdf`, `routes/booklet/[id].tsx`)
- Android (`BookletPdfView.kt`): each page's `ImageView` gets `contentDescription` "Page 12 of 32", and changing page announces it.
- iOS (`BookletPdfModule.swift`): check that PDFKit reads the page's text and says the page. Where it does not, label it the same way.
- On both: under `useReaderMode()` only, so it is never drawn for a sighted user, a **"Rules on this page"** button, ahead of the pages in the reading order, lists the rule entries from that page (`data/rules/entries.json`, by document and page, through the catalog), which open in the rules reader. This is the readable path to the booklet's words.
- The native compile is a phone check (`docs/phases/STATUS.md`, phase 10 already lists it).

**The static check:** `scripts/checks/a11y.test.ts`. It parses `src/**/*.tsx` with the `typescript` package, as the other checks do, and fails on:
- a `Pressable`, `TouchableOpacity` or `Text` with `onPress` that has no `accessibilityRole` (a part from `src/ui` or `src/screens/kit` that sets its own role passes);
- one that has neither an `accessibilityLabel` nor text children;
- an `onLongPress` with no `accessibilityActions` and no `longPressA11y`;
- a `TextInput` with no `accessibilityLabel`;
- an `Image`, `CardImage` or Skia `Canvas` that is neither labelled nor hidden.

An exception list holds each exemption with its reason.

**Tests.** The static check; pure tests for every new label function; `longPressA11y`.

**Docs.** `docs/design-system.md` gets a new heading "Screen reader" with these rules:
- every control has a role, a name and a state;
- a long press is also an action;
- a sheet takes focus at its title and escapes;
- a picture is labelled or hidden;
- a group has a label;
- nothing is said twice.

A screen's own section adds only what departs from this.

## 5. Parity as a test

**`src/play/reader-play.test.ts`**
- It plays seeded games of scenario 1, one sea or Island Map scenario and one Wilderland scenario, using only what a reader can reach. At each state:
  1. it builds the reader table's rows (section 2) and the tray's rows (section 3);
  2. it checks that **every intent `legalIntents` offers** is reachable through a labelled element: a card button whose tap leads to it (`tapAction`, `playSheet`), a tray row, or a dock button;
  3. it picks one of those elements and dispatches its intent.
- It reuses the seeded driver from `scripts/card-smoke/run.ts`. It fails on the first intent with no labelled path, naming the window and the intent.

**`pnpm test:scenario <id>`** runs the reader check on the scenario (`README.md`, Commands), so every new scenario keeps parity.

**Maestro**
- `.maestro/features/screen-reader.yaml` opens the table with the reader table forced and plays one round by the reader table's testIDs.
- The forcing is a development override: `useReaderMode` reads `EXPO_PUBLIC_FORCE_READER` (`useScreenReader` does not). Maestro cannot turn VoiceOver on. The flow carries the `reader` tag, which `.maestro/config.yaml` excludes, so the release e2e run leaves it out.
- It does not run in the cloud. `scripts/checks/maestro.test.ts` checks its ids.

**Docs**
- `README.md`, Commands.
- `docs/phases/STATUS.md`, as open phone checks: a full scenario 1 game with VoiceOver and with TalkBack, without looking; building a deck; a booklet page; the Maestro flow.
- When the work is done, this plan moves to `docs/plans/done/`.

## Verification

**After each section.** `pnpm lint`, `pnpm typecheck`, `pnpm vitest run <touched tests>`, then `pnpm test:changed`.

**Independence check.**
- Every existing test, golden, fixture and Maestro flow passes unchanged. `git diff origin/main -- '*.test.ts' .maestro src/campaign/fixtures` shows only new files and moved announce imports.
- Web screenshots (the `run` skill) of the hub, the deck editor and the table are taken before and after the plan, and match.
- `useReaderMode()` returns false on web and with no reader on, which a test in `screen-reader.test.ts` checks.

**Once at the end.** `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm data:check` and `pnpm docs:index`. Report each command and its result. `reader-play.test.ts` and `a11y.test.ts` are the parity gates.

**Web check with the `run` skill.** Run Expo web; the web build already reports a screen reader. Playwright's `page.accessibility.snapshot()` on:
- the hub, a briefing, the deck editor and the card pool with its filter sheet;
- the table in a planning window, a quest commit and a defender pick.

It asserts that every button has a name and every pick row a role.

**On a phone.** This stays open in `docs/phases/STATUS.md`.
