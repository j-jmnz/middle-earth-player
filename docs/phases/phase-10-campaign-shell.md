# Phase 10 — Campaign shell

Depends on: phases 6 and 8d
Blocks: phase 11
Can run beside: phase 9

## Goal

The campaign list, the Fellowship path, the briefing, and the log, on the campaign model from phase 8d. Scenario 1 can be won or lost through the reducer. The table does not exist yet. Chrome uses the tokens in `docs/design-system.md`. Do not invent a palette or a type scale.

## Screens

Campaign list is the root. Fellowship is playable. Later campaigns may show as locked, with name and scenario count. Locking does not hide cards from the builder.

Campaign path: six nodes in book order, read from `data/campaigns`. Only `a-shadow-of-the-past` is current. The other five are visible and locked. A won node shows what its campaign card's resolution recorded. The pool sits under the path. The log is one tap away.

```
a-shadow-of-the-past
a-knife-in-the-dark
flight-to-the-ford
the-ring-goes-south
journey-in-the-dark
breaking-of-the-fellowship
```

`seatCount` is 1 or 2, chosen once at campaign start. A save has its own id. The campaign id is `fellowship-of-the-ring`.

Log fields: heroes per seat, fallen heroes per seat, threat penalty, the campaign pool (boons and burdens, and the hero a Permanent card is attached to), captives, the six scenario rows with rounds and score, the campaign total, and notes. The engine computes each score with the Learn to Play formula (phase 8d). Notes are the only free text.

Briefing: stages in order, encounter sets and counts for Easy or Normal, special rules by name, one saved deck per seat, the Ring-bearer slot, validator errors that name the card. It shows what the Campaign Setup Checklist will do before the deal: pool cards going into decks or the encounter deck, Permanent attachments, and the threat penalty. A hero change is a choice the briefing offers. It states the +1 penalty before it commits, unless the campaign card waives it. A fallen hero cannot be picked. The three-hero rule runs on the saved deck. The saga rules run on the loadout. The Ring-bearer slot is required when the deck has no Fellowship Ring-bearer. Refuses to deal on failure. Two-handed play validates each deck, then requires a single Ring-bearer across the table. It does not reject two decks that share a unique card.

The campaign list reads `campaigns` and `saves`. It does not query `cards`.

`saves.activeScenario` is the seed, the intent log, the engine version, and the data hash (phase 8d). Loading replays it. When the engine version or the data hash differs, drop the in-progress scenario and keep the log, the decks, and the image index. Do not migrate a half-played game. Do not use Drizzle `useLiveQuery` for scenario state.

## Booklets

Add `expo-dev-client`. Verify one Expo PDF module against SDK 58. `react-native-pdf` stays out unless `@config-plugins/react-native-pdf` has an SDK 58 release. If that module does not build, use PDFKit on iOS and `PdfRenderer` on Android. The view renders a local file and reports the page. It does not annotate, search the prose into the app, or become a second document system. It is not a Skia surface and not a WebView.

The player can open a stored booklet from the campaign list, the path, the briefing, and the log, then close it and return to that same screen. (User request, 2026-10-25: the campaign list's booklet buttons moved to the Rules tab of the dock, which opens both books and returns to Rules on close.) The reader is full screen. The close control sits in thumb reach and has a testID. The engine does not read the PDF. Do not parse it. Do not commit it. Do not fetch the Asmodee CDN. A missing file does not block a scenario. The control offers to add the booklet and names which book is absent.

`user.db` `booklets` is one row per book: id, path, original filename, byte size, sha256, page count, and last page. Store one file per book in the document directory under `booklets/`. Those bytes stay eligible for backup. A catalog update does not delete the row or the file. `expo-document-picker` copies into the cache. Copy that file into `booklets/` before inserting the row. Gitignore the PDFs.

The ids for this box are `fellowship-of-the-ring` and `learn-to-play`. The same reader opens both. The campaign registry may record a page number per scenario. That number is an optional index. Do not invent page numbers, and do not copy headings out of the PDF. Opening from a scenario starts on that page when the number exists, and otherwise on the saved last page. Turning a page writes the last page.

## Resolution

A win from the reducer runs the resolution records of the scenario's campaign card, writes what they record, unlocks `a-knife-in-the-dark`, and shows those cards in the pool or on the attached hero. A loss writes nothing and leaves scenario 2 locked.

A dev-only way to submit the resolution intents is allowed while the table is absent. It sends only the choices `legalIntents` offers. It does not type damage, resources, threat, or progress. Give it a testID. Delete it in phase 11, and move the Maestro flow onto the real resolution screen in that same phase.

Replaying a won scenario is allowed and does not grant the reward a second time unless that scenario's script says so.

## E2E

`.maestro/briefing.yaml` deals a legal loadout and refuses a loadout with no Ring-bearer, naming the rule. `.maestro/resolution.yaml` uses the dev-only resolution control: a win unlocks `a-knife-in-the-dark` and shows the chosen cards after a relaunch; a loss leaves that node locked. `.maestro/booklet.yaml` asserts the empty state and the close control by testID. A smoke file, if a flow needs one, is a one-page PDF written for the test, not a page of MEC109. Do not assert ability text.

## Exit

On a device, a recorded win unlocks scenario 2 and shows the chosen cards, and the briefing for scenario 2 shows the earned burden going into the encounter deck. A recorded loss leaves scenario 2 locked. Kill and relaunch. The deck and the log are still in `user.db`. Importing a booklet copies it out of the picker cache into `booklets/`, opens it, restores the last page, and closes back to the same screen. A changed engine version drops `saves.activeScenario` and keeps the log, the decks, and the image index. The Maestro flows pass. The dev-only resolution control is still present for phase 11 to delete.
