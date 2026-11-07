# Accessibility

The app should be playable without sight, with low vision, limited hand movement, colour-vision differences or slow reactions. A shortfall is a bug (see Reporting a barrier).

## Target

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA as [WCAG2Mobile](https://www.w3.org/TR/wcag2mobile-22/) applies it to native apps, and the [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/). Not audited by a third party; no conformance claim. Checks run on every change (Automated checks).

## What the app supports

- VoiceOver and TalkBack can play a full game. With a reader on, the table becomes a scrolling list of zones and cards. Each card's label gives its full state (damage, resources, progress, attachments, effect modifiers); its hint says what a double tap does. Long presses are also reader actions. New moments and refused moves are announced in order, without cutting each other off. Label rules: [docs/design-system.md](docs/design-system.md) and [docs/design-system-table.md](docs/design-system-table.md), Screen reader.
- Settings, At the table, Table as a list: Always shows the list table without a reader (for Switch Control, Voice Control, Switch Access or preference). The default, Follow screen reader, shows it only with a reader on.
- Text follows the phone's text size up to 200% on every screen. The list table, dock, choice options and card preview grow with it; the drawn table follows UI scale only, so use Table as a list or the card preview for larger text. UI scale (Small, Medium, Large, Extra large) sizes text, buttons and cards, including the drawn table. Every control has a 44 pt target at every size.
- Strong outlines (Follow system, Always, Off) thickens effect marks and token counts; Follow system turns it on with iOS Increase Contrast or Android High contrast text. On iOS, Reduce Transparency makes floating panels opaque and Bold Text draws text one weight heavier. Theme: dark, light or device. Title face (Carved, Plain) swaps the carved titles and numbers for the plain face. Game colours are tested to stay distinct under protanopia, deuteranopia and tritanopia, and sphere colours always come with their icons, including the deck donut's legend.
- Reduce motion (Follow system, Always) snaps animations and stops the fog and combat replay. Animation speed (Normal, Quick, Slow) and Combat spotlight are separate settings. Banner closes (After a few seconds, When tapped) can make each new-moment banner wait for a tap.
- No turn timer. Two-tap buttons wait 3 seconds for the second tap, 10 with a screen reader. Confirm time (Standard, Long, No limit) changes this; No limit waits until you tap again or choose something else.
- The Haptics setting turns vibration off.
- With Manage open on Decks, each deck has Move up and Move down buttons as well as drag.
- Choices are short, plain sentences.

All of these are in Settings and in the table's settings panel. Restore defaults resets them.

## Automated checks

`scripts/checks/a11y.test.ts` fails on a control without a role or name, a long press without a matching action, an unlabelled text field, or an image neither labelled nor hidden. Other tests cover the colour-vision pairs and layout at large text. `pnpm a11y:web` (its own CI job) audits the main web screens with axe-core in Chromium, in both themes, and fails on a serious or critical finding. It checks the names, roles and states the web build exposes, not VoiceOver or TalkBack behaviour. The Label in Name findings it still reports are listed in `scripts/checks/a11y-web.ts` (see Known gaps).

## Known gaps

- 200% text on a phone under 400 pt tall, with a choice open: at Medium UI scale the dock keeps its title, buttons and one row in view (reading aids, Undo included, move behind More); at Large and Extra large it does not. Use a smaller UI scale or Table as a list.
- Same case: the dock's own buttons (a long main-button word wraps to three lines, other answers take a second row) are taller than the space under the top bar, so with the options open the dock overlaps the top bar. A taller screen fits it.
- Hardware keyboard: the drawn table has no keyboard focus; use Table as a list, where rows, tray and dock buttons take focus with a visible ring. On Android, Escape closes the top panel, preview or banner, and Z (or Ctrl+Z) is Undo. On iPhone and iPad these keys do nothing yet; Tab and Full Keyboard Access move focus, Space or Enter presses. Switch and voice control work through the list table.
- The web build (development only) has no drawn table; it lists each zone's cards by name (`src/play/canvas/table-canvas.tsx`). It has no reader announcements or focus moves, so those are checked on the phone only.
- Label in Name (WCAG 2.5.3): spoken names start with the visible words ("Scenario 1, A Shadow of the Past, 3 quest stages", "Threat 20, P1, acting", "Planning, round 1"). axe still flags a few screens because on react-native-web it joins sibling text without spaces ("1A Shadow of the Past3 quest stages", "20P1"). The wording is correct.
- The drawn table follows UI scale but not the phone's text size or Bold Text. Everything else does.
- Sphere colours alone don't separate the spheres for some colour-vision types; the icon beside each one does.

## Reporting a barrier

[Open an accessibility issue](https://github.com/j-jmnz/middle-earth-lcg/issues/new?template=accessibility.yml) with the device, OS version, assistive technology and version, the screen, what happened and what you expected. Barriers are treated as bugs. Volunteer project: no fixed response time.
