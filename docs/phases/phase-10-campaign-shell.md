# Phase 10 — Campaign shell

Depends on: phases 6 and 8
Blocks: phase 11
Can run beside: phase 9

## Goal

The campaign list, the Fellowship path, the briefing, and the log. Scenario 1 can be won or lost through the reducer. The table does not exist yet.

## Screens

Campaign list is the root. Fellowship is playable. Later campaigns may show as locked, with name and scenario count. Locking does not hide cards from the builder.

Campaign path: six nodes in book order. Only `a-shadow-of-the-past` is current. The other five are visible and locked. A won node shows the reward that was chosen. The pool sits under the path. The log is one tap away.

```
a-shadow-of-the-past
a-knife-in-the-dark
flight-to-the-ford
the-ring-goes-south
journey-in-the-dark
breaking-of-the-fellowship
```

`seatCount` is 1 or 2, chosen once at campaign start. A save has its own id. The campaign id is `fellowship-of-the-ring`.

Log fields: heroes per seat, fallen heroes per seat, threat modifier, boons and which hero a permanent boon is stuck to, burdens, the six scenario rows, score, notes. Score stays 0 until a quest card or the Learn to Play states a formula. Cite the page in `docs/brief.md` if you encode one. Notes are the only free text.

Briefing: stages in order, encounter sets and counts for Easy or Normal, special rules by name, one saved deck per seat, the Ring-bearer slot, validator errors that name the card. The three-hero rule runs on the saved deck. The saga rules run on the loadout. The Ring-bearer slot is required when the deck has no Fellowship Ring-bearer. Refuses to deal on failure. Two-handed play validates each deck, then requires a single Ring-bearer across the table. It does not reject two decks that share a unique card.

The campaign list reads `campaigns` and `saves`. It does not query `cards`.

`saves.activeScenario` carries a schema version. When the engine version differs, drop the in-progress scenario and keep the log, the decks, and the image index. Do not migrate a half-played game. Do not use Drizzle `useLiveQuery` for scenario state.

## Booklets

Add `expo-dev-client`. Verify one Expo PDF module against SDK 57. `react-native-pdf` stays out unless `@config-plugins/react-native-pdf` has an SDK 57 release. If that module does not build, use PDFKit on iOS and `PdfRenderer` on Android. The view renders a local file and reports the page. It does not annotate, search the prose into the app, or become a second document system. It is not a Skia surface and not a WebView.

The player can open a stored booklet from the campaign list, the path, the briefing, and the log, then close it and return to that same screen. The reader is full screen. The close control sits in thumb reach and has a testID. The engine does not read the PDF. Do not parse it. Do not commit it. Do not fetch the Asmodee CDN. A missing file does not block a scenario. The control offers to add the booklet and names which book is absent.

`user.db` `booklets` is one row per book: id, path, original filename, byte size, sha256, page count, and last page. Store one file per book in the document directory under `booklets/`. Those bytes stay eligible for backup. A catalog update does not delete the row or the file. `expo-document-picker` copies into the cache. Copy that file into `booklets/` before inserting the row. Gitignore the PDFs.

The ids for this box are `fellowship-of-the-ring` and `learn-to-play`. The same reader opens both. The campaign registry may record a page number per scenario. That number is an optional index. Do not invent page numbers, and do not copy headings out of the PDF. Opening from a scenario starts on that page when the number exists, and otherwise on the saved last page. Turning a page writes the last page.

## Resolution

A win from the reducer writes the chosen codes, unlocks `a-knife-in-the-dark`, and shows those cards in the pool or on the attached hero, following the Permanent rule from phase 0. A loss writes nothing and leaves scenario 2 locked.

A dev-only way to submit the resolution intent is allowed while the table is absent. It sends `ChooseResolution`. It does not type damage, resources, threat, or progress. Give it a testID. Delete it in phase 11, and move the Maestro flow onto the real resolution screen in that same phase.

Replaying a won scenario is allowed and does not grant the reward a second time unless that scenario's script says so.

## E2E

`.maestro/briefing.yaml` deals a legal loadout and refuses a loadout with no Ring-bearer, naming the rule. `.maestro/resolution.yaml` uses the dev-only resolution control: a win unlocks `a-knife-in-the-dark` and shows the chosen cards after a relaunch; a loss leaves that node locked. `.maestro/booklet.yaml` asserts the empty state and the close control by testID. A smoke file, if a flow needs one, is a one-page PDF written for the test, not a page of MEC109. Do not assert ability text.

## Exit

On a device, a recorded win unlocks scenario 2 and shows the chosen cards. A recorded loss leaves scenario 2 locked. Kill and relaunch. The deck and the log are still in `user.db`. Importing a booklet copies it out of the picker cache into `booklets/`, opens it, restores the last page, and closes back to the same screen. A changed engine version drops `saves.activeScenario` and keeps the log, the decks, and the image index. The Maestro flows pass. The dev-only resolution control is still present for phase 11 to delete.
