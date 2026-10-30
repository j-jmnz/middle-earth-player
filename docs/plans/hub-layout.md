# Hub layout: one layout for Campaigns and Scenarios, History as the library

The user approved this redesign on 2026-10-30. They took every recommendation of the proposal (artifact "Campaigns and Scenarios Hubs") except the archive and history decision, where they chose the library in History. The decisions below are settled. When this work is done, `docs/design-system.md` and `docs/brief.md` describe the result, and this file moves to `docs/plans/done/`.

The Campaigns and Scenarios tabs do one job with two layouts. They become one: a hero for the current run over its scene, the other runs as rows, a catalog, and Coming later. Archived and finished runs, and Archive, Restore and Delete, live in History. This is a UI task: styling stays. **The fog (backdrops) and the art (`HeroArt`, `SceneArt`, `GroundedScene`, `HeroTile`) are not changed**: same components, sizes, crops, fades and Screen `scene` values. Scenarios only starts using `HeroArt` the way Campaigns does.

## Settled decisions (user instruction, 2026-10-30)

- **Tapping a campaign tile pushes a campaign setup screen** on the briefing's frame. Tapping a scenario tile pushes the briefing.
- **The library is History.** The hubs show only slots 1 to 4 below. Archived and finished runs, and Archive, Restore and Delete, move into the History screen. Manage goes.
- **Coming later on Scenarios** holds the unplayable scenarios (captioned "Box · N") and the locked boxes.
- **On a tablet in landscape** the hero and the other runs sit side by side, with the catalog full width below.
- **The smaller defaults**:
  - the hero is the latest unfinished run;
  - the subtitle shows only when nothing is in progress;
  - the overline reads "In progress" in both heroes;
  - the other runs are headed "Other journeys" and "Other games";
  - "New playthrough" heads the campaign catalog;
  - there is no featured start block.
- **The hub, identical on both tabs**, in this order:
  1. **Current run (hero)**: the latest unfinished run, over its scene. It holds the screen's one primary.
  2. **Other journeys / Other games**: the other unfinished runs, as rows.
  3. **Catalog**:
     - Campaigns: "New playthrough", one tile per playable campaign.
     - Scenarios: one fold per box, holding only its playable scenarios.
  4. **Coming later**: locked tiles.
- **The header** holds History and the gear. Archived, finished and Manage all live in History.

## Tasks, in order

Each task updates the tests and the `.maestro/*.yaml` flows that read a string, a testID or a layout it changes. Task 6 rewrites the design-system and brief passages that the tasks supersede, following `.cursor/rules/docs-standards.mdc`: rewrite the passage, no history.

### 1. Shared hub parts

New `src/screens/hub-parts.tsx`, moved from the existing screens and not redesigned. No screen changes visibly.

- **`RunHero`**: `SaveHero` from `save-panels.tsx`, taking `{ overline, title, detail?, seats, testID }` instead of `SaveLine`.
  - `SaveHero` reads only the line's seats and name. Every size, overlap, shadow, Light glow and accessibility label stays exactly as it is.
  - `detail` is an optional muted line under the title. Scenarios uses it for "Fellowship of the Ring · Scenario 2 · Normal".
- **`RunRow`**: `SaveRow`, taking `{ testID, title, line, lead, accessibilityLabel, onPress }`.
- **`CatalogTile`**: the 64 pt row (phone) and the poster (tablet) of a scenario on the Scenarios tab. It takes the scene id, the optional number badge, the name, the line, the line's tone and `onPress`. The `badge` diamond moves with it.
- **`LockedTiles`**: the Coming later block of the Campaigns tab, taking `{ id, name, caption }[]`.
- **`HubPage`**: the shared page frame. It holds the column measure, `heroDrop`, the `HeroArt` placement (including the expanded `pageWidth` and `right` edge) and the slot order.
  - Props: `{ testID, header, subtitle?, hero?, sceneId?, others?, catalog, coming? }`.
  - Two columns only when the window is expanded, `useSplitColumns(SIDE_RANGE)` gives a side, and both `hero` and `others` exist. The right column holds `others` only.
  - The catalog and Coming later go full width below.
  - With no hero it uses `scene="moon"` and no art. With a hero, `scene="hero"`.

Pure helpers in `src/screens/hub-runs.ts`, with `hub-runs.test.ts`:

