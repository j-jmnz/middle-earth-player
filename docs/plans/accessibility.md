# Plan: accessibility

## Context

The user asked for an accessibility audit of the whole app (2026-11-01). This plan holds what it found and the fixes, grouped so each section can go to one implementer. The standard is WCAG 2.2 AA applied to native mobile, with VoiceOver and TalkBack practice. Each finding was read in the code. None has been tried on a phone, and the ones marked *device* depend on how React Native behaves there; check them with VoiceOver and TalkBack before closing them.

Findings cite a file and the component or function. Severity: **Blocker** means a screen-reader or switch user cannot finish the task; **Major** means the task is hard or the content is lost; **Minor** is everything else.

What already holds, and stays: every target has a 44 pt floor (`touch()`, `min-h-touch`, hit slop); OS font scaling is never turned off and multiplies with the UI scale; buttons, tabs, switches, segmented controls and radios carry roles and states; icon buttons and actions on saved things name what they act on; decorative pictures are hidden; Delete asks in place and is announced; motion runs through `useMotionScale` and snaps under Reduce motion; the combat spotlight is off with Reduce motion or a screen reader; with a screen reader on, choices open as listed rows and the armed bar waits 10 s; colour is never the only cue for Won, Lost, Locked or Selected.

## Decision for the user

- **Orientation (WCAG 1.3.4).** Phones are portrait-only off the table and the table is landscape-only (`docs/brief.md`, Performance and feel; `src/screens/routes/_layout.tsx`). 1.3.4 allows a lock only where the orientation is essential. A phone fixed to a wheelchair mount in landscape cannot use the hubs. Options: let hubs rotate on phones, or keep the lock and record in the brief why it is essential.

## 1. The table without sight

The table cannot be played with a screen reader today. This section comes first.

- **Blocker. Hand cards cannot be played (2.1.1, 4.1.2).**
  - The action window (Planning included) is never listed for a reader:
    - `useTableChoice` (`src/play/use-table-choice.ts`) leaves out `sheet.kind === "window"`.
    - `trayTiles` (`src/play/tray-logic.ts`) returns no tiles for a window.
    - `dockExtras` (`src/play/dock-extras.ts`) offers List only for a quest commit.
  - `sheet.plays` is reached only by tapping the canvas, and `ReaderPiles` (`src/play/reader-piles.tsx`) never gives a hand card a button.
  - `docs/design-system-table.md`, Hold, slide and release, promises the list path; the code does not provide it.
  - Fix: add a Play (n) pill beside Actions (n) that lists `plays` as rows and routes each row through the same tap.
- **Blocker. Most of the board is pixels only (1.1.1, 1.3.1).**
  - The canvas's `spoken` (`src/play/table-canvas.native.tsx`) returns a label only for the Havens Burn, grapples, Ship losses and the Stormcaller. `AreaSummary` covers only a split staging area.
  - A reader cannot reach any of this outside a choice:
    - heroes and allies, with their damage, resources and exhausted state
    - engaged enemies, with their stats and damage
    - attachments
    - quest progress
    - the active location
    - staging
  - Fix: while a screen reader is on, render a reader list of every zone: a header per zone, then one row per card ("Aragorn, hero, exhausted, 2 damage, 3 resources, Steward of Gondor attached"). Each row opens the preview. `info()` and `useViews` already hold the numbers.
- **Blocker. The card preview reads as one button (4.1.2).** In `CardPreview` (`src/play/card-preview.tsx`) the full-screen scrim is a Pressable that wraps the name, the notes, the "with it" rows and Details. On iOS all of it is hidden behind "Close the preview". The same component serves the Cards tab and Decks. Fix: make the scrim a sibling behind the content, as `PopoverFrame` does, with `accessibilityRole="button"`.
- **Major. Switch and keyboard users get the canvas (2.1.1, 2.5.7).** `useScreenReader` turns on the listed path only for VoiceOver and TalkBack. Fix: add a table setting, "List choices", that forces the same path.
- **Major. Reading a row's card needs a long press (2.5.1).** `Tile` rows (`sheet-paper.tsx`) ("Hold to read the card"), grid cells, list rows and hero tiles preview only on a long press. Fix: add `accessibilityActions` with a `longpress` action labelled "Read the card" or "Show large", and handle it.
- **Minor.**
  - The Life, Tokens and Burden dials are announced as dimmed: the top-bar dial in `table-chrome.tsx` passes `disabled` when there is no `onPress`. Render a View instead.
  - Deck piles have a button role but do nothing (`reader-piles.tsx`).
  - Every playable discard-pile card is announced as "selected" (`reading-panels.tsx`).
  - Multi-pick rows should be checkboxes with `checked` (`sheet-paper.tsx`).
  - The armed hint "Tap twice to confirm" clashes with VoiceOver's double tap. Say "Activate again to confirm", and announce "Cancelled" when the armed state times out (`dock-buttons.tsx`).
  - The table has no busy state while loading (`table-loading.tsx`).

## 2. Announcements and status messages (4.1.3)

