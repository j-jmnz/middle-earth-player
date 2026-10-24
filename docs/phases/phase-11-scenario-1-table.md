# Phase 11 — Scenario 1 table

Depends on: phases 5, 9, and 10
Blocks: phase 12

## Goal

A person can play A Shadow of the Past on a phone. The reducer remains the only writer of threat, damage, resources, progress, and log fields. Table chrome uses the tokens in `docs/design-system.md`. Do not invent a palette or a type scale. Card pictures stay on the Skia canvas.

## Table

`src/play` is one Skia canvas using `@shopify/react-native-skia`, `react-native-gesture-handler`, and `react-native-reanimated`. Reanimated is the only animation library. It is not a React Native view per card. Skia decodes the cached file at the card's on-screen size. `expo-image` is for lists and the inspect screen.

A drag, a card lift, and a sheet run on the UI thread. The reducer runs when the gesture ends or a choice is committed. `legalIntents` is computed when the window changes, not per pixel. It does not build the cross product of every card and every target up front. Compute targets for the card the player selected. Drop targets are zone ids that function returned. A drop does not move a card until the reducer accepts it.

The screen imports `EFFECTS` from `src/effects` and passes the list into the reducer. There is no effects table in `catalog.db` since phase 8b. `src/rules` still receives the list as an argument.

A Zustand subscriber reads the slice it draws. Reducer updates keep the same object references for zones that did not change. A threat change updates the threat overlay and does not replace the hand slice. Skia images that leave the table are released. Do not use Drizzle `useLiveQuery` for scenario state.

The phase rail names the step the engine is in, in words. It does not skip steps. Zones on screen: pinned quest stage, staging, active location, engaged, play area, hand. Hide sheet, life number, burden deck, second active location, and second staging area render only when the script declares them. The second active-location slot is shared scenario state. Scenario 1 declares Hide. It does not declare the life tracker, the burden deck, or a second staging area.

A tap on a table card opens the inspect route. The picture stays on the canvas. The inspect screen is the React Native view. The table opens the phase 10 `booklets` route and closes back to the table. A missing booklet does not block the scenario.

A trigger shows the card, the timing, and the legal choices. Shadow cards stay face down until that attack. Resource, damage, threat, and progress change only when the engine changes them. There is no stepper, dial, or phase scrubber.

Tap targets are at least 44 points. The phase rail and the choice buttons sit where a thumb reaches. Card text on the table is the picture. Text in sheets is large enough to read at arm's length. A tap shows a pressed state in the same frame. Phase changes animate, and the animation does not gate the rule. A new gesture cancels the animation in progress. Reduced motion snaps.

The resolution screen shows the choices the campaign card's resolution records open, one seat at a time when the card says each player chooses. A loss has no reward screen. Delete the phase 10 dev-only resolution control. The phase rail, threat, and choice sheets are React Native text and buttons with testIDs. Card pictures stay on the canvas. Maestro reads the text. It does not address a card that exists only as pixels, and it does not judge the drag.

A log sheet lists this round's engine steps with their cause from phase 8d: the rule title or the card and line. It is text and testIDs, not a control. It is how a player checks a number against its source.

Prefetch the hand, staging, and the screen the player is about to open. Do not prefetch the whole cache. Text is enough while a file is still downloading.

## Play

Both starter decks are fully automated. A card from outside those decks can be in the deck. Printed numbers and implemented keywords resolve. Its unique text is visibly inactive, and no control applies it.

The human can play the scenario through its stages, lose without writing the log, and win into the resolution screen. The chosen boon and burden show on the log, and A Knife in the Dark unlocks.

## E2E

Point `.maestro/resolution.yaml` at the real resolution screen and delete the dev-only control from the flow. Add `.maestro/scenario-1.yaml`. It opens a seeded save parked on the last choice, confirms the phase rail, chooses a boon and a burden, relaunches, and finds those cards on the log with A Knife in the Dark unlocked. A second flow parks a save on a loss and asserts the log is unchanged.

## Exit

That play works on a physical phone in airplane mode after a kill and relaunch, once images used in the session are cached. Dragging a card stays smooth with the phase rail up. The drag does not run through JavaScript each frame. The simulator does not count for the drag check. `user.db` still has the deck and the log after a catalog version bump.
