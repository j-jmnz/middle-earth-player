# Accessibility

The app aims to be playable without sight, with low vision, with limited hand movement, with colour-vision differences and without quick reactions. Where it falls short, that is a bug (see Reporting a barrier).

## Target

The app aims at [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA, as [WCAG2Mobile](https://www.w3.org/TR/wcag2mobile-22/) applies it to native apps, and at the [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/). No third party has audited it, and it makes no claim of conformance to either. The checks that run on every change are listed under Automated checks.

## What the app supports

- **Screen readers.** VoiceOver and TalkBack can play a full game. When a reader is on, the game table is replaced by a scrolling list of zones and cards. Each card's label gives its whole state (damage, resources, progress, attachments, effect modifiers), and its hint says what a double tap does. Each long press is also offered as a reader action. Each new moment and each refused move is announced in order, so one line never cuts off another. The rules for the labels are in [docs/design-system.md](docs/design-system.md) and [docs/design-system-table.md](docs/design-system-table.md), Screen reader.
- **The table as a list.** Settings, At the table, Table as a list set to Always gives the list table on the phone without a screen reader on, for Switch Control, Voice Control or Switch Access, or for anyone who prefers it. The default, Follow screen reader, uses it only while a reader is on.
- **Text size.** Every screen's text follows the phone's text size. UI scale (Small, Medium, Large, Extra large) sizes text, buttons and cards, the table's drawing included. Every control has a 44 pt target at every size.
- **Contrast and display.** Strong outlines (Follow system, Always, Off) thickens effect marks and token counts, and Follow system turns it on with iOS Increase Contrast or Android High contrast text. On iOS the app also follows Reduce Transparency, which draws floating panels opaque, and Bold Text, which draws text one weight heavier. Theme offers a dark and a light theme or follows the device. Title face (Carved, Plain) swaps the carved titles and numbers for the plain text face. The game's colours are tested to stay apart under protanopia, deuteranopia and tritanopia, and sphere colours are always paired with their icons.
- **Motion.** Reduce motion (Follow system, Always) snaps animations and stops the fog and the combat replay. Animation speed (Normal, Quick, Slow) and Combat spotlight can be set on their own. Banner closes (After a few seconds, When tapped) lets the banner on each new moment wait for a tap.
- **Timing.** The game has no turn timer. A button that asks for a second tap waits 3 seconds, or 10 with a screen reader. Confirm time (Standard, Long, No limit) changes that, and No limit waits until you tap again or choose something else.
- **Haptics.** Haptics turns the vibration at key moments off.
- **Reordering decks.** While Manage is open on Decks, each deck has Move up and Move down buttons as well as the drag.
- **Plain words.** Choices are written as short sentences.

All of these are in Settings, and the table's settings panel has the same rows. Restore defaults resets them.

## Automated checks

`scripts/checks/a11y.test.ts` fails on a control with no role or name, a long press with no matching action, an unlabelled text field, or an image that is neither labelled nor hidden. Other tests cover the colour-vision pairs and the layout at large text sizes. `pnpm a11y:web` (a job of its own in CI) exports the web build and audits the main screens with axe-core in Chromium, in both themes, and fails on a serious or critical finding. It checks the names, roles and states the web build gives a reader, not what VoiceOver or TalkBack do. The Label in Name finding it still reports (a button's name leaves out text drawn on it) is listed in `scripts/checks/a11y-web.ts`.

## Known gaps

- **Hardware keyboard.** The table has no keyboard control and no focus ring. Switch and voice control work through the list table.
- **The web build** (development only) has no reader mode, so the table there is the drawn one.
- **The table's own drawing** follows UI scale but not the phone's text size or Bold Text. The list table, every other screen and the card previews do follow them.
- **Colour.** Sphere colours alone are not enough to tell the spheres apart for some colour-vision types. The icon beside each one is what carries it.

## Reporting a barrier

[Open an accessibility issue](https://github.com/j-jmnz/middle-earth-lcg/issues/new?template=accessibility.yml) and say the device, the system version, the assistive technology and its version, the screen, what happened and what you expected. A barrier is treated as a bug, not a feature request. This is a volunteer project, so there is no fixed response time.