- **`splitRuns(runs, unfinished)`**: returns `{ hero, others }`. The hero is the first unfinished run in list order; the others are the remaining unfinished runs.
- **`comingScenarios(boxes, isPlayable)`**: the unplayable scenarios, each as `{ id, name, caption: "<box> · <n>" }` in book order.
- **`nextLabel(next, path)`**: "Next · Scenario 3 of 6" or "On the table · Scenario 3 of 6".

### 2. Campaigns hub (`(tabs)/index.tsx`)

- **Header**: History and the gear. Manage goes.
- **Subtitle**: "Play a box's scenarios in order, with its log, boons and burdens.", shown only when there is no hero.
- **Hero**: from `splitRuns(listSaves(user), save => nextStep(path, loadout).kind !== "finished")`.
  - Overline: "In progress · {seats}".
  - The title is the campaign name, with the fellowship from `fellowshipOf`.
  - Under it, **`NextStop`**: `ContinuePanel` cut down to the lit stop only, in `save-panels.tsx`.
    - Eyebrow `nextLabel(...)`, the name at 24, Begin or Resume (`continue`), then Full path (`continue-path`) and Campaign log (`continue-log`).
    - It keeps the `save-<id>`, `continue-next` and `continue-campaign` testIDs.
  - The road goes: `RoadLine`, `RoadStop`, `quietRow`, the folded wins, and `campaign-road.ts` with its test.
- **Other journeys**: unfinished saves after the hero, as `RunRow`s (two across on medium). They open the path.
- **New playthrough**: an `Eyebrow` and one `CatalogTile` per startable campaign (`row.playable && campaignOf(row.id)`).
  - Scene: `data.scenarios[0]`.
  - Line: "6 scenarios".
  - No number badge.
  - testID `new-<campaignId>`.
  - It pushes `/campaign/[campaignId]`.
  - Rows on a phone; three posters across on a tablet.
- **Coming later**: `LockedTiles(lockedTiles(campaigns))` in a `FoldSection id="coming"`.
- **Remove**:
  - `StartPanel` usage, the `starting` and `managing` state, `deleting`, `KeepOrDelete` and the archive, restore and remove functions;
  - the Archived block, `startBlock`, `newButton`, the scroll-to-start ref, and the `start` param handling. `start=1` scrolls to New playthrough (see the notes).
- Finished playthroughs are not on the hub. They are in History.

### 3. Campaign setup screen (new `routes/campaign/[campaignId].tsx`)

- It is built on `BriefingScreen` (`briefing-parts.tsx`).
  - `testID="campaign-setup"`, `backLabel="Campaigns"`, `onBack: goBack(router, "/")`, no booklet.
  - The scene is the campaign's first scenario.
- Banner: overline "Campaign · N scenarios" and the name. It uses the `ScenarioBanner` styles without stage chips: a `chips?` opt-out or a small sibling banner.
- Children:
  - **Players**: the `Segmented` and "Can't be changed later.", from `start-panel.tsx`, keeping the `seats-1` / `seats-<id>-<n>` testIDs and labels.
  - **Carry over**: shown when offers exist, with the `carry-over`, `carry-none` and `carry-<saveId>` rows.
- `bar`: `PrimaryButton "Start campaign"`, `start-fellowship` / `start-<id>`, with the same accessibility label.
- On start: `createSave(...)`, then `router.replace(pathHref(save.id))`, so Back from the path returns to the hub.
- Offers are computed from `carryOffers` over open and archived saves, `deckFaces`, `savedAt`, `carrySource` and `carryWords`. That computation is a hook, `useCarryChoices(catalog, user)`, in `carry-words.ts` or a new `carry-choices.ts`, so the hub does not need it.
- `BriefingScreen` takes optional `backTestID` / `barTestID` props in place of its fixed `briefing-back` and `briefing-deal-bar`: `campaign-setup-back`, `start-bar`.
- `start-panel.tsx` is deleted once nothing imports it. `RadioTile` moves into `chrome` or the new route's parts file.
- No `_layout.tsx` entry is needed; orientation inherits.

### 4. Scenarios hub (`(tabs)/scenarios.tsx`)

