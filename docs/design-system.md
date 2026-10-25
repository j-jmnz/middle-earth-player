# Design system — Night

Visual authority for chrome. Product rules stay in [brief.md](brief.md). Structure stays in [architecture.md](architecture.md). Every screen phase uses these tokens and components. Do not invent a palette, a type scale, a radius, or a second styling system.

This replaces the earlier Parchment system. Where `docs/phases/phase-17-design-system.md` says "system face only", "no downloaded font", or "light only", this file supersedes it. The one embedded typeface and the dark theme are deliberate decisions. The reference mockups are `Fellowship Companion v2.dc.html` in the design project.

## Direction

A game, not a form. The phone is a lamp-lit table at night: deep blue-black, warm gold light, parchment where something is written down.

- **Night** is the page. Every screen sits on a scene backdrop that gives depth: a gradient sky, a soft glow, sometimes a mountain ridge.
- **Gold is the Ring.** Gold marks one thing per screen: the current node, the primary button, the selected choice. If two things are gold, one of them is wrong.
- **Parchment is what gets recorded or decided.** The splash, the campaign log, and every choice sheet on the table are paper with ink.
- **Card art does the illustrating.** Hero tiles, deck covers, and the inspect screen use the real cached card pictures. Do not draw characters or scenery in SVG or Skia beyond the backdrop scenes and the ring. The game's own printed icons are the exception: see Icons.
- **Few words.** A label says what something is, in plain words: no codes, no JSON-ish labels, no ALL CAPS tables. The collector code shows only on the card screen and as row detail in a pack.

## Performance

Feel outranks decoration. These are exit conditions.

- A list is a FlashList. A row is one pressable, text, at most one image decoded at 32×44, and small game icons (see Icons). No blur, no shadow, and no gradient on a row. The name still shows when the file is missing.
- The backdrop is one static Skia canvas per screen (`backdrop.native.tsx`), drawn once per window size, behind the content. It never sits inside a list row or scrolls. The web build draws the same scene in CSS (`backdrop.tsx`).
- Press feedback is an immediate fill in the same frame. Nothing animates on the scroll path. Sheets and phase changes use Reanimated and snap under reduced motion.
- The first screen paints from SQLite. Marcellus is embedded at build time by the `expo-font` config plugin, so there is no runtime font load and no wait. No icon font is loaded at runtime: the game icons are committed SVG and PNG files (see Icons). No other new package, except `expo-haptics`, which the user allowed on 2026-10-25 for the table's ticks (Table, Haptics).
- The table is one Skia canvas. Card pictures stay on that canvas. Chrome text and buttons are React Native. `src/play` cannot import `src/screens`. The canvas uses the `felt` and `feltLight` tokens, copied into play when the table is built.

## Color

Values live in `src/screens/palette.js`. `tailwind.config.js` maps them to utilities. A screen uses the utility or `palette`. It does not write a new hex. The only other hex values are the backdrop scene stops in `src/screens/backdrop-scenes.ts`. One theme: `userInterfaceStyle` is `dark`, NativeWind `colorScheme` is `dark`, and both OS schemes map onto Night.

| Token | Hex | Use |
| --- | --- | --- |
| night | `#0A0B0E` | Page, tab bar, stack background |
| dusk | `#14171D` | Top of plain backdrops |
| raised | `#16181D` | Panels, segmented track, disabled primary |
| pressed | `#1E2026` | Pressed fill on night |
| hairline | `#24262B` | Row rules, panel borders |
| bone | `#F1EADB` | Titles, body, primary text on night |
| muted | `#A39C8E` | Secondary sentences, inactive tabs, neighbor steps |
| faint | `#8A857C` | Locked rows, meta such as the collector code |
| danger | `#E39A80` | Refusals and validator errors, always with a sentence |
| gold | `#D9B86C` | The Ring: current, primary fill, selected, eyebrows |
| goldHigh | `#EBD08E` | 1 pt top highlight on the primary pill |
| goldDeep | `#B8924A` | Pressed primary |
| goldLine | `#5E5032` | Border of the current panel |
| onGold | `#1A140A` | Text on gold |
| paper | `#F2EBDB` | Splash, log sheet, choice sheets, adaptive icon |
| paperPressed | `#E5DBC4` | Pressed fill on paper |
| paperEdge | `#D6C9AB` | Sheet vignette edge |
| ink | `#221E17` | Text on paper, filled button on a sheet |
| inkMuted | `#6E6250` | Secondary text on paper |
| inkLabel | `#7A5C22` | Eyebrows and text buttons on paper |
| inkLine | `#CFC3A6` | Rules and the grabber on paper |
| felt / feltLight | `#121613` / `#1F2620` | Table canvas ground and its lit center |
| threat | `#B9483A` | Damage token, enemy mark |
| treachery, quest, location, objective | | Encounter marks, as before |
| leadership, tactics, spirit, lore, fellowship | | Sphere icon tints sampled from the printed icons (Baggins uses fellowship, Neutral uses faint) |

