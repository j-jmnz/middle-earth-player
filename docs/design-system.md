# Design system — Carved Stone

Visual authority for chrome. Product rules stay in [brief.md](brief.md). Structure stays in [architecture.md](architecture.md). Every screen uses these tokens and components. Do not invent a palette, a type scale, a radius, or a second styling system.

Carved Stone is the design for every screen, in a Dark and a Light theme. Its values come from the Carved Stone handoff (a README and `.dc.html` mocks for phone, tablet landscape and tablet portrait); where a mock and the handoff's tokens disagree, the tokens win. Where an older phase file or plan names Cinzel, gold, felt or a framed card, this file supersedes it.

## Direction

A dark, gritty, atmospheric game, not a form. The page is near-black stone under layered fog: cold moonlight, pale wisps, and red ember wherever the enemy is. Accents are silver, glows take the sphere's colour, and there are almost no borders. Every screen opens on the picture of what it is about (the scenario's scene, the fellowship's cards, the card's painting); the words support the pictures.

- **The ground and the fog** are the page (Backdrops). Surfaces float on them, set off by shadow and a 1 pt lit top edge, never by an outline. List rows are told apart by the space between them, board zones by soft coloured haze.
- **Wraith-light is the one thing to do.** The accent (silver on Dark, elven green on Light) marks the primary, the current step, and what is selected (the silver ring and wash). Beside the one primary, the accent is the word of a secondary plate and the icon of a glass button.
- **The section colour names a section** (`moon`: a grey-green on Dark, an amber on Light): Your fellowship, Difficulty, Other journeys. It is information, never an action.
- **Red is the enemy**: the threat dial, the engaged area's haze, the attacking enemy's ring, a failure's banner, Short on the quest scale.
- **Parchment is what gets recorded or decided**: the campaign log and every choice sheet on the table are weathered paper with ink, the same on both themes.
- **Card art does the illustrating**, cropped by rule (Card art) and dimmed behind words. Do not draw characters or scenery beyond the fog. The game's printed icons are the exception (Icons).
- **Few words.** A label says what something is, in plain words: no codes, no JSON-ish labels. The collector code shows only on the card screen and as row detail in a pack.
- **Borders that stay** carry meaning: the selected item (silver ring), the attacking or engaged enemy (red ring), the sphere rings on hero portraits, the combat banner's 3 pt red top edge, and the rings of the quest dials.

## Standards

What every screen does. A screen that breaks one is a finding in review.

