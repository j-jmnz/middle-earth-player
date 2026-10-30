# Board UX: motion, focus and a quieter table

User request, 2026-10-26. This plan reworks the landscape table described in `docs/design-system-table.md` (). It does not change a rule. The engine still computes every number, the table only offers legal choices, and an animation never gates a rule or input. The work is split into phases 18 to 26 (`docs/phases/`). In every phase the `implementer` agent runs on Sonnet 5.5 (`model: "sonnet"`), then `reviewer` and `ux` review the diff.

## The user's list

1. Animations are too fast. Make them last a little longer, but do not make the app feel sluggish. (Phase 23)
2. Make the animations more fun, more obvious and more like a game. (Phase 23)
3. Combat: when an enemy attacks a player card or a player card attacks an enemy, bring both to the center, enlarge them, darken the background and animate the attack with the damage tokens. Keep it short. (Phase 24)
4. Two-handed play: let the player peek at the other seat and make clear it is not the seat acting. The player moves between seats by tapping the threat dials. (Phase 26; user decision: show the whole seat)
5. The board is too cluttered. Keep only essential information. (Phase 22)
6. Improve the round and phase indicator. A tap shows the phases before and after. (Phase 20)
7. The sheet that slides in from the right does not fit the rest of the design. It shows too much and repeats the dock's buttons. Simplify it. (Phase 21; user decision: a night tray over the dock)
8. Holding the hand enlarges it. Sliding left and right moves through the cards, and letting go on a card opens its preview. (Phase 25; user decision: the hand, not the player deck, which is hidden)
9. The glow border does not follow the card's tilt. (Phase 18)
10. Replace Look at the table with a tap outside the container. (Phase 21)
11. Put Back to scenarios, Log, Rules and Booklet in a menu at the top right. (Phase 19)
12. Threat dials go at the top left. (Phase 19)
13. The phase carousel goes at the top middle. (Phases 19 and 20)

## What the table does now

Measured on `main` at `01b0714`:

- **Top bar** (`src/screens/table-view.tsx:194-223`): Back, one threat dial per seat, Life, Burden, the phase rail, Round N, Log, Rules, Booklet.
- **Command column** (`table-view.tsx:248-277`): the quest band, an "Active: …" line, a Ring-bearer line and the dock (`src/play/table-dock.tsx`). The dock holds:
  - the step, the moment, a scrolling note with guide lines, the readout, the picked cards, a refusal;
  - the armed line, the gold pill, a row of answers and a row of reading pills.
- **Choice panel** (`SidePanel`, `src/play/table-panel.tsx:42-142`): paper, 46% of the width (320 to 480 pt), anchored to the right and the bottom.
  - It covers the whole command column and about 135 pt of the canvas on an 844 pt phone, including the encounter deck and the right end of every row.
  - It repeats the step, the moment, the readout and the whole of `DockButtons` in ink.
  - "Look at the table" (`sheet-collapse`) folds it; `Choose` brings it back.
- **Glow**:
  - `Glow` is drawn inside `Moving`'s rotated group, so it turns with the card.
  - The gold edge, the picked edge, the veil and the beat ring are drawn on `slotBounds(slot)` (`src/play/layout.ts:337`), which ignores `tilt`.
  - A fanned hand card therefore has a straight frame on a tilted picture, and `hitSlot` ignores the tilt too.
- **Two-handed play**: `shownSeat(game)` (`src/play/selectors.ts:189`) is `game.activeSeat`. Nothing in the UI shows the other seat's hand or play area.
- **Piles**: a tap or a long press on the player deck or the encounter deck does nothing (`table-view.tsx:125-127`).
- **Motion** (every value is a local literal; there are no motion tokens):

  | Motion | Value |
  | --- | --- |
  | Card move (`MOVE_MS`) | 320 ms ease-out cubic |
  | Drag lift | 90 ms |
  | Drag return | 160 ms |
  | Preview | spring in, 150 ms out |
  | Sheets | 220 ms in, no exit |
  | Rail fade | 180 ms |
  | Threat badge | 160 / 400 ms |
  | Dial pop | 140 ms, then a spring |
  | Banner fade | 200 ms |
  | Banner beats | 650 ms |
  | Toast | 160 / 120 ms |

  - Every motion snaps under reduced motion.
  - Nothing flips, staggers, overshoots or reacts on impact.

## Research

Sources the plan follows.

