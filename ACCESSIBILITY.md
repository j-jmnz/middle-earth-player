# Accessibility

The app should be playable without sight, and with low vision, limited hand movement, colour-vision differences or slow reactions. Anything that gets in the way is treated as a bug; see Reporting a barrier below.

## Target

The app aims for [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA, as [WCAG2Mobile](https://www.w3.org/TR/wcag2mobile-22/) applies it to native apps, and for the [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/). No third party has audited it, so it makes no claim of conformance. Checks run on every change; see Automated checks.

## Supported features

- You can play a full game with VoiceOver or TalkBack. With a screen reader on, the table becomes a scrolling list of zones and cards. Each card's label gives its full state (damage, resources, progress, attachments and effect modifiers), and its hint says what a double tap does. Anything you can long-press is also available as a reader action. New moments and refused moves are announced in order, without cutting each other off. The labelling rules are in the Screen reader sections of [docs/design-system.md](docs/design-system.md) and [docs/design-system-table.md](docs/design-system-table.md).
- On Windows, macOS and Linux, the desktop app works with the keyboard and the mouse. Tab, Shift+Tab, Enter and Space move through and press every control outside the drawn table, with a visible focus ring. At the drawn table, Escape closes the top panel, preview or banner and Z (or Ctrl+Z, or Cmd+Z on a Mac) is Undo, wherever the focus is; resting the mouse over the hand lifts a card, the wheel steps through it, a click plays or picks it and a right click opens its preview. The booklet reader pages with Page Up, Page Down, the arrow keys, Home and End, and zooms with + and -. Instructions on the desktop say Click where the phone says Tap.
- The desktop app follows the screen reader the system runs: NVDA or Narrator on Windows, VoiceOver on a Mac, Orca on Linux. Electron tells the app when the system's assistive technology is on, and with Table as a list at Follow screen reader the table then becomes the list, as on a phone. If your reader is not detected, set Table as a list to Always. The project has not tested the desktop app against these four readers yet; reports are welcome.
- Under Settings, At the table, set Table as a list to Always to use the list table without a screen reader, whether for Switch Control, Voice Control, Switch Access or simply because you prefer it. The default, Follow screen reader, shows the list only while a reader is on.
- Text follows your phone's text size up to 200% on every screen. The list table, dock, choice options and card preview all grow with it. The drawn table follows UI scale only, so for larger text there, use Table as a list or the card preview. UI scale (Small, Medium, Large or Extra large) sizes text, buttons and cards, the drawn table included. Every control keeps a 44 pt touch target at every size.
- Strong outlines (Follow system, Always or Off) thickens effect marks and token counts. With Follow system, it turns on when iOS Increase Contrast or Android High contrast text is on. On iOS, Reduce Transparency makes floating panels opaque, and Bold Text draws text one weight heavier. The theme can be dark, light or follow the device. Title face (Carved or Plain) swaps the carved titles and numbers for a plain typeface. The game's colours are tested to stay distinct under protanopia, deuteranopia and tritanopia, and sphere colours always come with their icons, including in the deck donut's legend.
- Reduce motion (Follow system or Always) makes animations snap into place and stops the fog and the combat replay. Animation speed (Normal, Quick or Slow) and Combat spotlight are separate settings. Banner closes (After a few seconds or When tapped) lets each new-moment banner wait for your tap.
- There is no turn timer. Buttons that need two taps wait 3 seconds for the second one, or 10 seconds with a screen reader. Confirm time (Standard, Long or No limit) changes this, and No limit waits until you tap again or choose something else.
- The Haptics setting turns vibration off.
- When Manage is open on the Decks screen, each deck has Move up and Move down buttons, so you don't have to drag.
- Choices are written as short, plain sentences.

All of these settings are in Settings and in the table's settings panel, and Restore defaults resets them.

## Automated checks

`scripts/checks/a11y.test.ts` fails on a control without a role or name, a long press without a matching reader action, an unlabelled text field, or an image that is neither labelled nor hidden. Other tests cover the colour-vision pairs and the layout at large text sizes. `pnpm test a11y`, which runs as its own CI job, audits the main web screens with axe-core in Chromium in both themes and fails on any serious or critical finding. It checks the names, roles and states the web build exposes, not how VoiceOver or TalkBack behave. The Label in Name findings it still reports are listed in `scripts/checks/a11y-web.ts`; Known gaps explains them.

## Known gaps

- At 200% text on a phone less than 400 pt tall, with a choice open, the dock still fits at Medium UI scale: it keeps its title, buttons and one row in view, and the reading aids, Undo included, move behind More. At Large and Extra large it doesn't fit. Use a smaller UI scale or Table as a list.
- In the same case, the dock's own buttons are taller than the space under the top bar: a long word on the main button wraps onto three lines, and the other answers take a second row. So with the options open, the dock overlaps the top bar. A taller screen fits it.
- With a hardware keyboard, the drawn table can't take keyboard focus. Use Table as a list instead, where rows, the tray and the dock buttons take focus with a visible ring. On Android, the web and the desktop, Escape closes the top panel, preview or banner, and Z (or Ctrl+Z) is Undo, wherever the focus is. A mouse works the drawn table too: resting over the hand lifts a card, the wheel steps it, a right click opens a card's preview. On iPhone and iPad the keys do nothing yet, but Tab and Full Keyboard Access move focus, and Space or Enter presses. Switch and voice control work through the list table.
- The web build draws the table on a canvas like the phone, once its CanvasKit has loaded; a browser cannot tell that a screen reader is running, so a reader there sets Table as a list to Always for the list table (`src/play/canvas/reader-table.tsx`). It makes no reader announcements or focus moves, so those can only be checked on a phone.
- The web booklet reader (`src/screens/booklets/web/reader.tsx`) draws each page on a canvas: a screen reader hears the page number ("Page 3 of 36", also on a live region) and the Previous, Next, Zoom out and Zoom in buttons, not the page's text. The page region takes keyboard focus; Page Down, Right arrow and Space turn forward, Page Up, Left arrow and Shift+Space back, Home and End go to the ends, and + - 0 zoom. The phone's native readers (PDFKit, `PdfRenderer`) are unchanged.
- The screen reader labels and hints keep the phone's wording on every platform, so on the desktop a card's hint still says "Double tap to show the card" where a click or Enter is meant.
- Label in Name (WCAG 2.5.3): spoken names start with the visible words, as in "Scenario 1, A Shadow of the Past, 3 quest stages", "Threat 20, P1, acting" or "Planning, round 1". axe still flags a few screens, because react-native-web joins sibling text without spaces ("1A Shadow of the Past3 quest stages", "20P1"). The wording itself is correct.
- The drawn table follows UI scale, but not the phone's text size or Bold Text. Everything else follows both.
- For some types of colour vision, sphere colours alone don't tell the spheres apart. The icon beside each one does.

## Reporting a barrier

[Open an accessibility issue](https://github.com/j-jmnz/middle-earth-player/issues/new?template=accessibility.yml) and include your device, its OS version, the assistive technology you use and its version, the screen you were on, what happened and what you expected. Barriers are treated as bugs. This is a volunteer project, so there is no fixed response time.