1. **Art first.** A screen about a scenario opens on its scene; one about a deck on its heroes' cards; one about a card on its picture. A campaign or a game names its fellowship with faces (`Portrait`, ringed in the hero's sphere colour); the current playthrough on Campaigns shows them as their paintings instead (`HeroTile`). While a file is missing the art is a dark surface with the words over it: nothing waits on a picture and nothing shows a hole.
2. **One clear next move, in thumb reach.** A screen's primary sits in its `ActionBar` or floating panel at the foot, with the sentence it needs above it. A hub's primary that belongs to one thing (Begin on the Continue panel) stays on that thing.
3. **Status at a glance.** Progress is a track or a bar (`JourneyBar`, `ProgressBar`, the path's road), counts and stats are tiles (`StatTile`), a party is faces, a deck is a donut and a curve. Numbers are big and in Marcellus SC; their words are small capitals. A sentence says what a number cannot.
4. **Show the decision, fold the rest.** Manage, Import and the archived lists are one quiet control away. Nothing is hidden behind a gesture alone.
5. **Back, the book, the gear and the menu are round glass buttons at the top** (`IconButton`, `NavBar`), each with a spoken label ("Back to Decks", "Open the booklet", "Settings").
6. **Every target is 44 pt.** A smaller visible mark keeps its 44 pt target with a hit slop or a larger pressable.
7. **Feedback in the same frame.** A press darkens the primary about 8% and sinks it 1 pt; a plate sinks 1 pt; a row fills. Nothing animates on the scroll path.
8. **Size classes, not devices.** A layout asks the window's width in logical points (its points over the UI scale), never the device: compact under 600, medium 600 to 839, expanded 840 and up (`sizeClass`, `useSizeClass`, `src/play/size-class.ts`). See Tablets.

## Performance

Feel outranks decoration. These are exit conditions.

- A list is a FlashList. A row is one pressable, text, at most one small picture and small game icons. Inside a FlashList row nothing casts and nothing is filtered: fills are flat washes (`rowSurface`), no `boxShadow`, no `filter`, no blur. Floating panels, tiles and their shadows belong to a ScrollView. The card pool's and the deck editor's grids are the lists of large pictures, each decoded at its drawn size and recycled by FlashList (`pool-grid.ts`).
- The backdrop is one Skia canvas per screen (`backdrop.native.tsx`), behind the content (Campaigns adds one more over its hero art, `FogVeil` on Dark or `LightVeil` on Light): the fog is Skia `FractalNoise` coloured by a matrix, drawn once per texture into a stitched tile, then repeated and faded by elliptical masks in one draw per layer, with no offscreen layer. Only the fog moves (Dark fog, below), the canvas redrawing about 30 times a second, only on the screen in front and never under reduced motion; Light has no fog, so its canvas is drawn once per size. It never sits inside a list row or scrolls. The web build draws the same scene in CSS (`backdrop.tsx`), each fog texture an SVG `feTurbulence` tile with stitched edges, its drift a CSS animation of the tile's position.
- A gradient is a style from `src/play/surfaces.ts` (`backgroundImage`, which React Native draws natively and react-native-web hands to the browser) over a solid or translucent fill of the same token. Depth is `boxShadow` (RN 0.88 draws inset and multiple shadows); a scene behind words is dimmed with `filter` (`ART_FILTER`, `art.tsx`). The card screen's blurred backdrop is its one blurred image.
- **Motion** has one home: `src/play/motion-tokens.ts` (`docs/design-system-table.md`, Motion), and honours the Animation speed setting (Quick is ×0.6). Screens add no motion beyond what is listed here; the combat spotlight is the table's one large motion (`docs/design-system-table.md`, Spotlight). A fold is a state change, not a motion: it snaps.
- The first screen paints from SQLite. Marcellus SC and the four Barlow Semi Condensed files are embedded at build time by the `expo-font` config plugin (`app.json`), so there is no runtime font load (the table canvas loads them through Skia, with the system face standing in for the moment it takes). No icon font is loaded at runtime: the game icons are committed SVG and PNG files (Icons).
- The table is one Skia canvas. Card pictures stay on that canvas. Chrome text and buttons are React Native. `src/play` cannot import `src/screens`.

## Color

Values live in `src/screens/palette.js`. `tailwind.config.js` maps them to utilities, and `src/play/tokens.ts` copies the ones the table draws with (`play-tokens.test.ts` fails when a copy drifts). A screen uses the utility, `palette`, or a surface from `src/play/surfaces.ts`. It does not write a new hex. The only other colour values are the scene art in `src/screens/backdrop-scenes.ts`: the fog, Light's sunlight and rust wash, and the grit. Two themes: **Ringwraiths**, the Dark default, and **Rivendell**, its Light twin. The Theme setting is Dark, Light or System; System follows the phone, and Dark when the phone reports none. The root layout (`src/screens/routes/_layout.tsx`) resolves the theme once, writes the palette as CSS variables with NativeWind `vars()` and sets `colorScheme`, so one class paints both themes. A token name is a role, not a hue: `night` is the ground and `bone` the main text in either theme, so `bone` is dark ink on Rivendell, and `accent` is silver on Ringwraiths and elven green on Rivendell.

| Token | Ringwraiths (Dark) | Rivendell (Light) | Use |
| --- | --- | --- | --- |
| night | `#030405` | `#E4DCCB` | The ground; the page and the stack background; what fades over a picture reach |
| dusk | `#0C0E11` | `#EBE3D0` | A floating panel's foot; a row's wash |
| raised | `#111417` | `#F2ECDE` | A plate's foot, a tile at rest; disabled primary |
| raisedTop | `#1E2328` | `#FDFAF2` | The lit top of a panel's and a plate's gradient |
| pressed | `#2A3036` | `#DED4BF` | Pressed fill; the selected segment's top |
| hairline | `#2A3036` | `#CFC3A8` | A dashed rule on Dark (the journey track, the roads' segments ahead; Light draws those in accentLine, `useAheadLine`, since its hairline is under 3:1 on its ground); never an edge round a box |
| bone | `#EEF2EC` | `#1A1D17` | Titles, body, primary text |
| muted | `#A6ADB5` | `#46473B` | Secondary sentences, inactive filters |
| faint | `#8D949B` | `#5E5D52` | Inactive tabs, locked rows, meta; the floor for words on fog |
| danger | `#E8917B` | `#9A3220` | Refusals and errors, always with a sentence; Defeat; Short |
| accent | `#C4D3C0` | `#3E5A48` | Wraith-light: the primary's body, the secondary plate's word, the glass button's icon, links |
| accentHigh | `#D8E6D2` | `#2C4636` | Active: the selected ring and row bar, the dock's active bar, the current tick |
| accentDeep | `#6C7F69` | `#18271F` | The primary's foot; the cost curve's foot |
| accentLine | `#5A6E5C` | `#637A69` | The current stop's outer ring; a past phase tick; a disabled primary's dashed edge |
| onAccent | `#0C1014` | `#F7F1E3` | Text on the primary; the switch's knob when on |
| moon | `#8FA894` | `#725219` | Section headings, overlines |
| ok | `#8FBF7A` | `#3B6B2C` | Ready to play, Won · score, Ahead |
| paper / paperPressed / paperEdge | `#E6DCC6` / `#D2C4A6` / `#A8977A` | same | Parchment, lit in the middle and burnt at the rim (`parchmentSurface`); splash and adaptive icon background |
| ink / inkMuted / inkLabel / inkLine | `#221E17` / `#5C4F3D` / `#6B4E1C` / `#4A3A24` | same | Ink on parchment; inkLine is drawn at 25 to 40% for the log's rules |
| felt / feltLight | `#030405` / `#0C0F12` | `#E4DCCB` / `#F2EBDC` | The table's ground, kept for the panels that name it; the canvas itself is transparent over the fog |
| threat / onThreat / threatEdge | `#D35537` / `#FBD9CC` / `#7A2214` | `#B8432C` / `#FFF4EC` / `#8F2A17` | The threat dial and the quest scale's threat dial, the engaged haze, an attacking enemy, a failure's banner edge |
| glow | `#BED6BA` | `#FFFFFF` | The silver glows: the selected ring, the dock's active bar, the phase name |
| leadership, tactics, spirit, lore, fellowship | `#B06098`, `#E03848`, `#54A8C0`, `#62B02A`, `#C9A961` | `#9A4A82`, `#B82A38`, `#2F7F96`, `#4A8A1C`, `#8F7434` | Sphere icon tints and glows, the donut's arcs, a portrait's ring; Light darkens them for contrast (Neutral uses faint) |
| treachery, quest, location, objective | `#3A221C`, `#4D545B`, `#4D3A2D`, `#A68448` | same | Encounter marks |

Contrast (`contrast.test.ts` checks every pair in both themes; body text needs 4.5:1, a graphic 3:1). Rivendell meets 4.5 on every text pair. Two Ringwraiths pairs are held at their real values: faint on pressed, 4.35:1 (faint sits on the pressed fill only for the moment of a press), and onThreat on threat, 3.10:1, used only for the large dial numerals. accentLine holds 3:1 against night and raised in both themes.

The table's copy of the tokens (`tokens.ts`) carries keys that are not colours of the palette: `lit` (the lit edge), `depth` ("dark" or "light": how surfaces.ts builds depth), `shade` (the shadow colour: black on Dark, a warm brown on Light) and `primaryTop`/`primaryMid` (the primary's lit top and middle).

## Surfaces

`src/play/surfaces.ts` builds every surface from the tokens; screens and the table both read it. Each is a fill, a gradient over it and a `boxShadow`. Depth differs in kind between the themes: Dark lifts a panel with black shadow and a faint green haze, Light with a warm brown shade.

| Surface | Dark | Light | Use |
| --- | --- | --- | --- |
| `panelSurface()` | raisedTop at 82% to dusk at 92%; `inset 0 1px 0` lit edge, `0 2px 0` black, `0 24px 50px` black, `0 0 80px` green haze | raisedTop at 92% to raised at 95%; white lit edge, `0 22px 44px` warm shade | The floating panel: the path's and the briefing's panels, the table's dock, a deck's analytics, a rule's reading pane |
| `tileSurface()` | the panel with a shorter shadow | same | Stat tiles, book tiles, poster tiles, a hero tile, the table's popovers and carousel |
| `rowSurface()` | dusk at 72%, no shadow (`rowDepthOf` beside it when not in a list) | raisedTop at 75% | List rows and light tiles |
| `sunkSurface()` | night at 82%, an inset shadow | raisedTop at 80%, a soft inset shadow | Search fields, inputs, segmented tracks |
| `segmentSurface()` | pressed to raised, `0 2px 6px` | white to raised | The selected segment; a toggle chip that is on (with a 2 pt accent bar inset at its foot) |
| `accentPlate()` | `#EEF5EA` to `#B2C3AD` at 50% to accentDeep; a white lit top, a dark foot, a 1 pt ground ring, `0 8px 18px` black and a silver glow | `#3F5A4B` to `#253A2F` at 55% to accentDeep; a faint lit top and `0 8px 18px` shade | The primary. Pressed: `filter: brightness(0.92)` and 1 pt down |
| `slateSurface()` | raisedTop to raised; a faint lit top and `0 6px 14px` | raisedTop to dusk | The secondary plate and the square icon plate |
| `glassSurface()` | dusk at 62% and `0 6px 16px` black | raisedTop at 70% and a soft shade | The round glass button and the History pill |
| `selectedRingOf()` | `0 0 0 2px` accentHigh and a silver glow | `0 0 0 2px` accent and a soft green glow | What is selected: a cover, a cell, a tile |
| `selectedWash()` | glow at 16% fading to 5% across | accent at the same | The selected row, with a 3 pt accentHigh bar at its leading edge |
| `parchmentSurface()` | paper, paperPressed at 70%, paperEdge at the rim; an inset burnt shadow and a deep drop | same, a softer drop | The campaign log, the table's paper sheets and reading panels |
| `nightFade(from, to)`, `topShade()` | the ground rising over a picture | same | Words over art |

## Type

Two faces from Google Fonts (OFL), embedded: **Marcellus SC** (`font-display`) for display: screen titles, names, button labels, numbers on dials, tiles and badges, the dock's and the rail's labels, section headings. Its lower case is small capitals, so a name reads as carved capitals while its string stays as written (Maestro and a screen reader see "Current", not "CURRENT"); it has one weight. **Barlow Semi Condensed** (`font-body`) at 400, 600, 700 and italic 400 for everything read: body, labels, overlines (bold caps), log notes (italic). React Native has no default family, so every screen and the table's chrome import `Text` and `TextInput` from `src/play/text.tsx`, which give a text the body face unless it asks for the display one; a weight class (`font-semibold`, `font-bold`) or `italic` picks Barlow's file (one family on both platforms; `app.json` registers it as an Android XML family). The table canvas draws names and small words in Barlow and numbers in Marcellus SC (`table-fonts.native.ts`).

The sizes are Medium's, written in rem: one rem is 14 pt times the **UI scale** (Small 0.875, Medium 1, Large 1.15; `src/play/ui-scale.ts`), set once by the root layout through NativeWind. Code that draws a size by hand multiplies by `useUiScale()`.

| Name | Class | Size / line | Face | Use |
| --- | --- | --- | --- | --- |
| display | `text-display` | 24 / 30, tracking 0.5 | Marcellus SC | A screen's title on a phone (30 on a tablet, `HubHeader`) |
| title | `text-title` | 19 / 24, tracking 0.4 | Marcellus SC | NavBar titles, sheet titles |
| heading | `text-heading` | 17 / 22, tracking 0.2 | Marcellus SC | A name on a row, a tile or a stop |
| body | `text-body` | 15 / 20 | Barlow | Rows, sentences, errors, text buttons |
| label | `text-label` | 13 / 17 | Barlow | Meta, counts, chips |
| eyebrow | `text-eyebrow` | 11 / 16, tracking 2.6 | Barlow bold, uppercase | The overline above a title (Fellowship of the Ring · 2 of 6, In progress · Round 4) |
| micro | `text-micro` | 11 / 14, tracking 0.4 | Barlow | Curve labels, the rail's round and step |

Set by hand where the handoff names them: a hero title over art 42 / 42 on a phone and 62 to 64 on a tablet; the briefing's title 36 (56 on a tablet); Victory and Defeat 50 tracked 6 (72 tracked 8 on a tablet) with a silver or red glow; the primary's word 20 tracked 2.5 (16 in a compact plate, 17 tracked 1.4 in the table's dock); a secondary plate's word 17 (15 compact); a section heading 15 tracked 1 in `moon` with a rule fading right; a dial's number 26 (36 on a tablet); a stat tile's value 26 over its word in 10 pt bold caps; a dock or rail label 12. Text over art carries a dark shadow on Dark (`useTitleShadow`); Light uses no text shadows.

## Spacing, radius, border

Tailwind's 4-point steps. Phone gutters 14 for panels and lists inside the 24 pt page inset, 22 for hero text over art; tablet gutters 32 to 40. Gaps 6 to 8 inside controls, 10 to 14 between cards, 16 to 20 between sections. Minimum target 44 pt at every scale (`min-h-touch`, `touch(s, n)`, `touchSlop`); the primary is 54 tall (44 compact), a secondary plate 54 (44 compact), a square icon plate 54 × 54.

| Radius | Class | Use |
| --- | --- | --- |
| 2 | `rounded-button` | The primary, square-cornered |
| 3 | `rounded-chip`, `rounded-tile`, `rounded-hero` | Plates, tiles, chips, fields, segmented tracks, rows |
| 4 | `rounded-card` | Panels, cards in a grid, covers, the dock |
| 6 | `rounded-t-sheet` | Parchment sheets |
| 10 | (by hand) | A large card picture (the card screen) |
| pill | `rounded-pill` | Pills (History), portraits, dials, the switch, the round glass button |

Every other card picture in React Native views takes the card screen's share of its shorter side, 10 on 236, never under 2 (`cardCorner`, `src/play/card-corner.ts`), clipped to the picture itself (`CardImage`, `src/play/card-image.tsx`), so a picture whose shape differs from its box is rounded too. The table canvas's cards, backs, piles and their marks take the same corner (about 2.3 pt on a phone's 54 pt card, 4 on a tablet's), so a long press does not go from a round card to a square one; 6 pt is only for shapes that are not cards. Until a picture has loaded it is contained in its box, never cropped.

No hairline borders: a panel, a tile, a row, a chip, an input and a list draw no edge (Direction). A selected thing wears `selectedRingOf`, drawn as a shadow so it moves nothing.

## Backdrops

`<Screen scene="…">` draws one scene behind the content (`backdrop-scenes.ts`), in this order: the ground; on Light, a pale rust wash where the enemy is; on Dark the fog, on Light the morning light; the vignette (clear in the middle, the ground at the rim); and the grit (fine noise, overlay at 18% on Dark, multiply at 14% on Light). An optional `art` layer (`HeroArt`) sits between the scene and the content. On Dark it is screened onto the scene and fades to black; on Light it is multiplied onto the scene and fades to white (`useArtGround`, `art.tsx`), so it ends on the ground itself, fog and all, with no band where it stops. The card screen's blurred backdrop does the same job with the card's own picture, and the briefing's scene (`GroundedScene`) too, at its foot and, in two panes, at its right edge.

**Dark fog**: every fog is a bank of three fractal-noise layers in one elliptical mask (`banks`): a soft haze (low frequency, a gentle alpha), the banks (a steep alpha, so they have edges, and three octaves, since that alpha turns finer octaves into grain) and their lit crests (the same noise, paler, steeper and nudged 3 pt up). The moonlight is a pale, sickly green-grey, after Minas Morgul's corrupted moonlight; the enemy's ember is the same banks in red. The fog drifts sideways very slowly: the moon's banks 5 pt a second to the right and its haze 2, the ember 4 and 1.7 to the left, so the layers part a little. The masks stay put, and the table's fog drifts at half speed, under the cards.

**Light**: Rivendell in the morning, with no fog. A sun's glow in the top right corner and three soft beams slanting down from it, both screened over the parchment; the enemy's side takes a pale rust multiplied in (`wash`).

**Campaigns over its scene** (`hero`): the picture in three bands, the top falling to the ground behind the head, the middle clear with nothing over it, and from under the title down falling to the ground. Over it, a layer of its own (`heroVeil`): on Dark a bank of fog under the title (`FogVeil`), screened, that falls to black at the art's foot and edge; on Light the morning glow and beams (`LightVeil`) and a warm glow behind the title, drawn outside the art's multiply so they brighten. The `hero` scene keeps its own fog below the picture, so no fog meets the art's foot.

| Scene | Where | Dark | Light |
| --- | --- | --- | --- |
| moon | Scenarios, the briefing, Campaigns with nothing open | Banks high on the right, a lighter bank across the middle | Morning light |
| hero | Campaigns over its scene | A bank below the picture only | The ground alone (the art draws the light) |
| path | The campaign path | Banks high on the right, ember low on the left where the road leads | Morning light, rust low on the left |
| ember | The campaign log, a lost resolution or outcome | Ember high on the left, a little moon low on the right | Morning light, rust high on the left |
| calm | Decks, the deck editor, cards, rules, settings, packs, history, every reading screen | A quiet bank in the middle | Morning light |
| victory | A won resolution or outcome | Banks full behind the outcome word | Morning light |
| table | The table | Ember over the encounter row at the top, moonlight from the fellowship's row down; no zone boxes | Longer beams onto the play area, rust over the encounter row |

Do not add a scene for one screen; reuse one of these.

## Navigation

- **Phone and tablet portrait**: a bottom dock (`AppTabBar`, `tab-bar.tsx`) with five hubs: Campaigns, Scenarios, Decks, Cards, Rules. 68 pt over the home indicator (12 when the platform reports none), on a dark band rising out of the page with a faint lit top. Each tab is a 24 pt printed icon over its word in Marcellus SC 12: the One Ring, the crossed axes, the hero, the unique star, the Lore book. The active tab has a 2 pt accentHigh bar across the top of its slot, inset 22% each side and glowing, a radial wash under it, and its icon (with a soft glow) and word in bone; the others are faint. A 7 pt red dot sits on Decks while a saved deck is not ready (`useUnreadyDeck`, read after the frame).
- **Tablet landscape (expanded)**: the same five become a left rail, 88 pt plus the left safe inset, items 72 pt tall with a 26 pt icon; the active item has a 2 pt bar at its leading edge and a wash fading right. **Settings** sits at the rail's foot and pushes the Settings screen (`settings-open`).
- **Settings is not a tab.** On a phone and in portrait it opens from the round gear at the top right of each hub (`GearButton`, `settings-open`); the table's All settings opens it too (`from=table`). It is a pushed route (`settings.tsx`) with Back beside its title.
- **The dock and the rail are hidden** on pushed screens: the path, the deck editor, the card, the briefing, the resolution, the log, settings and the table.
- **A hub's head** is `HubHeader`: the title (24 on a phone, 30 on a tablet), the hub's own controls (a History pill, Manage, Import, the + primary, Packs) and the gear.

## Components

Shared pieces live in `src/screens/chrome.tsx`, which re-exports them from `chrome-buttons.tsx`, `chrome-frame.tsx`, `chrome-marks.tsx`, `chrome-panes.tsx`, `chrome-text.tsx` and `tab-bar.tsx`. Import from `chrome.tsx`. The art is in `src/screens/art.tsx` (crops in `art-crop.ts`). They read `src/play` only for icons, surfaces, tokens and `Text`.

| Piece | What the player sees |
| --- | --- |
| `Screen` | The ground, the scene's fog, an optional art layer, 24 inset, top safe area. `bleed` drops the inset and the safe area, for a screen that opens on a picture under the status bar |
| `ScreenScroll` | The scrolling body: 8 pt past the inset each side, padded back, so a shadow or a ring is not cut. `max` ("readable" 640 or "wide" 1040, at the scale) caps and centres it outside compact |
| `NavBar` | A round glass Back on the left (it names where it goes), an optional Marcellus SC title and muted line centred, one optional control on the right |
| `FloatingBarShade` | A dark band behind a floating `NavBar` once the picture under it has scrolled away, solid behind the buttons and falling to nothing below them (no hard edge) |
| `IconButton` | The round glass button, 44 pt: a chevron (2.5 pt strokes), a printed icon or a drawn mark (the gear) in the accent. Always labelled |
| `PillButton` | A 40 pt glass pill with a word (History, Manage) |
| `HubHeader`, `GearButton` | A hub's head and its gear (Navigation) |
| `ScreenTitle`, `Eyebrow`, `Section` | The title with its shadow; the overline in bold caps (moon by default, accent above the thing to act on, a short rule before it with `rule`); a section's heading in Marcellus SC 15 with a rule fading right |
| `BodyText`, `Label` | Barlow; tone bone, muted, faint or danger |
| `ListRow` | A 56 pt row on a dark wash with 6 pt between rows, a Marcellus SC name, an optional picture and detail, a chevron; `selected` adds the selected wash and bar |
| `TextButton` | Barlow words with a 44 pt target and a pressed fill |
| `PrimaryButton` | The accent plate, square, Marcellus SC 20 tracked 2.5. On paper an ink plate. Disabled is a flat dark plate with faint words, and a sentence near it says why |
| `SecondaryButton` | The slate plate with its word in Marcellus SC in the accent and an optional icon; `iconOnly` makes the 54 pt square icon plate |
| `ToggleChip` | A filter on or off: a dark wash off, the selected segment with an accent bar at its foot on |
| `SearchField` | A sunk field with a drawn magnifier |
| `Segmented` | Two or three words in a sunk track; the selected one a small lit plate in semibold bone |
| `SettingSwitch` | The switch, 46 × 26: on, a lit accent track with a glow and a dark knob; off, a sunk track and a grey knob. The whole row is the control |
| `Panel` | The floating panel (`panelSurface`). `unfilled` is a thing put away |
| `StatTile` | A number on a tile: its word in small capitals above, the value in Marcellus SC 26 (danger for the final threat) |
| `Chip` | A small tag, a tinted wash with no edge |
| `JourneyBar` | The journey track of a playthrough being managed or archived: a filled diamond for each step done joined by a solid line, the current step a larger outlined diamond with a glow, a small dark diamond for each step that remains on a dashed line |
| `ProgressBar` | A count against a goal, a 3 pt bar |
| `OutcomeTitle` | Victory or Defeat in a glowing ring with the One Ring faint inside it (12%), the scenario's name under it |
| `ActionBar` | The foot of a screen: the ground with a fade above it, the primary and what goes with it, above the bottom safe-area inset measured by a native `SafeAreaView` (back from the landscape table the provider's insets can be stale) |
| `FoldSection` (`fold-section.tsx`) | A 44 pt header that folds the section under it: a chevron (down open, right folded), the title, a rule, and the count while folded. The body stays mounted, so it keeps its state; a screen reader hears whether it is expanded. No animation |
| `PaperSheet`, `SheetModal` | The parchment sheet and the modal it opens in |
| `Portrait`, `PortraitRow`, `SceneArt`, `HeroArt`, `CroppedArt` | Card art (Card art) |
| `ArcRing` (`src/play/arc-ring.tsx`) | A ring of arcs: the deck's sphere donut and the threat dial's meter. Skia on a phone, a CSS conic gradient on the web |

One primary per screen or sheet. Back, Close, and Undo are labelled buttons, never gestures alone, except the card preview (a tap anywhere but Details and the rows of what is with the card, Android Back and the VoiceOver escape gesture close it) and the table's banner (a tap or a swipe sends it away; it also closes on its own).

A delete or reset asks in place: a danger sentence naming what is lost, then the danger button (Delete for good, Reset, Restore) beside Keep. Every action on a saved thing names it to a screen reader, and one that makes its button go away (Archive, Restore, Delete) says what it did.

## Icons

The game's printed icons. `pnpm data:sync icons` fetches the sources into `data/raw/icons` (pinned by sha256 in `data/sources.json`); `pnpm data:build` cuts them out offline into `assets/icons` and writes `src/play/icons/generated.ts` and `src/play/icons/files.generated.ts`.

| Icons | Source | Format |
| --- | --- | --- |
| willpower, attack, defense, hit points, threat, shadow, unique, cost; Leadership, Tactics, Spirit, Lore, Fellowship, Baggins, Neutral; hero, ally, attachment, event, treasure, player side quest, contract; the One Ring | RingsDB icon font `ringsdb.svg` | Vector, one SVG per glyph |
| quest points, engagement cost | DragnCards token art | PNG, 256×256 |
| resource, damage, progress tokens | DragnCards token art | PNG, 146×146 |
| player and encounter card backs | DragnCards card backs | JPEG, 429×600 |

Tinting: a one-colour vector takes a token (bone, muted, faint or the accent on the ground, ink or inkLabel on paper); a sphere icon takes its sphere token. An icon always sits beside its word or carries an accessibility label. The dock's icons are the One Ring, the crossed axes, the hero, the unique star and the Lore book; the Continue panel's Path and Log are the One Ring and the contract. Settings draws a gear (`GearMark`), since the font has none.

## Card art

A player card's bundled picture is its illustration everywhere it appears; a quest card's bundled picture is the picture of a scenario. Every crop is a region of the printed layout, the same on every card of its kind (`src/screens/art-crop.ts`, `cropFrame`, tested): the picture is drawn at the size that makes the region cover the box, centred on the region, never leaving a gap at an edge.

| Region | Of | Use |
| --- | --- | --- |
| `FACE` | a player card's portrait | `Portrait`: a hero's face in a 1.5 pt ring of its sphere's colour with a glow of it (no glow inside a list row) |
| `PAINTING` | a player card's painting | A hero tile's painting with its name band |
| `COVER` | the heart of the painting, clear of the stat column and the gold border | Deck covers (three side by side, 1 pt of the ground between them, fading into the cover's foot), whose slices can be wider than tall; the Campaigns hero tiles |
| `SCENE` | a quest card's scene | `SceneArt`: the scenario's picture, dimmed (`ART_FILTER`: saturate 0.62, contrast 1.12, brightness 0.8) except in a list row's small thumb (`vivid`) |

A scenario's scene is also bundled on its own (`<code>.scene`, `SCENE_PICTURE`, cut at the source's size and softened just enough to take a print scan's halftone screen out), and `SceneArt` draws that whole when a build has it (`useScenePicture`). A scene drawn large across a page (`HeroArt`, the briefing's `GroundedScene`) is drawn no larger than it stays sharp, at most 2 device pixels to one of its pixels (`MAX_UPSCALE`) and at most twice the box's width (`MAX_ZOOM`), as a band at the box's top that fades into the ground, with no fill under the picture so nothing hard-edged shows while it loads (`bare`, `sceneBand`).

- **Hero art** (`HeroArt`): the current scenario's scene as the art layer of the Campaigns hub, the picture a band at the top of a box of 520 × 540 on a phone (about 315 tall, wider than the screen), 900 × 760 behind the journey's column in tablet landscape (the picture about 470 tall, stopping at that column's right edge with a 64 pt fade, so it never runs under the right column), faded at its sides by an elliptical shade and taken down to the ground toward its foot.
- **Card screen**: the card at 236 wide on a phone, 360 in a tablet's portrait column (`card-picture.ts`), radius 10, in its sphere's glow over a deep shadow (`CardPicture`, `card-detail.tsx`); its own picture, blurred, lights the top of the screen behind it. Pinch to zoom.
- **Fan** (`HeroFan`, deck editor): the heroes' cards 112 × 156 (150 × 209 on a tablet), turned −9°, 0° and 9°, the middle one raised and on top, a glow of the fellowship's sphere behind them.
- **Grids**: the pool's and the deck editor's cards are the whole card, radius 4, with a soft shadow; a copy peeks out behind a card the deck holds more than once; the stepper overlaps the card's foot.
- **Preview**: a long press shows the card large over the dimmed screen with Details under it.
- Encounter cards other than quests have no picture off the table. On the table they use the bundled scans.

## Tablets

Design for the window's width, not for iPad against iPhone. The numbers are in `src/play/size-class.ts`; `useSizeClass()` gives a screen `{ size, width, height, s, rail, short }`.

| Class | Logical width | Draws |
| --- | --- | --- |
| compact | under 600 | Every phone: the dock, full-width columns |
| medium | 600 to 839 | A tablet in portrait: the dock stays; reading screens sit in a 640 column; the portrait layouts (poster tiles three across, the deck editor's six-column grid, the path's road at 110 / 160 with its next panel laid out across) |
| expanded | 840 and up | A tablet in landscape: the rail, and two panes where a screen has two jobs (`TwoPane`): Campaigns' journey and its right column, the path's road and its Completed and Next column, Cards' pool and its detail pane, the deck editor's head and its cards, Rules' list and its reading pane |

- **Measured in logical points**: the width is the window's over the UI scale (`paneWidths`, `columnsFor`, `READABLE` 640, `WIDE` 1040, `RAIL` 88).
- **Two columns only with room**: a screen that splits in a `wide` scroll does so only when the measured width leaves its main column at least 400 (`split-columns.ts`) and the right column has something in it; else it keeps one readable column. A supporting column is 360 to 440 (`paneWidths("supporting")`).
- **Lists** keep their full width and inset their content to the 640 reading column (`useListGutter`, `list-gutter.ts`: the list measures itself, seeded from the window's width so the first frame is already in the column, and passes `gutter` as `contentContainerStyle`), so the scrollbar stays at the list's edge. A phone gets no style at all.
- **Orientation**: a tablet is a screen whose shorter side is 600 points or more (`useIsTablet`). Phone: portrait on every route except the table (landscape) and the card, booklet, glossary and rule screens. Tablet: any orientation on every route except the table (landscape only).

## Screens

Route files named below, such as `(tabs)/index.tsx` or `rule/[id].tsx`, are under `src/screens/routes/`. The flows, the testIDs Maestro reads and the words a screen reader hears are part of each screen's contract.

### Splash

Paper (`#E6DCC6`) with one ink ring. Same as the adaptive icon background (`app.json`). No card art.

### Campaigns (campaign list)

`(tabs)/index.tsx`, scene `hero` over its art, else `moon`. `HubHeader` with History (`history-open`) and Manage pills (Manage while there are saves; Done while on) and the gear. The list reads only `campaigns`, `saves` and the heroes' faces. The booklets are on the Rules tab.

**The current playthrough** (the save written last) fills the top of the page as `HeroArt` on its next scenario's scene (Backdrops, Campaigns over its scene). Over its fade: the overline (a short rule, "Campaign · True solo"), the campaign's name at 38 (60 on a tablet; on Light in a soft glow of the ground so the overline reads over a dark scene), and the fellowship as their paintings (`HeroTile`, cover crop, so no card frame shows: the name and the sphere's icon on the painting, no sphere ring). One row per seat ("Player 1: …" to a screen reader with two), each tile lapping 10 pt over the right edge of the one before, its lapping edge lit and casting a shadow on it (`lapShadowOf`), rows 14 apart. Tiles are 140 pt tall (180 on a tablet); two seats make two dense rows of 92 (130 on a tablet); at Large scale or on a short phone 112 and 80. The fellowship is the heroes the log records, else the last loadout's. The words drop over the scene by the window's height (170 at most on a phone, a fifth of the height on a tablet), so the road's primary lands on the first screen.

**The Continue panel** (`ContinuePanel`, `save-panels.tsx`) is the campaign's road on the ground, with no panel, wash or chip round it: one stop per scenario on a vertical line, solid and lit where walked, dashed ahead (`campaign-road.ts`). A won scenario is its name in muted with "Won · score" in green, and the wins before the last fold into one line ("2 won", the total). The one the next tap plays has a glowing outlined diamond, On the table or Next in the accent over its name at 24 (a replayed won scenario keeps its score there, and the campaign's next scenario says Next; one text, `continue-next`), and Begin (or Resume) as the primary under it, a 320 pt plate outside a phone. Resume opens the table, Begin the briefing. The rest are faint names. Once every scenario is won the road is all lit, "Every scenario is won" in green and Open path as the primary. Full path, Campaign log and New playthrough are `TextButton`s in the accent, the first two with their icons, starting where the road's names do (Full path is left out once every scenario is won). Each names the playthrough to a screen reader.

**Other journeys**: an overline and 62 pt rows (`SaveRow`): a face, the name, what is next ("Two-handed · Next: Flight to the Ford"), a chevron; a row opens the path. Two across on a tablet in portrait.

**The start panel** (`start-panel.tsx`) is one panel for every playable campaign, so the screen holds one primary. With no open save it is the whole screen: the chosen campaign's first scene and, over its fade, the campaign's name and "6 scenarios". Under them the campaign chooser: one full-width radio tile per playable campaign (`campaign-choice-<id>`, name and scenario count; the chosen one ringed), in a radio group named Campaign; the scene, name and count follow the choice, and the chooser is left out when only one campaign is playable. Then two seat tiles (True solo: one ring; Two-handed: two overlapping rings; the chosen one ringed, the other plain, so it does not read as disabled; labelled with the campaign, "Two-handed, Fellowship of the Ring"), and "Chosen once for this campaign" under them. When a finished playthrough holds cards for the next campaign, the section **Carry over from a finished campaign** follows: "The cards join this campaign's pool at its first scenario." in muted, then radio rows, Fresh start first and chosen by default. A row is `min-h-touch` and its words wrap: the finished campaign's name, then what tells it from another finished playthrough of the same campaign in faint ("Two-handed · finished 24 Oct · score 41"), then the cards in muted with duplicates collapsed ("Mendor, Mendor's Support (each player)"). A finished playthrough's offer is taken once: once a new playthrough has taken it, it is not offered again until that playthrough is deleted. The primary, Start with the chosen campaign's name (`start-fellowship` while the Fellowship is chosen, `start-<id>` for the others), is last. At Large in a short window (under 480 pt tall) the first-run panel drops its art band and heading and puts the seats and Start in one row, so the primary does not wrap under the tab bar. Every section of the panel stays mounted when hidden, so its choices survive a fold. With saves, New playthrough opens it under the section New playthrough and scrolls it into view, with Cancel at the section's right; while it is open it holds the screen's one primary.

**Manage** turns each open save into a panel that does not open, with its `JourneyBar` and Archive and Delete (danger) under it, and hides New playthrough; leaving the screen ends it. Delete asks in place (Components), naming what is lost and that the decks stay. **Archived** (folded by default, its count beside the title, `archived-toggle`) shows archived saves as `Panel unfilled` with the campaign name in muted, each with Restore and Delete. **Coming later** lists locked campaigns as tiles that wrap (two to a row at phone width, `min-w-[45%]`, so a name never breaks inside a word), faint, a locked ring, the name and "6 scenarios · Locked" (the count from the `campaigns` table), not pressable and read as one label. The fold sections are `start` (only when there are saves), `archived` and `coming`; the current playthrough and Other journeys do not fold. Folding Archived closes a pending delete confirm.

Expanded (tablet landscape): the journey over its scene on the left (the road up to 620 wide), and Other journeys, the start panel or New playthrough, Archived and Coming later on the right (`campaign-columns`, Tablets: two columns only with room). New playthrough does not scroll in two columns, because the start panel already heads the right column. With no open save the start panel takes the readable column. Medium keeps one column in a 640 reading column.

### Scenarios

`(tabs)/scenarios.tsx`, scene `moon`, the second tab. The head with History (`history-open`) and Manage (while there are games) and the subtitle "Standalone adventures. No campaign log, boons or burdens." The latest game in progress comes first as a banner on its scene (150 pt, 220 on a tablet) with the overline In progress, the name, "True solo · Normal · In progress" and Resume (the whole banner is the one button). Any other game in progress is a row with Resume in accent words, so the screen holds one primary. Then each box (Fellowship of the Ring, Revised Core Set, The Dark of Mirkwood) as a section of 64 pt rows: an 86 × 64 scene with the scenario's number in a small diamond, the name as printed (no " (Campaign)" suffix), and its standing: Won · score in green, In progress in silver, its quest stages in faint, or Not playable yet, dimmed and not pressable. A tablet shows the boxes as poster tiles, six across in landscape and three in portrait.

Under the section Games, the finished games as rows: the name, the seats and difficulty, and the result as a chip (accent "Won · score 87", danger "Lost", faint "Dropped"), with Play again. With no open game it says "No game yet. Pick a scenario to deal one." (or "No open game." when some are archived). Each box section folds (`box-<id>`), and so does Archived (`archived-games`, folded by default, `archived-toggle`). Manage, Archive, Delete and the in-place confirm work as on Campaigns.

Expanded: two columns (`scenarios-columns`, Tablets: two columns only with room): the boxes on the left; on the right the games in progress, then Games and Archived, so Resume is in the thumb's reach. Medium is one readable column.

### History

`history.tsx` (`history-view.tsx`), scene `calm`, a pushed screen (route `history`, param `kind`), opened by the History pill (`history-open`) on Campaigns and Scenarios, on that tab's kind. `NavBar` with Back (`history-back`) and the title History. Under it a `Segmented` of Campaign and Standalone (`history-campaign`, `history-standalone`), then the filters as `ToggleChip` rows that wrap, each a `radiogroup` with a label ("Filter by campaign" or "Filter by box", "Filter by result"): the campaign (or the box), left out when the list spans only one, and the result (`history-scope-<id>`, `history-result-<won|lost|all>`), whose first chips read "All campaigns" or "All boxes" and "All results".

The list is a `FlashList`: the switch, the filters and the count are its `ListHeaderComponent`; the one sentence that says why it is empty is its `ListEmptyComponent` (`history-empty`: "No campaign run yet. ...", "No standalone run yet. ...", or "No runs match these filters."); the items are flat, of two types (`getItemType`): a group header and a run. A run (`run-<id>`) is one pressable row on `rowSurface`, `rounded-card`, at least 56 pt, a chevron when it opens: the scenario in Marcellus SC with a Won (accent) or Lost (danger) `Chip`, the box (only when it is not the campaign the group names, always on a standalone row) and the date in label, a loss's cause in danger label, the seats and the heroes in muted label, "4 rounds · threat 28 / 33", and on a win the score, victory points and, in a campaign, "Reward: " and the cards the Resolution chose. A field the store never knew (a back-filled run's date, threats) is left out, never shown as 0. Newest first. Campaign runs group under a header (`FoldHeader`, `section-history-<save id>`) titled with the campaign and, on a second line, the seats, when the playthrough started and, while it exists, "3 of 6 completed", then a `Chip` of Current, Archived or Deleted; its count ("3 runs") sits beside it while folded, and a folded group emits no row items. The fold is for this viewing; it is not stored. A row opens the playthrough's log (campaign) or the game's outcome (standalone); the row of a deleted playthrough or game says "Its playthrough was deleted" or "This game was deleted" in faint label, has no chevron and is not pressable. Each row reads as one sentence to a screen reader. Nothing edits or deletes a run. On a tablet the list insets to the reading column (Tablets).

### Briefing

`briefing-parts.tsx` holds the frame both briefings share (`BriefingScreen`), scene `moon`. The scenario's scene runs 330 pt under the status bar, with Back ("Back to Path") and the booklet floating over it as glass buttons; they stay in reach as the page scrolls, with `FloatingBarShade` once the scene has scrolled away. Over the scene's fade, with the title's shadow: the overline "Scenario N · Fellowship of the Ring", the name at 36 (56 on a tablet), and its stages as chips (`briefing-stages`).

**Difficulty** comes first, since it is decided before the deck and must be seen before Deal: a stretched `Segmented` Easy / Normal, the encounter card count beside the heading, and what the difficulty changes in muted.

**Your fellowship**: each seat's picker (`SeatPicker`, `seat-picker.tsx`; Seat 1, Seat 2 in two-handed play). Until a deck is picked, and while it is being changed, the seat shows "Choose the deck this seat plays." and the Decks tab's list: the same search, Cards / List switch and filter chips (one filter for every seat; the view is shared with the Decks tab), then the decks in the Decks tab's order, starters included. Each deck is a radio: the cover or the row, ringed with the word Selected when picked, so the mark does not rest on colour. A seat's picked deck stays in its list whatever the filter. A deck that cannot be picked is dimmed, its status line says why in danger ("Needs 3 more cards", or the hero that fell), and a deck that is not ready carries Open in Decks, which opens it in the editor. Picking a deck folds the list into the fellowship panel: the deck's name across its whole width (never broken inside a word), the counts with Change at their right (a compact secondary plate; it opens the list again, with Done to keep the deck), and the heroes as dense hero tiles, the Ring-bearer ringed with the Ring mark. A missing Ring-bearer is a dashed tile with a ring and the word Ring-bearer; under the panel, "Choose the Ring-bearer" and one row per candidate (the portrait, the name, its pack, Choose; read as "Choose Frodo Baggins (The Black Riders) as Ring-bearer"), since every saga box prints its own Frodo. The picked deck's cards whose text the app does not apply are named in the panel.

Then the choices a campaign asks and the Before the deal checklist as sections, then The encounter: each set with its count, and the special rules as neutral chips (they do nothing when tapped). The booklet opens on the scenario's setup page when the campaign file records one.

**Deal** (`briefing-deal-bar`, `DealBar`, shared by both briefings) is the `ActionBar`: the validator's sentences in danger, worded for a player (`problemWords` in `briefing-words.ts`: no collector code; a missing Ring-bearer reads "Choose a Ring-bearer above: …"), then one muted sentence naming the difficulty and what Deal does (`dealSentence`: "Normal difficulty. Dealing starts the scenario.", or "A scenario is already open. Dealing again drops it."), and Deal. Deal is disabled and the error stays visible until the loadout is legal.

**Standalone briefing**: the same frame with the overline "Standalone · Scenario N" and Back to Scenarios. Under the scene, the section Players with a stretched `Segmented` True solo / Two-handed and "No campaign card, boons or burdens. A win is scored; nothing is written to a campaign." in muted, then Difficulty, each seat's fellowship and The encounter. No checklist and no penalty button.

Expanded: a supporting pane (`TwoPane`, scene pane 360 to 480 pt, `briefing-layout.ts`; the scene 560 tall). At the left the scene with its words, Back and the booklet (the shade and the buttons belong to that pane), then in the same scroll Before the deal, the waived-penalty line and The encounter. At the right, in its own scroll (a 640 `Column` centred in the pane), the replay line, Players (standalone), Difficulty, the seats and any choice the campaign asks, with the `DealBar` as `ActionBar align="fill"` pinned at the pane's foot. When that pane is 600 pt wide or more the seat picker shows two covers a row (`coverColumns`). Medium keeps the phone's order in a 640 column under the full-width scene; compact puts the aside after the content.

### Campaign path

`path/[saveId].tsx`, scene `path`. `NavBar`: Back ("Back to Campaigns", `path-back`), the campaign's name and "True solo · 2 of 6 completed" centred, the booklet as a round button (`booklet-open`). Then a road (`path-road.tsx`): one round stop per scenario, 72 pt (the one to play 104), zig-zagging down the page, joined by 2 pt segments, solid and glowing where walked, dashed where not; a won stop has a lit ring, the one to play two rings and a glow, a locked one a dark veil. The stops are drawn for the eye; a screen reader hears each stop's words. Under each stop its name and a tag in small capitals: Won · score in green, Next in silver, Locked in faint (`node-<id>-status`). A tap on the open scenario's stop resumes its table (a replay of a won one included); on the one to play, its briefing (`begin`); on a won stop, its summary (rounds, score, what it earned) and Replay (`replay-<id>`) under the road. Nothing is pinned at the foot: the stop is the next move. Under the road the picked summary or the campaign's end, then the pool (every name the campaign has earned, or "Nothing earned yet."), then Campaign log (`log-open`).

Expanded: the road on the left (stops 96 / 140) with the pool and Campaign log under it, and a 360 pt column with Completed rows above the next scenario's panel (its scene, its name, the stage chips). Medium: stops 110 / 160, one readable column.

### Campaign log

`log/[saveId].tsx`, scene `ember`. `NavBar` Back and the booklet. One parchment sheet: the overline (the campaign and its seats) in inkLabel, Campaign Log at 30 (38 on a tablet), a double rule, then the rows (Heroes, Fallen Heroes, Threat Modifiers, Boons, Burdens, Captives), each a bold caps inkLabel label over its value on a faint ink rule; Scenarios Completed with dotted leaders to each score (or Not completed in inkMuted); the Campaign Total; and the notes in italic ink, the only free text. The Boons row shows "boon on hero", with "Player N:" in front in two-handed play. Save notes appears below the sheet only after the text changes. On a tablet the sheet sits in a centred 640 column.

### Table — landscape

The table's design is in `docs/design-system-table.md`, one section per part: Top bar, Table menu, Quest scale, Canvas, Spacing and the play area's rows, Pictures on the table, Cards, Tokens and effects, Piles, Marks of the open moment, Motion, Spotlight, Gestures, Hold, slide and release, Peeking at the other seat, Command column, Two taps, One answer, one tap, Stops and Always use, Guide, Choice tray, Reading panels, Phase carousel, Quest advance, Undo, Haptics, Banner, Android Back.

### Resolution and standalone outcome

**Resolution** (`resolution/[saveId].tsx`). Won: scene `victory`, `OutcomeTitle`, then Score, Rounds and Final threat ("Threat, both" two-handed, since the score counts both seats; in danger) as tiles and "Lower score is better." Each choice group is a section (Choose a burden, Choose a boon) of tiles two to a row (an odd last tile keeps the half width): the boon's picture and both names, "Tireless Ranger on Sam Gamgee", one tile per boon and hero the seat controls; the picked one ringed with the word Selected. The `ActionBar` holds a muted sentence naming what will be written, then Confirm, disabled until a tile or the decline is chosen. Back to the path is a round Back (choices already made are saved). Lost: scene `ember`, Defeat, the scenario's name, the loss reason the reducer recorded as one body line ("Mendor left play."), "The scenario was lost. Nothing is written to the log." in muted, and Back to path as a secondary plate in the `ActionBar` (`resolution-back`).

A choice each player makes (141044, A Knife in the Dark) is asked one seat at a time, starting with the first player. Under the overline a muted line names the seat ("Player 2 (first player) chooses"; none in true solo), and under it one muted line for each seat that has confirmed ("Player 2: Tireless Ranger on Sam Gamgee", "Player 2: No boon"). A choice the card lets a seat pass has a visible decline under Confirm in the footer: the text button No boon, with Selected under it once tapped, a radio in the same group as the tiles. The sentence above Confirm is built from the noun: before a choice, "Choose a boon and a hero, or tap No boon. Your choice is written to the campaign log when you confirm." ("Choose a burden, or tap No burden.", without the "or" when the card allows no decline); once chosen, what it writes ("Tireless Ranger is attached to Sam Gamgee and recorded on the log.", or "Player 2 takes no boon. Nothing is recorded for this choice."); last, each boon on its hero ("Confirming records Tireless Ranger on Sam Gamgee in the campaign and unlocks Flight to the Ford."). The log, the resolution and the table's sheets all name a seat "Player N".

**Standalone outcome** (`standalone/outcome/[gameId].tsx`; the table's last sheet for a standalone win has the overline Scenario, "The scenario is won." and the ink primary See the score). Won: scene `victory`, `OutcomeTitle`, then Score, Rounds and Victory points as tiles and "Lower is better." Lost: scene `ember`, Defeat, the engine's reason and the completed rounds. The `ActionBar` says "A standalone game writes nothing to a campaign.", then Done (`outcome-done`) and the accent text button Play again (`outcome-again`).

**The game's details** scroll under the outcome, won or lost (`game-report.tsx`, from `src/campaign/report.ts`): a muted line saying when it ended ("Lost in round 5, in the combat phase."), the quest stage it reached ("Stage 2 of 3 · A Fork in the Road", with "1 of 2 progress" on a loss; a branch's two stages share one place), then sections on `Panel`s: Score on a win (final threat, threat cost of destroyed heroes, damage on surviving heroes, completed rounds × 10, victory points, the score, and "Lower is better." where no tiles say it), one per player ("Your heroes" in true solo, "Player N" two-handed) with the threat (or Eliminated) at its right and a row per hero (its damage against its hit points, Unhurt, or Destroyed in danger), and the Victory display with each card's points. The standalone outcome shows them while the game's final state is open; a game reopened from the list keeps only its result.

Expanded: while choosing (Resolution) or with the game's details at hand (standalone), the title and the tiles are the pane at the left and the report a supporting pane at the right (320 to 480 pt), with the `ActionBar` at the screen's foot; otherwise one readable column, the report under the title.

### Decks

`(tabs)/decks.tsx`, scene `calm`. The head with Import, Manage (Done while managing) and New deck as a 44 pt square primary with a + (read as "New deck"); the card pool is the Cards tab. Then the search field with the `Segmented` Cards / List, and a row of filter chips: All, Ready, Not ready, then one chip per sphere among the heroes (with the sphere icon; the accent plate when on). While a filter is on, a muted label says "1 of 2 decks"; no match is "No decks match." with Clear filter. All of that is fixed above one list: the deck saved last first, the starters as ordinary rows. The starter note is on the starter deck's own screen.

Cards view: a cover per deck (`DeckCover`, a FlashList row: no gradient, no shadow): three paintings 118 pt tall with no words on them, the ground rising over their foot, then the name at 20, the heroes' names on the left and the readiness on the right: a glowing ok dot and Ready to play in ok, or a danger ring and the rule in danger ("Needs 3 more cards"), so it does not rest on colour; and the counts ("3 heroes · 47 of 50 cards"). A deck with no hero shows No heroes yet in faint. List view: one row per deck: the heroes as overlapping 30 × 42 pictures, the name, and the same counts and readiness. No deck: a muted sentence naming + and Import. A tap opens the editor; a long press starts Manage. Managing adds a row under each deck: Duplicate and Delete (danger), or Duplicate and Reset on a starter; Delete and Reset ask in place.

On a tablet: the Cards view is a grid of covers (200 pt tall in three columns, 220 in two; `deckListLayout`, `columnsFor`: covers 300 pt or wider, 12 pt apart; one full-width column on a phone), and the empty, no-match and missing-starters lines span every column (`overrideItemLayout`); the List view's rows sit in the reading column. Outside compact the list mounts once its width is measured, keyed by view and column count.

### Deck builder (deck editor)

`deck/[id].tsx`, scene `calm`, `Screen bleed`. The fan of the heroes' cards (`HeroFan`, `deck-glance.tsx`) runs under the status bar, with the round Back (`deck-back`) floating over it and "Unsaved changes" as a chip at the right while there are any (`deck-unsaved`); `FloatingBarShade` once it scrolls away. A deck with no hero has no fan: its head starts under Back. Then the name at 26, an editable field (selected on focus), the heroes and starting threat, and the analytics panel (`DeckAnalytics`, at most 560 wide): the sphere donut with the count in it, green once legal; the cost curve as silver bars over 0 to 5+ with the average (a cost printed X or as a dash is not on it; `costCurve`, `sphereSplit` in `deck-status.ts`); the counts of allies, attachments and events. Then the notes, what the app does not apply, the starter note on a starter, and the jump chips (Heroes, Allies, Attachments, Events; each scrolls its heading to just under the floating Back; the counts are in the analytics and the screen reader's label). They are buttons, not filters: the deck stays one list.

Then each section's cards as a grid (`deck-grid.tsx`): Heroes (as whole cards; a Fellowship hero says Saga only at its top), then Allies, Attachments and Events (always shown; an empty one says "No allies yet." in faint), then any other type the deck holds. Three across on a phone, six on a tablet in portrait, each card with its stepper over its foot (−, the count, +; + is faint once another copy would break the limit and, tapped, says why). A tap on a card opens it and a long press previews it. An empty hero slot says Add hero and opens the pool on heroes; a section's Add opens the pool on its type.

The foot (`ActionBar`): Ready to play or what is missing (said once, with its dot: `deck-ready` or `deck-error`), Add cards and Save deck. Save is never disabled: a deck saves at any stage. Back with unsaved changes opens a paper sheet: overline Unsaved changes, the deck name, a sentence (and what the deck still lacks), Save (ink), then Discard changes and Keep editing. A deck never saved reads Not saved yet, says what Discard throws away ("its 2 heroes and 4 cards"), and its button is Discard deck (`leave-discard`).

Expanded: the head and Save in a left pane (360 to 420), with Back and its shade scoped to the pane; the cards in a five-column grid on the right, under the jump chips and + Add cards (`deck-add`), which turns the pane into the pool (`CardPoolBody` adding) on the same draft until Done. Add on a section and the empty hero slots do the same on their type, clearing the pool's search and Applied only and saying the type to a screen reader. The toast takes its own room at the deck pane's foot. The card preview renders once, at the screen. Medium: the phone page in a reading column (the fan and the bar's band stay full width).

### Card pool (the Cards tab)

`(tabs)/cards.tsx`, `card-pool.tsx`, scene `calm`. The head with Packs (a secondary plate with the unique icon). The search field and Filter (a secondary plate, "Filter · n" while n of the sheet's fields are set). The five sphere toggles (`pool-sphere-<sphere>`: the sphere's icon in its colour with a glow and a bar along the foot when on, grey off). A row of chips: Applied only (a switch: an outlined plate with a check when on), a rule, then the types (All, Hero, Ally, …; the accent plate when selected). Then the count ("852 cards") with a compact `Segmented` Grid / List (`pool-view.ts`: browsing opens on Grid and adding on List, each kept while the app is open).

Grid: the card pictures three to a row (two while adding, so the stepper fits), 10 pt apart, sized from the list's measured width so the gaps are equal (`pool-grid.ts`, `pool-cards.tsx`); each card's name in label under it; a card whose text the app does not apply says so on a strip at its foot. A long press shows the card large; a tap opens it. List: `ListRow`s with the 32 × 44 picture, name, and "Type · Sphere · Cost". Both in name order with a printing's tag ignored ("(MotK) Aragorn" files under A). No matches: "No cards match." in muted. Filter is a `PaperSheet` with the sphere chips (each with its pip; ink when on), rows for pack, trait and cost, and two switches; Apply is the ink primary.

Adding cards (`/pool` route, or the deck editor's pane): the `NavBar` names the deck ("Adding cards" under it); in the grid each card has the stepper under it (only + until the deck holds the card; + is faint once the title, in any printing, is at its limit or the hero is taken) and is ringed with a count badge while the deck holds it; in the list each row ends in the stepper. The `ActionBar` shows the deck's count against 50 with its progress bar beside Done. `CardPoolBody` is the pool without a Screen, bar, toast or preview (props `adding`, `startType`, `typeRequest`, `onPreview`); `CardPool` wraps it for the Cards tab and `/pool`. A `typeRequest` (a new `{ type }` object per ask; `applyTypeRequest` in `pool-filter.ts`) sets the type chips from outside and clears the search and Applied only.

On a tablet: the grid's columns come from the list's measured width (`poolColumns`: cards about 107 pt wide to browse, 166 while adding, never fewer than 3 and 2; nine across an 11-inch iPad in landscape, ten on a 13-inch), the List view's rows sit in the reading column, and the filter sheet floats centred (`SheetModal`). Expanded: the pool on the left and the picked card's detail in a 360 pt pane on the right (`CardDetailPane`), the picked card ringed in the grid; elsewhere a tap opens the card screen.

### Card

`card/[code].tsx`, `card-detail.tsx`, scene `calm`. The card in its sphere's glow over its own blurred picture (Card art). The name at 28 in Marcellus SC with the unique mark; type, sphere and traits on one line (traits in muted italic). The stat tiles (Cost or Threat, Willpower, Attack, Defense, Hit points; engagement and quest points on an encounter card). The text on a `Panel`: one paragraph per printed line, the timing words (Action:, Response:) semibold, the stat and sphere icons inline in place of their bracket words, flavour italic and muted (`CardTextView`; `src/play/card-text.ts` parses the catalog's markup). A line the app does not apply is set apart under the overline Not applied, with the loss in one sentence ("Its ability is not applied: it plays with its printed numbers", "The app does not apply this card's text yet, so it cannot be played") and each line with a faint rule at its left. The errata on a `Panel` under the accent overline Errata, set the same way. "In N decks" names them and opens Decks. Missing card: title Card and "Card {code} is not in the catalog."

On a tablet: medium is a reading column (`ScreenScroll max="readable"`) with the picture's cap at 360 pt. Expanded (a tablet in landscape, or a phone on its side at 844 × 390), a card with a picture is two panes under the `NavBar` (`TwoPane`, supporting): the picture at the left, centred and sized by the pane's height (`inspectSize`, no wider than 420; a sideways quest card is as wide as that height, `pictureMaxWidth` in `card-picture.ts`), and the words at the right in a pane of their own that scrolls, about a third of the width, 360 to 560. A card not in the catalog, or with no picture, keeps the single column. Pinch and pan zoom stay on the picture.

### Packs and pack cards

Scene `calm`. Packs (from Cards): round Back (`packs-back`), the title and `ListRow`s. Pack cards: round Back (`pack-back`), the pack name, rows with thumb and collector code detail. An unknown or empty pack says so in a muted sentence. Deck import (`deck-import.tsx`, opened from Decks) uses the same look; its pinned group headings keep their full-width band and pad their text to the column.

On a tablet: the titles and the empty sentences sit in a 640 `Column`, and the rows in a `useListGutter` inset.

### Settings

`settings.tsx` (`settings-view.tsx`), scene `calm`, a pushed screen opened by the gear or the rail's foot (`settings-open`), screen `app-settings`. Back and the title Settings, then one scrolling page of four `Section` groups, no sub-menus. Each row is a semibold name over its muted detail with a stretched `Segmented` under it (so three words fit at Large) or the switch at its right.

- **Display:** Theme (Dark, Light, System), UI scale (Small, Medium, Large), Strong outlines.
- **Motion and feel:** Animation speed (Normal, Quick), Reduce motion (Follow system, Always), Combat spotlight, Haptics.
- **At the table:** First-game guide, Stops on, Keep screen awake, and Responses used every time ("None yet" when empty; otherwise one accent text button per Response under "Tap one to have the table ask again.", heard as "Ask again: name"). The mid-game rows come first because they are reached during a game.
- **About:** the app version, the card data version, the credits, and Restore defaults.

The first three groups are `SettingsRows` (`src/play/setting-rows.tsx`), and About is `SettingGroup`; the table's settings panel draws the same rows. The switch rows are `SettingSwitch` (`src/play/setting-switch.tsx`, because `src/play` cannot import `src/screens`; the carousel's Stops uses the same row), one 44 pt target heard as a switch with its detail as the hint. Every change applies at once and is saved; the page reflowing is the feedback, so there is no Save. Restore defaults asks in place: "Put every setting back to its default? Your games and decks are not touched.", then Restore (danger) beside Keep. It resets every setting except how many times the guide has explained each step. testIDs are `app-settings-*` (`app-settings-scale-large`, `app-settings-theme-light`, `app-settings-restore`, `app-settings-restore-confirm`).

On a tablet: medium is one readable column, and so is an expanded window too narrow for two columns of at least 360. Otherwise expanded is two equal columns in a `wide` scroll (`app-settings-columns`, `SettingsRows`' `groups`): Display and Motion and feel on the left, At the table and About on the right. The title sits in a `Column` of the same width.

### Rules

`(tabs)/rules.tsx` (`rules-view.tsx`), scene `calm`. The head, then the search first ("Search the rules"), since a player reaches for a rule mid-game. Under it the section Books, at the head of the glossary's list so it scrolls away with it: one tile per stored book (the four rule and campaign books), 150 pt tall on their scenes with the Lore book glowing, two to a row at phone width and four from 600 pt wide, opening the reader; the books step aside while a query is typed. Then the section Glossary with the count on a chip, and the rule spans as rows: a Marcellus SC name over its source ("Rules Reference · page 17"). With no query they are in title order, entry and step numbers and quote marks ignored; a query puts titles that start with it first, then titles and terms that hold it, then (from three letters) the text. No matches: "No rule matches." in muted. The table's Rules opens the same view without the books (`glossary.tsx`).

Medium: the same list in a reading column. Expanded: a list-detail (`TwoPane`): the search and the glossary at the left (`ListRow selected`, `accessibilityState.selected`), and the picked rule at the right in one floating panel (`RuleBody`, `rule-detail.tsx`: padding 40, title 38, text 18 / 28 in a 560 column, See also as chips; See also picks another rule in place, Open in book pushes the reader). The list opens with a Books row (`rules-books-row`, Rules tab only), selected while no rule is picked. With nothing picked the right pane holds the Books (two a row, `rules-books`) on the Rules tab, and "Choose a rule to read it here." on the table's glossary. A tap on a row selects it instead of pushing `/rule/[id]`; a rule opens at its top, and a pick made through See also scrolls the list to its row (when the search keeps it) and is announced.

### Rule

`rule/[id].tsx`, scene `calm`. Round Back to Rules. The book and page as an accent overline, the title, then, for a rule from a book the app carries, the secondary plate "Open in book · page N" with the Lore icon, opening the reader on that page (read as "Open Learn to Play at page 22"; Close returns to the rule); then the text in a `Panel`, set as card text is (`CardTextView`). The column's line breaks are joined back into paragraphs; a bullet, a numbered step and See also each start one. See also is a moon overline over accent text buttons, one per name that has an entry (the same book first), a quoted name shown without its quote marks; a name with none stays a faint word. Unknown id: "Rule {id} is not in the glossary." in muted. On a tablet: a readable column (`ScreenScroll max`); in the list-detail the body shows in the Rules pane instead.

### Booklet

`booklet/[id].tsx`, scene `calm`. The PDF page fills the screen on the ground. Close is a centred text button at the bottom in thumb reach. Missing file: a dashed accent outline of a book with a ring, the book name, "This booklet is not on this phone. Scenarios still play without it.", and Add booklet. On a tablet the PDF stays full bleed; the missing and installing states sit in a centred 480 column.

### Database

Scene `calm`. Title Database, the failure in body. No retry.

## States

| State | Treatment |
| --- | --- |
| Empty | A muted sentence that says what is missing. The title stays. |
| Loading | The splash is the startup wait. A later wait shows the title and the word Loading in muted. No spinner package. A picture still loading is a dark surface with its words over it. |
| Error | Danger sentence naming the card, the book, or the failed open. |
| Locked | Faint text, a dark veil or a locked ring, the word Locked. Not pressable. |
| Current | An outlined diamond or stop with a glow, Next or On the table in the accent, plus the word Current when it is not obvious. |
| Completed | A lit stop or a filled diamond, Won · score in green, the reward names as chips. |
| Selected | The selected ring (`selectedRingOf`) or the selected wash with its bar, plus the word Selected on a radio. |
| Refused | Danger sentence naming the card and the rule. The refused change does not happen. |
| Not ready | A deck that breaks a deckbuilding rule: a danger ring and the rule in danger ("Needs 3 more cards"). It saves; the briefing does not offer it. Ready is an ok dot and the words Ready to play. |
| Failed test | The word Failed plus the engine's numbers. |
| Not applied | A card with a printed line the app does not apply: the struck ring on the table, "Not applied" with the loss in a list row (Ability not applied, Cannot be played, Text not applied), the lines under the Not applied overline on the card and in the preview, and the count on a deck ("2 cards with text not applied"). Never the word inactive. |
| Armed | A button that sends with nothing picked, after its first tap: the line above the buttons says what the second tap does in the accent, with a 2 pt bar running down (`docs/design-system-table.md`, Two taps), and a haptic tick. The button keeps its size, place and label. A moment with one answer arms nothing. |

An irreversible control (Deal, Confirm, a resolution choice) shows the consequence in a sentence directly above it. On the table no single tap sends an intent: a tap picks and a button confirms, and a button that sends with nothing picked is armed first; only a moment with one legal answer sends on one tap.