- **Header**: History and the gear. Manage goes.
- **Subtitle**: "Standalone adventures. No campaign log, boons or burdens.", only when there is no hero.
- **Hero**: from `splitRuns(listStandalone(...)` after `droppedIfStale`, `game => standaloneStatus(game) === "playing")`.
  - `RunHero` with overline "In progress · {seats}", the scenario name as the title, and detail "{box} · Scenario {n} · {difficulty}". The Nightmare Eye prefixes it, as `GameLine` does, or "Nightmare" is in words.
  - The fellowship is `game.loadout.seats.map(s => s.heroes)` through `deckFaces` and `heroFace`.
  - Then `PrimaryButton "Resume"` (`resume-<id>`), a 320 pt plate outside a phone, as `NextStop` is.
  - `HubPage` draws `HeroArt` on `game.scenarioId`, exactly as Campaigns does. The banner `SceneArt` card goes.
- **Other games**: the other playing games as `RunRow`s ("True solo · Normal · On the table"). They open the table.
- **Catalog**: one `FoldSection` per box (`box-<id>`), each with only its playable scenarios as `CatalogTile`s.
  - Each keeps its book number (index in `box.scenarios` + 1), the standing line and `standalone-<id>`.
  - Posters: six across expanded, three on medium.
  - A box with no playable scenario is left out.
- **Coming later**: `FoldSection id="scenarios-coming"` with `LockedTiles` showing `comingScenarios(BOXES, isPlayable)`, followed by `lockedTiles(campaignListQueries(catalog).campaigns.all())`. The latter reads the `campaigns` table only, never `cards`.
- **Remove**:
  - `managing`, `deleting`, `KeepOrDelete`, the archive, restore and remove functions, and `renderGame`'s banner and finished rows;
  - the `standalone-games` and `archived-games` blocks and `DELETE_SENTENCE` (it moves to History).
- `standing(id)` keeps reading open games, so "Won · 87" shows on the tile.

### 5. History becomes the library (`history-view.tsx`, `history-list.ts`, `history-words.ts`)

- The route, the `kind` param, `history-open`, the Campaign / Standalone switch and the scope and result filters stay.
- **New pure builder** in `history-list.ts`: `libraryItems({ kind, saves, archivedSaves, games, archivedGames, runs, filter, folded })`, which returns flat FlashList items.
  - Items are a section heading ("In progress", "Finished", "Archived", "Deleted", with testIDs `library-in-progress`, `library-finished`, `library-archived` and `library-deleted`), a ref header (one playthrough or game) and a run.
  - Refs come from the stores, so a playthrough or game with no run is listed. Runs attach by `refId`.
  - Runs whose ref is gone go under "Deleted", grouped as before.
  - Campaign:
    - In progress = open saves whose `nextStep` is not finished.
    - Finished = open saves where every scenario is won.
    - Archived = `listArchivedSaves`.
  - Standalone:
    - In progress = playing games.
    - Finished = won, lost or dropped open games.
    - Archived = archived games.
  - Each standalone game holds at most one run (`standalone:<gameId>`), so a game's header is its row. Its run details render inline, with no fold.
  - With a filter on, only refs that have a matching run show.
  - Unit tests in `history-list.test.ts`.
- **Ref header**:
  - Campaign: a `FoldHeader` with title, detail and run count, without the Current/Archived badge, since the section says it.
  - Standalone: a `RunRow`-like line.
  - Both end in a "⋯" button (`ref-menu-<id>`). `FoldHeader`'s `right` slot is hidden while folded, so it takes a `rightAlways` (or similar) prop.
- **Ref sheet** (`SheetModal`, modelled on the unsaved-changes sheet in `routes/deck/[id].tsx`). It is titled with the ref's describe line and has:
  - Campaign: Open path, Campaign log, Archive or Restore, Delete.
  - Standalone: Resume, Outcome or Play again (by status), Archive or Restore, Delete.
  - Delete uses `KeepOrDelete` inside the sheet, with its in-place confirm (`delete-yes-<id>`).
  - Campaign delete calls `recordUnclosedRun` when `save.active`.
  - Each action announces for accessibility, then refreshes and closes the sheet.
- `emptyWords`: History is empty only with no refs and no runs. The sentences read "No playthrough yet. Start one from Campaigns." and the standalone equivalent.
- `history-view.tsx` is near its size limit; the sheet goes in `history-sheet.tsx`.

### 6. Docs, flows, tests

