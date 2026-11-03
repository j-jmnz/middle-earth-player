# Phase 17 — Design system

Depends on: phase 3
Blocks: phase 6
Can run beside: phases 4, 5, and 7

Executed by `/ux`. The implementer does not start this phase and does not review it as the author.

## Goal

One visual system for the phone, taken from the card art, the scenario scans, and the booklets on the source shelf. Apply it to every screen that already exists. Specify every screen the later phases will build, so those phases use the same tokens. The first paint, the lists, and a future drag stay smooth.

## Sources

Read these for color, type, frames, and page structure. Do not commit them. Do not copy card text or booklet prose into the app, the design file, or git. The booklet is not a rules source. Do not parse it.

- `.cache/sources/ringsdb/` — player cards. Open a hero, an ally, an attachment, and an event if those files are present. `141001.jpg` is in that folder.
- `.cache/sources/reading/a-shadow-of-the-past/` — quest, location, enemy, and treachery scans for A Shadow of the Past.
- `.cache/sources/booklets/fellowship-of-the-ring.pdf` and `.cache/sources/booklets/learn-to-play.pdf` — sample the cover and a few interior pages. Do not transcribe them.

Sphere and encounter colors come from those pictures. A sphere or a state that is only a color is not done.

## Write

`docs/design-system.md` is the visual authority for chrome. `docs/brief.md` and `docs/architecture.md` already point at it. Do not paste the system back into those files.

The document covers every route in the brief's screen table:

- Campaign list, campaign path, log, briefing, resolution
- Table chrome: phase rail, threat, life, choice sheets, Hide sheet, trigger sheet. Card pictures stay on the Skia canvas. Name the colors and type the canvas uses. Do not build the table.
- Card inspect, card pool, deck editor
- Booklet reader, including the missing-file state
- Packs, the card list inside a pack, the deck placeholder, the database error, the tab bar, the splash

For each route, say whether a file exists. Specify empty, loading, and error states where a list or a save can be missing. An error names what failed. Locked, current, completed, a refused deck, and a failed test are distinguishable without color alone. One primary action per screen. An irreversible choice states the consequence before it commits. Back, close, and undo are labeled controls in thumb reach, not hidden gestures.

Tokens:

- Color, type, spacing, radius, and border live in `tailwind.config.js`. Screens use those tokens. A one-off hex in a screen is a miss.
- NativeWind 4.2.7 and Tailwind 3. No second styling system. No new package. No icon font, no downloaded typeface, no animation library. Reanimated is already the motion library, and this phase does not add a gesture.
- Ship one theme, taken from the source art. Map both OS schemes onto it so an undesigned inverse never appears. State the text and surface pairs and that body text on those surfaces meets 4.5:1.
- Type is large enough to read at arm's length. Tap targets are at least 44 points. The phase rail, the choice buttons, and back sit above the home indicator and clear of the notch and status bar.
- Spacing and type use one scale. Name it.

Shared chrome, if a screen would otherwise repeat the shell, lives in `src/screens/kit/chrome.tsx`. It is views and text. It does not fetch, and it does not import `src/rules` or `src/play`.

## Apply

Restyle the screens that exist:

- `src/screens/routes/_layout.tsx`
- `src/screens/routes/(tabs)/_layout.tsx`
- `src/screens/routes/(tabs)/index.tsx`
- `src/screens/routes/packs.tsx` (moved out of the tabs when Packs went under Cards)
- `src/screens/routes/(tabs)/decks.tsx`
- `src/screens/routes/pack/[code].tsx`
- `src/screens/routes/card/[code].tsx`
- `src/screens/data/database-error.tsx`
- `tailwind.config.js`
- `src/screens/kit/palette.js` (the values `tailwind.config.js` maps to utilities)
- `global.css`
- The splash background in `app.json`

Keep every `testID`. Maestro asserts the words `Campaigns` and `141001`. Leave those strings. Do not change queries. The campaign list still does not read `cards`. Do not add a route.

Do not build the deck editor, the table, the path, the log, the briefing, the resolution screen, or the booklet reader. Phases 6, 10, and 11 build those and use this system.

The splash background is the system background. Do not draw card art or booklet illustrations into the icon. Do not add an image decode on the way to the first paint.

## Performance

Feel outranks decoration. These are exit conditions, not advice.

- A list stays on FlashList. A row is text, at most one image decoded at row size, and a press state. No blur, no shadow stack, and no gradient on a row.
- Nothing in this phase decodes a card at native size inside a list. The inspect screen may, when an image exists. This phase does not add the image cache.
- Motion, if any, can snap. Reduced motion snaps. No animation runs on the scroll path. A press state shows in the same frame.
- The first screen still paints from SQLite. It does not wait on a font, an image, or a catalog count.
- The table specification does not put a React Native view on each card. Overlay text and buttons stay off the canvas, as the architecture already says.

## Exit

`docs/design-system.md` names the tokens, the type scale, the spacing scale, the components, and every screen in the brief's table. Existing screens use the tokens and do not invent a color. `pnpm test` and `pnpm lint` pass. `package.json` has no new dependency. TestIDs and the two Maestro strings above are unchanged. Mark the phase active while you work. Do not mark it completed. `/reviewer` reviews the diff. `/ux` does not review its own phase.