**Timing**
- UI motion sits between 100 and 500 ms, mostly 200 to 400 ms. 500 ms or more feels like a drag.
- Motion people see often should be shorter, and things that appear take a little longer than things that leave (300 in, 200 to 250 out). Animations are far more often too long than too short. ([NN/g](https://www.nngroup.com/articles/animation-duration/))
- Mobile transitions are about 300 ms: entering 225, leaving 195, large 375. Over 400 ms feels slow.
- Arrivals decelerate and exits accelerate. Duration grows with distance. ([Material motion](https://m1.material.io/motion/duration-easing.html), [M3 tokens](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md))
- People need about 230 ms to perceive a motion, so motion under 200 ms can go unseen. This is why the table's 160 to 220 ms motions read as "too fast". ([Val Head](https://valhead.com/?p=2978))
- Items in a sequence are staggered 50 to 100 ms, overlapping. ([LogRocket](https://blog.logrocket.com/css-staggered-animations/), [Flutter](https://docs.flutter.dev/cookbook/effects/staggered-menu-animation))

**Game feel**
- The game answers input within about 100 ms. ([Swink, *Game Feel*](https://lizengland.com/blog/review-game-feel-by-steve-swink/))
- "Juice" is tweens and easing added to a working game, then impact. ([Jonasson & Purho](https://rpgplayground.com/research-making-a-juicy-game/))
- Impact reads through anticipation, a short hit pause and a small shake that dies away fast. ([Nijman, The Art of Screenshake](https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog))
- A hit stop runs 50 to 120 ms, and the shake stays small. ([hit-stop guide](https://dev.to/saltmire/godot-4-screen-shake-and-hit-stop-in-one-script-11eh))

**Never block the player**
- Marvel Snap added fast forward for long chains. ([Twinfinite](https://twinfinite.net/2023/02/what-is-fast-forwarding-in-marvel-snap-explained/))
- MTG Arena's server runs ahead of its animations. ([MTGAZone](https://mtgazone.com/playing-a-match/))
- A game-speed option and a skip are basic accessibility. ([Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/?p=21))

**Reduced motion**
- Motion is never the only signal. Scaling, spinning and peripheral motion are cut or turned into a fade. ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/motion), [App Store criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria))
- In Reanimated, `ReduceMotion.System` jumps to the end value, and `useReducedMotion()` reads the setting at start. ([Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility))

**Digital card games**
- MTG Arena:
  - a phase strip lights the current phase, and a tap on a phase sets a stop;
  - the contextual buttons sit at the bottom right;
  - affordable cards are outlined;
  - a hover shows the card whole.
  - ([Hipsters of the Coast](https://www.hipstersofthecoast.com/2018/03/how-to-play-mtg-arena-the-in-match-screen/))
- Runeterra previews how the attacks will resolve before the player commits. ([Oracle's Eye](https://wiki.leagueoflegends.com/en-us/LoR:Oracle%27s_Eye))
- Hearthstone on phones:
  - the hand is a drawer and a hold shows a card full screen, which hides the board;
  - ready minions have a green frame, and exhausted ones show "zzz".
  - ([Trusted Reviews](https://www.trustedreviews.com/news/hearthstone-now-available-on-iphone-and-android-smartphones-2928657), [wiki](https://hearthstone.wiki.gg/wiki/Exhausted))
- Slay the Spire on phones: a tap to read a card can start a drag, and a card held under the finger cannot be read. Show the enlarged card above the finger, and keep tap and drag apart. ([TouchArcade](https://toucharcade.com/2020/06/15/slay-the-spire-ios-review-iphone-ipad-performance-icloud-megacrit-humble-games/))
- The Lord of the Rings: Adventure Card Game was criticised because new enemies and phases appear without warning, so announce a phase change. ([Nintendo World Report](https://nintendoworldreport.com/review/52300))

**Several players on one screen**
- Spirit Island's top complaint is that only one board can be seen at a time. A quick switch beats one-at-a-time viewing. ([Way Too Many Games](https://waytoomany.games/2020/11/29/review-spirit-island-digital-edition/))
- Board Game Arena separates the player whose turn it is from the player who must act now. ([BGA docs](https://be.doc.boardgamearena.com/Game_interface_logic:_yourgamename.js))

**Thumbs and screens**
- Only about a third of the screen is easy to reach, and the top corners are the hardest. Status you only read and the menu go at the top; the primary action and the hand go at the bottom. ([Hoober](https://alistapart.com/1-2-phone-grips-jpg/))
- Targets are at least 44 pt. ([WCAG 2.5.5](https://allaccessible.org/blog/wcag-258-target-size-minimum-implementation-guide))
- A modal sheet with low stakes closes on a tap outside. ([Material](https://developer.android.com/reference/kotlin/androidx/compose/material3/ModalBottomSheetProperties), [Apple](https://developer.apple.com/design/human-interface-guidelines/sheets))
- An exhausted card needs two signals, not one. A slight tilt alone was misread in MTG Arena. ([PC Gamer](https://www.pcgamer.com/uk/its-a-good-sign-that-our-biggest-magic-the-gathering-arena-concerns-are-cosmetic))

## Principles for every phase

- **Tokens, not literals.** Every duration, easing and spring lives in `src/play/motion-tokens.ts` (phase 23). Before phase 23, a phase that adds motion names its values in its phase file, and phase 23 moves them.
- **Timing:**
  - press feedback in the same frame;
  - small changes 200 to 300 ms;
  - a card crossing the table about 420 ms;
  - exits about 30% shorter than entries;
  - staggers 60 to 90 ms.
  - Nothing runs over 500 ms except the combat spotlight (1.6 s at most) and the phase title sweep (0.9 s, which never blocks a tap).
- **Game feel:**
  - anticipation before a big move;
  - a small overshoot when it lands;
  - a short hit pause and a decaying shake on impact;
  - a pop when a token count changes.
  - A flip shows a card going from hidden to known.
- **Never block:**
  - The rule is resolved before anything moves.
  - A tap during card motion finishes the motion and is still handled.
  - The spotlight skips on a tap.
  - Animation speed is a table setting: Normal, or Quick at ×0.6.
- **Reduced motion:** every motion snaps or fades. The spotlight and the phase sweep do not play; the banner carries what they showed. No motion is the only signal of anything.
- **Battery:** the canvas still draws only when what it shows changes. No idle loop, no breathing glow.
- **Reach:**
  - Status you read goes at the top: threat at the left, phase at the middle, the menu at the right.
  - Choices and the hand stay at the bottom.
  - Targets are 44 pt or more.
- **One copy of each thing.** The step, the readout and the buttons appear once, in the dock.

## Proposals beyond the list

These are the plan's own, from the research above. Each sits in the phase named.

- **Animation speed** (Normal, Quick) in the table settings. (23)
- **Hurry:** a tap during card motion finishes it. (23)
- **Flip on reveal and draw:** a card turns from its printed back to its face, so a hidden card becoming known is seen. (23)
- **Token pops and floating numbers:**
  - The token whose count changed pops.
  - "+2" or "−1" rises from it and fades: gold for a gain, threat red for damage.
  - The numbers are the difference between two engine states. (23)
- **Phase title sweep:** the phase name crosses the canvas center when the phase changes. It is not blocking, and it is skipped when Stops passed the phase. (23)
- **Seat handoff:** in two-handed play, the acting seat's dial pulses and its hand slides in when the engine turns to it. "Who acts now" is never in doubt. (23, 26)
- **Stops on the carousel:** a stop ahead in the current phase shows on the carousel's chevron. This closes the open note that the rail does not mark each stop. (20)
- **Tilt-aware hit testing:** a tap on the corner of a fanned card hits that card. (18)
- **One More pill:** the dock's reading pills fold into one when more than two show. Undo stays out. (22)
- **Ring mark on the dial** replaces the Ring-bearer line in the command column. (22)
- **Impact haptic:** a medium impact at the spotlight's hit and a selection tick per card during the hand scrub, through `src/play/haptics.ts`. (24, 25)
- **Exit motion for panels:** today they vanish. (21)

## Order to build

| Phase | Work | Depends on |
| --- | --- | --- |
| 18 | Card frames follow the card | none |
| 19 | Top bar and table menu | none |
| 20 | Phase carousel | 19 |
| 21 | Choice tray | 19 |
| 22 | Declutter the board | 21 |
| 23 | Motion pass | 20 |
| 24 | Combat spotlight | 23 |
| 25 | Hold and slide through the hand | 23 |
| 26 | Peek at the other seat | 19, 23 |

Phase 18 is the quick win. Phases 19 to 22 settle the layout before phase 23 tunes its motion. Phases 24 to 26 build on the motion tokens.

## Running a phase

```
Agent({ subagent_type: "implementer", model: "sonnet", prompt: "Implement docs/phases/phase-NN-….md and nothing else." })
```

Then run `reviewer` on the diff, and `ux` as well (every phase changes `src/play` or `src/screens`). A cloud session has no phone, so the phone checks a phase lists stay open in `docs/phases/STATUS.md`.