Contrast pairs, WCAG, all at or above 4.5:1 for body text: bone on night 16.9, muted on night 7.2, faint on night 5.3, faint on raised 4.8, danger on night 8.8, gold on night 10.5, onGold on gold 9.8, ink on paper 14.9, inkMuted on paper 5.0, inkLabel on paper 5.2. Sphere and encounter colors are marks beside a word, never the only signal.

## Type

Two faces: **Marcellus** (display, `font-display`) for names and moments, and the **system face** for everything you read in a sentence. Five sizes. Do not add a sixth.

| Name | Class | Size / line | Face | Use |
| --- | --- | --- | --- | --- |
| display | `text-display` | 34 / 40 | Marcellus | Screen title, outcome word (Victory) |
| title | `text-title` | 24 / 30 | Marcellus | Campaign and scenario names, sheet titles, card name |
| body | `text-body` | 17 / 24 | System | Rows, sentences, errors, buttons |
| label | `text-label` | 13 / 18 | System | Meta, tabs, neighbor steps, counts |
| eyebrow | `text-eyebrow` | 12 / 16, tracking 2.4 | Marcellus, uppercase | One short tag above a title: Current, Scenario 1, Combat |

The primary button label is Marcellus body size, uppercase, widest tracking. Numbers the player watches (threat, life, progress) are Marcellus. Card text is never typeset: on the table it is the picture.

## Spacing, radius, border

Tailwind's 4-point steps. Page inset `px-6` (24), top `pt-safe`, controls at the bottom `pb-safe`. Gap under a title 16 to 24. Panels pad 20 (`p-5`). Minimum target 44 (`min-h-11`); rows, tabs, and the primary are 56 (`min-h-14`).

| Radius | Class | Use |
| --- | --- | --- |
| 12 | `rounded-tile` | Hero and choice tiles, pressed fill on text buttons |
| 20 | `rounded-card` | Panels, deck covers, card picture on inspect |
| 28 | `rounded-t-sheet` | Paper sheets |
| pill | `rounded-pill` | Primary button, segmented control, chips, tokens |

Borders are 1 pt `border-hairline` on night. The current panel uses `border-goldLine`. The selected choice tile uses a 1.5 pt gold border.

## Backdrops

`<Screen scene="…">` draws one scene behind the content. Scenes are data in `backdrop-scenes.ts`: base gradient, up to two glows, up to two ridges, an optional ring.

| Scene | Where | Feel |
| --- | --- | --- |
| dusk | Campaign list, Start Fellowship | Mountains at dusk, warm light past the ridge. Cards sit below the light. |
| ember | Campaign path | Lamplight left, cold blue low right |
| vale | Briefing | Green vale in afternoon light |
| victory | Resolution (won) | The Ring, lit, behind the outcome word |
| felt | Table chrome | Green-black felt, vignette |
| plain | Decks, card, packs, log, errors | Quiet night, one cold light top-left |

A lost resolution uses `plain`. Do not add a scene for one screen; reuse one of these.

## Components

Shared pieces live in `src/screens/chrome.tsx`. They are views and text. They do not fetch, and they do not import `src/rules` or `src/play`.