- **Major. The table.**
  - A refusal is shown in red and a haptic tick, and nothing is announced (`table-dock.tsx`).
  - A new moment's title, a phase change (the sweep is hidden) and a threat change are silent.
  - Fix: announce the refusal, then the moment's header when the sheet key changes, the phase when it changes and `threatDeltaWords`. Queue them behind the banner.
- **Major. The screens.** Errors that appear in a pinned bar without a word:
  - the Deal error and the validator's problems (`briefing-parts.tsx`)
  - the Resolution's refusal
  - the XP refusal
  - deck import's "That is not a RingsDB decklist." and "Importing from RingsDB…" (`deck-import.tsx`)

  Announce each one, and tie the import error to its field.
- **Major. Undo toasts run out (2.2.1).** `toastDuration` (`src/screens/toast.ts`) gives 10 s with a screen reader and 5 s otherwise; a switch user counts as otherwise. The toast sits after a long list in the reading order. Fix: while assistive tech is on, a toast with Undo stays until dismissed. Give the toast an Undo accessibility action. Otherwise use `getRecommendedTimeoutMillis`.
- **Minor.**
  - Android says every toast twice: `ToastView` has both `announceForAccessibility` and a live region.
  - The moment banner closes on its timer even with a screen reader on (`table-hooks.ts`).
  - These change silently:
    - match counts (`card-pool.tsx`, `deck-list-bar.tsx`, rules search)
    - the deck's readiness line
    - Accept +N threat and Undo last choice in the briefing
    - Restore defaults in Settings
    - "Loading" turning into the path or the log

## 3. Focus and modals (2.4.3, 2.1.2)

- **Major. TalkBack escapes overlays.** `accessibilityViewIsModal` works on iOS only. `TableView` hides the table behind the menu and More, but not behind the preview, the quest advance screen, the phase carousel or a reading panel. Add those to its `no-hide-descendants` condition.
- **Major. Panels open without moving focus.** On open, focus goes to the header; on close it returns to the opener; `onAccessibilityEscape` closes. Apply this to:
  - `TrayFrame` (Log, Threat, discard, Settings, Island Map)
  - `QuestAdvanceView` (Escape is Progress when it asks nothing)
  - `PhaseCarousel`: its modal flag sits on the inner panel, so the top bar and the dock stay reachable on iOS too. Move it to the outer layer.
  - `PopoverFrame` (focus already moves in)
  - `SheetModal`: its scrim is first in the swipe order. Put it last.
- **Major. Back comes last.** In the briefings (`BriefingScreen`, `briefing-parts.tsx`) and the deck editor (`deck/[id].tsx`) the NavBar is rendered after the list and the action bar. Render it first and keep it on top with `zIndex`. Give the deck editor a header with the deck's name.
- **Major. Focus is lost when the control under it goes away.** This happens when:
  - picking a deck folds the seat's list
  - picking a Ring-bearer
  - Archive or Keep in History
  - a briefing choice
  - the filter sheet changes panel (`pool-filter-sheet.tsx`)
  - Settings' Restore defaults
  - a jump chip in the deck editor

  Fix: set focus on what replaces it, or announce what happened.

## 4. Names, roles and grouping (4.1.2, 1.3.1, 1.1.1)

- **Blocker. The −/+ in Add cards' list are unreachable.** `ListRow` (`chrome-frame.tsx`) draws `trailing` inside its Pressable, and the pool list row (`pool-cards.tsx`) passes a `CountStepper` there. List is the default view while adding. Fix: render interactive trailing content as a sibling of the Pressable, or give the row increment and decrement actions.
- **Major. Inline game icons drop out of card and rule text** *(device)*. `CardTextView` puts labelled `GameIcon`s inside a `Text`, which reads only its string ("Add 1 ."). Fix: give each paragraph an `accessibilityLabel` built from its runs, using an icon's word.
- **Major. TalkBack cannot read the booklet.** `BookletPdfView.kt` draws bitmaps with no `contentDescription`. Fix: name the page ("Page 4 of 32") and expose its extracted text. On iOS, check that `PDFView` reads the text layer.
- **Major. The path's action is only in the hint.** A stop (`path-road.tsx`) reads "A Shadow of the Past, Next". Fix: put Begin or Resume in the label. A won stop gets `expanded`, and its summary is announced or focused.
- **Major. Hero tiles hide the sphere and the Ring-bearer.** Dense tiles in the seat picker (`hero-tile.tsx`) do this. Fix: one label per tile: name, sphere, Ring-bearer.
- **Minor.**
  - Fold headers miss heading navigation. `FoldHeader` puts `header` on a wrapper View that is not an element *(device)*. Put the role on the Pressable and drop the extra announce.
  - Section overlines are not headings: `Eyebrow` for Other journeys, New playthrough, Pool, XP, Completed.
  - Unnamed groups:
    - the Difficulty and standalone Players radio groups
    - the Grid/List and Cards/List switches
    - the campaign log's notes field (placeholder only)
  - Resolution radios say "selected" twice and lack `checked`. Their radiogroup wraps the whole screen. Deck radios lack `checked` too.
  - The sphere filters are radios that can be cleared, and the chooser rows lack `selected`.
  - Label and value are read apart: log rows, Scenarios Completed, encounter set counts, and deck section counts.
  - Grid cells say their name and count twice.
  - Missing from labels:
    - Unique (`card-detail.tsx`, `poolDetail`)
    - pack rows give a card code instead of the card's detail
    - scenario tiles drop Won/In progress and the number
    - the Decks tab's not-ready dot (`tabBarAccessibilityLabel`)
  - The + at the copy limit is `disabled` but still acts (`count-stepper.tsx`). Keep it enabled, with a hint.
  - Deck import's field wants `returnKeyType="go"`, `onSubmitEditing` and `keyboardType="url"`.