- `docs/design-system.md`: rewrite the Campaigns (campaign list), Scenarios and History screen sections to match. Add a Campaign setup screen section next to Briefing. Update the Navigation hub-head line (no Manage). Then run `pnpm docs:index`.
- `docs/brief.md`: rewrite what it says about the start panel (`start-<id>`), Manage and Archived on the hubs, and the Screens table rows for Campaign list, History and Scenarios, to the new shape.
- Doc citations in code name real headings, or `scripts/docs-index.test.ts` fails. The headings "Campaigns (campaign list)", "Scenarios", "History" and "Tablets" stay; "Campaign setup" is added. The comments that cite "Campaigns, tablet landscape" (`index.tsx`), "Campaigns" (`save-panels.tsx`) and Tablets (`split-columns.ts`) match the new text.
- Maestro flows (`.maestro/`), written but not run in a cloud session:
  - **`briefing.yaml`, `booklet.yaml`**: tap `new-fellowship-of-the-ring`, assert `campaign-setup`, then tap `start-fellowship`.
  - **`mirkwood-start.yaml`**: tap `new-mirkwood-paths`, then `start-mirkwood-paths`. Its comment about one start panel with a campaign chooser is rewritten.
  - **The 12 flows that relaunch and tap `continue-path`**: `scenario-1`, `the-oath`, `escape-from-dol-guldur`, `resolution`, `the-ring-goes-south`, `the-ring-goes-south-win`, `journey-along-the-anduin`, `passage-through-mirkwood`, `flight-to-the-ford`, `flight-to-the-ford-win`, `flight-to-the-ford-loss` and `a-knife-in-the-dark-loss`. They keep working while their save is unfinished. Each is checked. One whose save has every scenario won by that point goes through History instead (`history-open`, then `ref-menu-<id>`, then Open path).
  - **`the-caves-of-nibin-dum.yaml`**: it asserted `continue-next` "Every scenario is won" on the hub. A finished playthrough is not on the hub, so it opens History, finds the playthrough under Finished (`library-finished`), then taps Open path in its sheet.
  - **`scenario-1-loss.yaml`, `seat-peek.yaml`, `history.yaml`**: they assert `continue-next` with the words "On the table: A Shadow of the Past". `continue-next`'s accessibility label stays `nextSummary(line.next)`, so these match, while the visible eyebrow reads "On the table · Scenario 1 of 6".
  - **`sections-fold.yaml`**: `section-coming` stays on Campaigns. Scenarios' Coming later uses the fold id `scenarios-coming`, because folds are stored per id in `settings` and the two hubs must not share one. `section-box-*` is unchanged.
  - **`history.yaml`**: History opens on the tab's kind. `history-empty` still holds for Standalone when no game exists.
  - **`scenarios-boxes.yaml`**: unchanged. The `box-*` and `standalone-*` ids stay, and the three scenarios it asserts are all playable.
- `docs/phases/STATUS.md`: the phone checks (Maestro runs, iPad landscape and portrait) stay open, since a cloud session has no phone or simulator.

## Notes for the implementer

- **Read first:** `.cursor/rules/authority.mdc`, `code-standards.mdc` and `docs-standards.mdc`. Comments say what the code is, not its history. Match the surrounding comment density and naming.
- **Do not touch the art or the fog.**
  - `HeroArt`, `SceneArt`, `GroundedScene`, `HeroTile`, `backdrop*`, the `Screen scene` values and every size, crop, fade and shadow stay.
  - Moving code into `hub-parts.tsx` is a cut-and-paste. If a number changes, it is a bug.
  - The Scenarios hero uses `HeroArt` with the same arguments the Campaigns hub uses.
- **One primary per screen.**
  - The hero's Begin or Resume is the only `PrimaryButton` on a hub.
  - Catalog tiles are pressable surfaces with a chevron, not buttons.
  - With no hero there is no primary on the hub, which is fine; the setup screen or briefing holds it.
- **Testids are a contract** (docs/design-system.md, Screens).
  - Kept: `campaign-list`, `scenarios`, `history-open`, `continue*`, `save-<id>`, `resume-<id>`, `standalone-<id>`, `box-<id>`, `seats-*`, `start-*`, `carry-*`, `locked-<id>`.
  - Removed: `manage-playthroughs`, `manage-games`, `new-playthrough`, `start-cancel`, `campaign-choice-*`, `archived-*` on the hubs, `standalone-games`, `standalone-playing`, `game-<id>`.
  - Grep `.maestro/` and `src/` for each before removing it.