| Piece | What the player sees |
| --- | --- |
| `Screen` | Night page, scene backdrop, 24 inset, top safe area |
| `NavBar` | Labeled `‹ Back` top-left (muted), one optional text action or meta label top-right |
| `ScreenTitle` | Marcellus, bone. `display` or `title` size. One per screen |
| `Eyebrow` | Marcellus caps tag in gold (or inkLabel on paper) |
| `BodyText`, `Label` | System face; tone bone, muted, faint, or danger |
| `ListRow` | Flat 56 pt row on a hairline, optional 32×44 picture, optional detail line, chevron |
| `TextButton` | Medium-weight body text, 44 pt target, pressed fill. Bone, gold, or ink on paper |
| `PrimaryButton` | Gold pill, Marcellus caps label. On paper it is an ink pill. Disabled on night is a raised pill with faint text; disabled on paper is a transparent pill with a 1 pt `inkLine` outline and `inkMuted` text. A disabled primary has one sentence near it saying what it waits for |
| `Panel` | Raised rounded card on a hairline. `current` swaps to the gold edge |
| `RingMark` | The Ring: current (gold ring), done (gold disc), locked (hairline ring) |
| `Segmented` | Two or three words in a pill track. Selected is a gold pill, semibold |
| `SphereMark` | The sphere's printed icon (14 pt by default) beside the sphere word, tinted with its sphere token |
| `PaperSheet` | Parchment sheet, grabber, eyebrow repeating the step, Marcellus title. Its frame is the table sheets' `SheetFrame`: fill, corners and bottom inset are plain styles (paper, 28 pt, the safe-area inset from `useSafeAreaInsets`), not classes |
| `AppTabBar` | Text tabs on night. Current is semibold bone with a gold dot above |

One `PrimaryButton` per screen or sheet. Other actions are `TextButton`s. Back, Close, and Undo are labeled buttons, never gestures alone. Back lives in the `NavBar`; it goes to the screen below, and to the screen the page belongs to (path from briefing and log, the list from path) when nothing is below. Option lists use bone `TextButton`s; gold marks the one action or a link such as Booklet and Log. Close on the booklet reader sits at the bottom in thumb reach.

## Icons