## 5. Text size (1.4.4, 1.4.10)

Text grows with the OS size, but fixed boxes do not. Nothing reads `fontScale`, and the UI scale stops at 1.15.

- **Major. Fixed boxes clip text.**
  - `Chip` (`h-6`), `ToggleChip` (36 pt), the Filter badge, the peek pill (36 pt), the armed line's box (`dock-buttons.tsx`), the deck cell stepper, and the 64 pt Undo slot on XP.
  - Fix: `minHeight` plus padding.
- **Major. The dock and the canvas ignore the OS size.**
  - `dock-budget.ts` budgets lines in points.
  - `table-fonts.native.ts` draws names at 10–12 pt times the UI scale.
  - Fix: fold `PixelRatio.getFontScale()` (capped) into both, and let the dock scroll.
- **Major. The path's road overlaps at large text.** Its fixed `LABEL` makes names overlap the next stop. Derive it from the font scale, or use a list over about 1.3×.
- **Minor.**
  - About 30 `numberOfLines={1}` cut text: NavBar and hub titles, Segmented options ("Follow system", "Two-handed").
  - The tab labels shrink back with `adjustsFontSizeToFit`.
  - The peek banner caps scaling at 1.3.
  - Text sizes of 9 to 11 pt (stat captions, `text-micro`, eyebrows) drop below 10 pt at Small. Set a floor of 11 pt at every scale.

## 6. Contrast and visible state (1.4.3, 1.4.11, 2.4.7)

Ratios are computed with `contrast.test.ts`'s formula over the real surfaces in both themes.

| Theme | Pair | Ratio | Needs | Where |
| --- | --- | --- | --- | --- |
| Light | muted over the night scrim on dark art | 3.5 | 4.5 | hero tile loss line, `RunHero` detail |
| Light | bone eyebrow over the 50% glow on dark art | 3.4 | 4.5 | `RunHero` overline |
| Dark | muted over the night scrim on bright art | 3.9 | 4.5 | hero tile loss line |
| Light | faint placeholder on a tonal field | 4.2 | 4.5 | search and import fields |
| Light | muted / faint at `dim` 0.75 | 3.9 / 3.0 | 4.5 | `SettingSwitch` dimmed row |
| Both | inkMuted on the parchment rim | 2.7–2.8 | 4.5 | paper sheet edge (`surfaces.ts`) |
| Both | selected segment / chip-on vs its track | 1.1–1.5 | 3 | `Segmented`, `ToggleChip` |
| Both | switch off track, field fill, hairline vs night | 1.1–1.5 | 3 | `SettingSwitch`, fields, locked ring, dial edge |
| Dark | accentLine on raisedTop | 2.9 | 3 | dashed slots on panels |

- **Major. Light has no shadow under text on art.** `useTitleShadow` returns none for Light, and the scrims thin where large text grows. Fix: give small text on art a solid plate (as `Chip onArt` does), or make the scrim solid behind the text block.
- **Major. Selected state rests on a fill.** Fix: ring the selected segment and chip with `accentLine` or `selectedRingOf`, or add a check.
- **Major. No visible focus.** No shared button draws focus for a hardware keyboard (2.4.7). Fix: keep `focused` through `onFocus` and `onBlur` in `buttons.tsx`, `chrome-buttons.tsx`, `tab-bar.tsx` and `ListRow`, and draw the selected ring.
- **Minor.**
  - Fields need a 1 pt `accentLine` edge.
  - Placeholders should use muted.
  - Dim only a switch's knob, never its words.
  - Hairline graphics should use `accentLine` or faint.
  - Extend `contrast.test.ts` to the pairs above: faint and `ok` on tonal fills, the parchment rim, dim, scrims over art, and non-text pairs.
  - Read iOS Increase Contrast into a stronger token set.

## 7. Motion, language and tests

- **Minor.**
  - Stack push and pop and the deck screen's `SheetModal` fade ignore the in-app Reduce motion "Always". Pass `animation: "none"`.
  - No language is declared. Set `CFBundleLocalizations: ["en"]` so VoiceOver uses an English voice on a phone set to another language.
  - `DatabaseError` shows the raw error with no Retry (3.3.3).
- **Process.**
  - No test asserts roles or labels, and Maestro selects by testID. Add tests for the shared chrome: tab bar, buttons, toast, `SheetModal`, `ListRow`'s trailing content, and the reader list from section 1.
  - Leave the VoiceOver, TalkBack and Switch Access walkthroughs of the table open in `docs/phases/STATUS.md` until they are run on a phone.