- **Hero rule.**
  - Campaigns: `listSaves` is sorted by `updatedAt`; the hero is the first unfinished save.
  - Scenarios: `listStandalone` is sorted by `createdAt`; the hero is the first playing game.
  - Apply `droppedIfStale` and persist it with `writeStandaloneActive` when reading games, on the hub and in History.
- **`start=1` from the path** (the path screen's "Start a new campaign"): nothing picks a "next campaign". It navigates to `/` with `start=1`, and the hub scrolls the New playthrough section into view. The setup screen's default is Fresh start.
- **Tablets** (docs/design-system.md, Tablets).
  - Medium: one 640 column, Other journeys two across, posters three across.
  - Expanded: split only when there is a hero and others, per `split-columns.ts` (main at least 400). Otherwise the hero takes the main column, capped at 620, in a wide scroll, and the catalog is full width.
  - Phones stay portrait (`_layout.tsx` locks them), so phone landscape needs no work.
- **History performance.** It stays a FlashList with flat items and `getItemType`. Folded groups emit no run items. Nothing reads `cards` except `deckFaces` for the names.
- **Accessibility.**
  - The hero reads as the Campaigns hero reads.
  - The ⋯ button is labelled "Actions for {describe}".
  - The sheet has a `scrimLabel`.
  - Archived, Restored and Deleted are announced as the hubs announce them.
- **Deleting a standalone game** that ended but whose outcome screen was never opened loses its run. This plan leaves that alone; note it in the doc if it is touched.
- **Size** (`.cursor/agents/reviewer.md`): past about 300 lines a file needs one reason to stay together, and past about 500 it is a blocker. `index.tsx` and `scenarios.tsx` shrink a lot, since `HubPage` does the layout. The History sheet is split out of `history-view.tsx`.
- **Code standards** (`.cursor/rules/code-standards.mdc`):
  - React Compiler with zero bailouts: no hand-written `useMemo`, no try/catch in components, no non-literal default parameters. The hubs use `useMemo` now; drop it in code you move.
  - List screens select only the columns their rows read.
  - `src/screens` imports nothing from `src/rules`.
  - `//` comments say what the code does now, in sentence case, and cite docs by heading.
- **Fold ids are global** (`useFolds`, stored in `settings`): Scenarios' Coming later has the id `scenarios-coming`, so it does not share Campaigns' `coming`.
- **Unchanged modules**: `standalone-words.ts` (`gameCaption`, `statusWord`) is also used by the outcome and table screens. History's standalone rows reuse `gameCaption`. `campaign-list.ts` / `lockedTiles` stay (`campaign-list.test.ts` covers them). `section-store.test.ts` uses literal fold ids only.
- **Stores stay as they are.** `archiveSave`, `restoreSave`, `deleteSave`, `archiveStandalone`, `restoreStandalone` and `deleteStandalone` are called from History; their tests are unchanged.
- **Before each commit** run `pnpm test`, `pnpm lint`, `pnpm docs:index` and `npx tsc --noEmit`.

## Out of scope

- New data: the locked boxes have only a name and a count in `data/campaigns/index.json`, so they show as box tiles only.
- Styling changes.
- The path screen.
- The briefing's contents.
- The table.
- The standalone delete-before-outcome run loss.
- The fog and the art (Settled decisions).

## Exit

- `pnpm test`, `pnpm lint`, `npx tsc --noEmit` and `pnpm docs:index` are green.
- Web check: `pnpm catalog:build`, `npx expo export -p web`, served with COOP/COEP headers; a scratch Playwright script shoots these states at 390×844, 820×1180 and 1180×820:
  - an empty hub;
  - two campaign saves, one unfinished and one finished;
  - a standalone game in progress plus a finished one.
- Then confirm:
  - Slots 1 to 4 appear on both hubs, with no Manage and no Archived.
  - The art and fog match the earlier screenshots.
  - The Begin primary is on the first screen on a phone.
  - Tapping a campaign tile opens the setup screen, and Start campaign leads to the path.
  - History lists In progress, Finished and Archived, and the ⋯ sheet's Archive, Restore and Delete work.
- Phone checks (Maestro runs, iPad landscape and portrait) stay open in a cloud session: they are listed in `docs/phases/STATUS.md`.