The game's printed icons, added on the user's request in phase 11. They come from online sources first and must be high resolution (vector, or a raster at least 256 px on its short side; 96 px for a token drawn only on a card); the booklets and the card scans were the fallbacks. `pnpm data:sync icons` fetches the sources into `data/raw/icons` (pinned by sha256 in `data/sources.json`); `pnpm data:build` cuts them out offline into `assets/icons` and writes `src/play/icons/generated.ts` (each icon's source and size) and `src/play/icons/files.generated.ts` (the asset requires); `pnpm data:check` covers both.

| Icons | Source | Format |
| --- | --- | --- |
| willpower, attack, defense, hit points, threat, shadow, unique, cost; Leadership, Tactics, Spirit, Lore, Fellowship, Baggins, Neutral; hero, ally, attachment, event, treasure, player side quest, contract; the One Ring | RingsDB icon font `ringsdb.svg` (glyphs named in the font or through `app.css` `.icon-*:before`) | Vector, one SVG per glyph, flipped from the font's y-up units |
| quest points, engagement cost | DragnCards token art (`dragncards-lotrlcg` S3 `tokens/`) | PNG, 256×256 |
| resource, damage, progress tokens | DragnCards token art (`dragncards-lotrlcg` S3 `tokens/`) | PNG, 146×146 |

The resource, damage and progress tokens are DragnCards' token art, 146 px (user request, 2026-10-25: the real token art, not drawn coins). They are drawn only on a card, at 32 pt or less, so their bar is three times that, 96 px, not the 256 px of an icon in chrome; each raster in `scripts/data/icons.ts` carries its own bar. The table draws them on the canvas with the count over them, and the log and the outcome banner show the same art beside a line. Encounter card types (enemy, location, treachery, objective, quest) print no type icon and stay words. There is no travel token in this box: progress on a location is the progress token, and Travel stays a word on the rail.

Tinting: a one-colour vector takes a token (bone or muted on night, ink or inkLabel on paper); a sphere icon takes its sphere token. The PNG token art keeps its printed colours. An icon always sits beside its word or carries an accessibility label (an icon and a number read as "Willpower 2"), so the words Maestro asserts stay on screen. In React Native the icon is `GameIcon` (expo-image, SVG or PNG, `tintColor`); on the table canvas it is a Skia path from the same glyph.

Where: the card screen (type, unique, sphere, cost or threat, willpower, attack, defense, hit points, engagement cost, quest points), pool rows, deck editor rows and sphere chips (`SphereMark`), the pool filter's Cost, hero tiles and the briefing (`SphereMark`), the threat rings, the quest band's quest points, the choice sheets (willpower on a quest or Hide commit and in the Hide numbers, attack in a defense header, defense on each defender and on an attacked enemy, attack on each attacker, engagement cost on optional engagement, threat and quest points on travel, hit points left on archery), the log sheet's threat and Hide lines, the campaign log's Threat Modifiers, and the sphere icon on a table card drawn as its name while its file is missing.

## Card pictures

The cached RingsDB picture is the illustration everywhere it appears.

- **Inspect:** full card, max 300 pt wide, centered, `rounded-card`, gold halo shadow (inspect only). Pinch to zoom. Name in Marcellus below, collector code top-right.
- **Preview:** a long press (350 ms) on a face-up card on the table, or on a card row in a pack or the card pool, shows the card as large as the screen allows over night at 82%, with Details (gold, opens the card screen) and Close under it. It grows in on a spring from 82% scale and shrinks back in 150 ms; reduced motion snaps both. A tap anywhere or Android Back closes it. While the scan is missing, the name and the card text sit on paper (`CardPreview`, src/play/card-preview.tsx).
- **Preview on the table (landscape):** the card stands at the left as tall as the screen allows (`previewSideSize`), and a column at its right names it, lists the effects on it now under a gold eyebrow Effects on it ("+1 Attack from Dagger of Westernesse, until the end of the phase"), and lists the card with its attachments and face-up shadow cards (32×44 thumb, name, Attachment or Shadow card): a tap on one shows it in the card's place. A long press on an attachment opens on that attachment. Details opens the card screen for the card shown. The column is not a scrim: a tap there does not close the preview.
- **Hero tile** (briefing, deck editor header, defend sheet): the card picture cropped to the art, `contentFit="cover"` with the focus near the top, a night gradient over the bottom third, the hero's short name in Marcellus.
- **Deck cover:** the three hero pictures side by side, cropped to art, fading into night, deck name on top.
- **Row thumb:** 32×44, `rounded`, raised fill while the file is missing.
- Encounter cards have no RingsDB picture. On the table they use the bundled scans; elsewhere they are text.

## Screens

### Splash — built
Paper (`#F2EBDB`) with one ink ring. Same as the adaptive icon background. No card art.

### Campaign list — built (rows: phase 10)
`(tabs)/index.tsx`, scene `dusk`. Title Campaigns in Marcellus at the top. The scene's light fills the upper third; cards sit below it. The open playthrough is a `Panel current`: eyebrow Current (only when more than one save), the campaign name in title size, seat count in muted, and a six-dot progress line (gold disc done, gold ring current, hairline locked). Other saves are plain panels. Locked campaigns are tiles side by side, faint, name plus "6 scenarios · Locked" (the count from the `campaigns` table, which `data/campaigns/index.json` fills), not pressable and read as one label by a screen reader. The list reads only `campaigns` and `saves`. No save: "No playthrough exists" in muted, then the Start block: the Fellowship name, two seat tiles (True solo: one ring; Two-handed: two overlapping rings), "Chosen once for this campaign", and the primary START FELLOWSHIP. Booklet is a text button top-right. Under the saves, Manage (bone text button; Done while on) turns each open save into a panel that does not open, with Archive (gold) and Delete (danger) text buttons under the progress line. Delete asks in place: a danger sentence naming what is lost, then Delete for good (danger) beside Keep. Archived saves sit under one text button, "Archived · n", that shows them as unfilled hairline panels with the campaign name in muted, each with Restore (gold) and Delete (danger). With no open save the Start block shows, and "No playthrough exists" only when nothing is archived either.

### Campaign path — phase 10
Scene `ember`, NavBar Back + Booklet. Campaign name centered in title size. The six scenarios hang on one vertical line: completed nodes are gold discs with the name and chosen boon and burden (muted) to the left; the current node is a large glowing ring with its name and the primary BEGIN under it; locked nodes are small hairline rings with faint names, alternating sides. The line is gold up to the current node. Pool and Log sit in one panel at the bottom: "Pool" label, names, and Log as a gold text button.

### Log — phase 10
Scene `plain`, NavBar Back + Booklet. One parchment sheet fills the screen: title Campaign Log, then label/value rows on ink rules (Heroes, Fallen Heroes, Threat Modifiers, Boons, Burdens, Captives), a Scenarios Completed block with one row per scenario (the name, then "rounds · score", or Not completed in muted), and Campaign Total. Notes are Marcellus ink, the only free text. SAVE NOTES (gold pill) appears below the sheet only after the text changes.

### Briefing — phase 10
Scene `vale`, NavBar Back + Booklet. Eyebrow Scenario N, scenario name in display over the sky. Stages as one line of names with `›`. The deck list is a radio list: the selected deck shows a filled ring and the word Selected as well as the gold name, so the mark does not rest on color, and the options are bone text buttons, not gold. `Segmented` Easy / Normal with the encounter card count beside it. Special rules as small gold-ring tags with the rule name. Booklet opens on the scenario's setup page when the campaign file records one. The deck name, then four hero tiles (three heroes and the Ring-bearer). A missing Ring-bearer is a dashed gold tile labeled Ring-bearer, and the validator sentence in danger below names the card and the rule. "Dealing starts the scenario" in muted, then DEAL. DEAL is disabled and the error stays visible until the loadout is legal.

### Table — landscape (user request, 2026-10-25; replaces phase 11's portrait table)
The table is played in landscape only (`orientation` on its stack screen), with the status bar hidden and the stack's edge swipe off (a drag from the hand's edge must not leave the table; `‹ Path` does). Top bar, 44 pt: `‹ Path`, the threat of each seat as a compact ring (36 pt gold ring, Marcellus number, the threat icon and Threat beside it; in two-handed play P1 and P2, read as "Player 1 threat", the shown seat's ring filled goldLine; Life the same way when declared), the rail (previous step muted, the current step in Marcellus caps gold with a soft glow, the next step muted; on a phone under 760 pt the current step alone, shrinking to 85% at most), Round N (not on a narrow phone), Undo (bone, only while the last choice can be taken back), Log and Booklet. Under it, the canvas at the left and the command column at the right (30% of the width, 210 to 280 pt), both inside the side safe-area insets.

**Canvas.** Felt with a lit center. The left column is one and a half cards wide: the quest card, sideways, level with staging, with a night strip at its foot showing progress / quest points in Marcellus; the active location level with the engagement area (two side by side, smaller, when the scenario opens a second slot); the player's deck and discard pile level with the play area. To its right, top to bottom: staging, with the encounter deck and its discard pile at its right end; the engagement area, a band faintly tinted with threat red; the play area; the hand, peeking up from the bottom edge above the bottom safe-area inset: 56% of a card and never less than 52 pt, so each hand card keeps a 44 pt target past the fan's drop. The card size fits three rows, the hand's strip and seven and a half cards across: about 51×71 pt on an 844×390 phone. An empty zone shows one faint word (Staging, No enemy engaged, No location).

**Cards.** Pictures with a drop shadow; a card whose file is missing shows its name wrapped in the system face at 11 pt, its sphere icon in the corner. Unique text with no effect record is veiled with the word Inactive. Exhausted cards lie sideways and take a sideways footprint in their row; their tokens and effects stay upright. A committed character stands half a step higher with a gold willpower pill at its foot. Attachments and face-down shadow cards peek out under their host, the most recent lowest; an attachment is drawn under its host only, never also as a card of its own. A face-up shadow card stands beside its enemy at 80%. The enemy whose attack is in progress has a 3 pt threat-red edge and its attack icon at its side from the moment it attacks. A defender, the hero an undefended attack hits, or the attackers stand beside the enemy, out of the play area, with a mark between them (a gold defense icon, a red attack icon when undefended, a gold attack icon for the players' attack): from the moment the player picks them, fainter until confirmed, and until the attack ends. Cards facedown under a location (Weather Hills) are out of play and are not drawn.

**Tokens and effects.** The token art at 18 pt with its count in Marcellus, bone with a night outline: resources bottom left, damage top right, progress bottom right. Down a card's left edge, under the top, each number an effect changed is a 15 pt pill with its icon and the change in 11 pt bold: gold with onGold "+1" when raised, night with a danger outline and danger "-1" when lowered; each "cannot" is its icon in danger, struck through; "+n" when more do not fit above the resource token. The numbers are the engine's (`card-effects.ts`).

**Piles.** A stack of backs (the player's raised with a gold ring, the encounter deck's night with a threat ring), or the top card of a discard pile, with the count in Marcellus on a night strip and the word under it (Deck, Discard, Encounter). An empty pile is a dashed hairline outline. Only a discard pile does something on a tap or a long press: its list slides in; its touch area is at least 44 pt. The top of the deck shows face up when the rules let the player play it (Gandalf).

**Marks of the open moment.** A card a tap does something with glows: a gold halo at 90% drawn under the card (a Gaussian blur, sigma 3 pt, so the picture covers its middle and stays clear; an outer blur mask filled a block inside the card in Skia) and a solid 2.5 pt gold edge inside it (user request, 2026-10-25: the 2 pt edge alone was too faint). A picked card has a wider halo (sigma 4.5 pt), a 3 pt gold edge and a gold ring with a check at its center, away from the token corners; a payment shows "-1" in the ring on each hero paying, archery "+2" in a threat-red ring. While a pick is open (a defender, a location, a payment; not the action window), the cards it does not ask about are veiled in night at 45%. The hand card being played rises whole.

**Motion.** A card moves from where it was to where it now is, 320 ms ease-out: a drawn card comes off the deck, a revealed or dealt card off the encounter deck, a played card from the hand; a card that leaves goes to its pile and fades, or fades where it stood. It runs on the UI thread, never gates the rule, and snaps under reduced motion. The canvas draws again only when what it shows changes: a threat change alone does not.

**Gestures.** A tap picks for the open moment, or, on a card the moment does not ask about, shows it large. A long press (350 ms) shows it large. A card that can be played, committed, traveled to or engaged can be dragged; the drop picks its target. No tap, drag or drop sends an intent.

**Command column.** The quest stage's name in Marcellus, its gold progress bar and count at the top, giving way while the dock shows numbers (the quest card shows its progress too); the dock at the bottom, in thumb reach. The dock is night with a hairline border and `rounded-card` corners: the step in a gold eyebrow (the phase for an action window, the timing and the step for a Response or an Action, the seat first in two-handed play), the moment in Marcellus body, one muted sentence that alone scrolls on a short phone. Pinned under it: the engine's numbers in a raised tile (willpower against threat while questing, "2 progress if nothing changes"; attack against defense in an attack, "1 damage, shadow card next; Sam Gamgee is destroyed"; the Hide numbers), the pick at body size in bone (the cards, or an ability's printed line), the reducer's refusal in danger, and the buttons. One gold pill always holds the same place, with a goldHigh top edge and a soft gold glow; while it waits for a pick it is an outline (1.5 pt goldLine, its label in muted), never a dark fill that disappears into the dock: the confirm of what is picked, its verb alone (COMMIT 2, DEFEND, TRAVEL, ATTACH, USE, PLAY; a long label takes two lines rather than shrinking), or, with nothing picked, the moment's own Pass (PASS, COMMIT NO ONE, CONTINUE, DONE, KEEP), or the alternative when there is nothing to pick (LEAVE UNDEFENDED with no ready defender). Under it, one row of pills in bone on raised night: the answers with a goldLine edge (the alternative, Pass when the sheet has none, Cancel for a sheet opened from the table, which sends nothing), the reading aids with a hairline edge (Read the card, List, Actions (n), Choose for a folded panel). Every fill and text colour of these buttons is a style from the tokens, not only a class: on the phone a class on a Pressable whose style is a function can be dropped, which left the gold pill as dark text on night (user report, 2026-10-25).

**Two taps.** A button that sends an intent with nothing picked first (Pass, Keep, Mulligan, Leave undefended, Do not travel, Do not engage, No attack, Continue, Done, Commit no one) arms on the first tap: the line above the buttons says what the second tap does ("Tap again: no one quests", "Tap again: planning ends") in gold, with a 2 pt gold bar running down under it for three seconds (ten while a screen reader is on); the second tap sends it; the bar running out, another button, a new pick or a new moment puts it back. Arming changes no button's size or place, so the second tap lands where the first did. The same line shows what a disabled primary waits for. A primary that confirms a pick sends on one tap, because the pick was the first. Each armed button carries the hint "Tap twice to confirm". Reduced motion keeps the bar still.

**One answer, one tap.** When the moment has only one legal answer, the window's own Pass counted (no character can defend, nothing to travel to, one hero an undefended attack can hit, an archery total one character must take, a window with only Pass), it is picked already: its card shows the picked mark, the pill is ready and not armed, and one tap on the pill or on the card sends it (user request, 2026-10-25; `answerCount` in `src/play/table-choice.ts`).

**Panels.** A choice whose options are not all cards drawn whole on the table (an either/or of an effect, a seat, a card out of play, an attachment or a shadow card, which only peek out) slides in from the right on paper, 46% of the width (320 to 480 pt), left corners rounded, under the top bar (over it on a phone under 400 pt tall): the step and the moment pinned at the top, the dock's buttons in ink pinned at the foot with the engine's numbers above them, and between them, scrolling together, the note, the seats' threat, Read the card, the tiles (picked the same way as cards) and the options the rules refuse now as dashed inkLine outlines with the reason. Look at the table folds it and the dock's Choose brings it back. List on the dock opens a choice made on the table as a panel too (the quest commit's characters, the defenders), and a panel is the default while a screen reader is on, so every choice is a control a screen reader and Maestro can reach (`sheet-option-<id>`). react-native-web always reports a screen reader, so the web build lists every choice on paper. A discard pile's list and the Log open the same way.

**Undo.** Undo in the top bar takes back the last choice while it showed no hidden card (`docs/brief.md`, Rules engine); each tap goes back one more, and it leaves the top bar once a card has been revealed since. The cards move back the way they came. The banner says "Taken back" and what that choice had done.

**Haptics.** A light selection tick when a button arms, a light impact when an intent is sent or taken back, a warning when the reducer refuses one. They add to the screen and never replace it; a phone without haptics ignores them.

**Banner.** After each intent that changed the table, a night panel at the top of the canvas says what happened, in up to five lines with their marks (gold edge for a quest that succeeded or a passed Hide test, threat red for a failed quest or an engagement): "Quest failed · Willpower 3 against threat 5 · Threat +2", "Black Rider attacks · Attack 3 against Sam Gamgee's defense 2 · Shadow, Hasty Departure: … · 1 damage on Sam Gamgee", "Traveled to Bag End". Taps go through it to the cards under it, and a screen reader announces it. It closes after 4.5 seconds; the Log keeps every step.

**Log.** Log opens this round's engine steps on a paper panel, each with its cause in inkMuted under it (the rule title, or the card and its printed line), with the threat, willpower and attack icons and the token art as marks. Removed progress reads "2 progress removed from Into the Wild", never a minus sign. It is text, not a control.

**Android Back** closes the preview, then the log, then a pile's list, then puts back a sheet opened from the table, then folds a panel, and only then leaves the table.

### Resolution — phase 11
Won: scene `victory`. VICTORY in display caps with a gold text glow, scenario name muted. Each choice group has a centered eyebrow (Choose a burden, Choose a boon) and tiles two to a row; selected has the gold border and semibold name. A muted sentence names what will be written, then CONFIRM. Both carry the NavBar `‹ Path` (choices already made are saved, so leaving loses nothing). Lost: scene `plain`, "Defeat" in display, "The scenario was lost. Nothing is written to the log." and one text button Back to path.

A choice each player makes (141044, A Knife in the Dark: a boon on a hero) is asked one seat at a time, starting with the first player. Under the eyebrow a muted line names the seat ("Player 2 (first player) chooses"; none in true solo), and under it one muted line for each seat that has already confirmed ("Player 2: Tireless Ranger on Sam Gamgee", "Player 2: No boon"). Each tile is the boon's picture and both names, "Tireless Ranger on Sam Gamgee", one tile per boon and hero the seat controls; tiles are two to a row, and an odd last tile keeps the half width. A choice the card lets a seat pass has a visible decline in the pinned footer, under CONFIRM in thumb reach: the bone text button No boon, with the word Selected under it in gold once tapped. It is a radio in the same radio group as the tiles. Before anything is chosen, the sentence above CONFIRM is built from the noun: "Choose a boon and a hero, or tap No boon. Your choice is written to the campaign log when you confirm." ("Choose a burden, or tap No burden." for a burden, without the "or" when the card allows no decline). Once chosen, it says what the choice writes ("Tireless Ranger is attached to Sam Gamgee and recorded on the log.", or "Player 2 takes no boon. Nothing is recorded for this choice."); CONFIRM is disabled until a tile or the decline is chosen. The last sentence names each boon on its hero ("Confirming records Tireless Ranger on Sam Gamgee in the campaign and unlocks Flight to the Ford."). The campaign log's Boons row shows the same "boon on hero", with "Player N:" in front in two-handed play; the log, the resolution screen and the table's sheets all name a seat "Player N".

### Decks — placeholder built (editor: phase 6)
Scene `plain`, title Decks, Import and New as text buttons. Each deck is a cover (three hero pictures, fading into night) with the name in title size and the heroes' short names in muted. Starters are smaller covers two across. The starter note is one muted sentence. Card pool is a row at the bottom.

### Deck editor — phase 6
Hero pictures fill the top third and fade into night, with each hero's name in Marcellus and sphere word below (Saga only in gold for a Fellowship hero). Deck name in title size and the count against 50 (danger when short). A refusal is a danger sentence naming the card and the rule. Card rows are `ListRow`s with a 28×38 thumb and the count. SAVE is the primary, disabled while a refusal is on screen.

### Card pool and filter — phase 6
`ListRow`s with the 32×44 picture, name, and "Type · Sphere · Cost" detail. Search field is a raised pill. Filter is a `PaperSheet` with chip groups (sphere chips carry the pip), rows for pack, trait, cost, and two switches. APPLY is the ink primary. No matches: "No cards match." in muted.

### Card — built
Scene `plain`. See Card pictures. Under the name, one centered muted line: the type and the sphere with their icons, and Unique with the gold unique icon. The traits as printed ("Dúnedain. Ranger.") in semibold italic gold. The numbers are a centered row of raised tiles: icon and value in Marcellus title size, the word under them in label. The text is a raised `rounded-card` panel: one paragraph per printed line, the timing words (Action:, Response:) semibold, the stat and sphere icons inline in place of their bracket words, flavor italic and muted (`CardTextView`, src/play/card-text.ts parses the catalog's markup). Inactive text carries a muted line under it in the panel. Missing card: title Card and "Card {code} is not in the catalog." Errata: a goldLine-outlined panel with the gold eyebrow Errata and the errata set the same way.

### Packs and pack cards — built
Scene `plain`. Packs: title and `ListRow`s. Pack cards: NavBar `‹ Packs` (testID `pack-back`), pack name, rows with thumb and collector code detail. Unknown pack and empty pack sentences as before.

### Booklet — phase 10
The PDF page fills the screen on night. Close is a centered text button at the bottom in thumb reach. Missing file: a dashed gold outline of a book with a ring, the book name in title size, "This booklet is not on this phone. Scenarios still play without it.", and ADD BOOKLET.

### Database — built
Scene `plain`. Title Database, the failure in body. No retry.

## States

| State | Treatment |
| --- | --- |
| Empty | A muted sentence that says what is missing. The title stays. |
| Loading | The splash is the startup wait. A later wait shows the title and the word Loading in muted. No spinner package. |
| Error | Danger sentence naming the card, the book, or the failed open. |
| Locked | Faint text, hairline ring, the word Locked. Not pressable. |
| Current | Gold ring or gold edge, plus the word Current when it is not obvious. |
| Completed | Gold disc, the word Completed or the reward names. |
| Refused | Danger sentence naming the card and the rule. Save does not happen. |
| Failed test | The word Failed in Marcellus plus the engine's numbers. |
| Armed | A button that sends with nothing picked, after its first tap: the line above the buttons says what the second tap does ("Tap again: no one quests") in gold, with a 2 pt gold bar running down for three seconds (ten with a screen reader), and a light haptic tick. The button keeps its size, place and label. A moment with one answer arms nothing. |

An irreversible control (Deal, Confirm, a resolution choice) shows the consequence in a sentence directly above it. On the table no single tap sends an intent: a tap picks and a button confirms, and a button that sends with nothing picked is armed first; only a moment with one legal answer sends on one tap.
