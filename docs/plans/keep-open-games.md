# Plan: keep open games through updates

## Context

An open game is saved as `{ engineVersion, dataHash, seed, intents }` and rebuilt on open by replaying its intents (`src/campaign/replay.ts`). `staleReason` (`src/campaign/session.ts`) drops the game when either number differs from the build's, and the screens write the drop as they read the row (`src/screens/data/use-save.ts`, `src/screens/data/standalone-store.ts` through `droppedIfStale`), so the moves are gone before the player reads why. Three faults make that worse than it needs to be:

- **The data guard is global.** `dataHash` is `CATALOG_VERSION`, a hash of every pack, card and campaign row (`scripts/build/catalog.ts`). Adding any scenario, or editing the campaign index, moves it and drops every open game in every box.
- **The engine guard predicts instead of checking.** `ENGINE_VERSION` is bumped by hand for any change that can move a replay. Most bumps reach one scenario's games, and each drops all of them.
- **The guard has holes.** Scenario files, campaign files and effect records are bundled code (`src/screens/data/campaign-data.ts`, `src/effects`), outside `CATALOG_VERSION`: a change to one that misses an engine bump is caught by nothing.

The goal: a new scenario or card never touches another game, a game whose replay still matches carries on with no message, and a game a change does reach shows a warning that says what changed and lets the player choose to **Continue** (from where they were, on the new rules) or **Restart** (user decision, 2026-11-11). The app never deletes an open game on its own.

The safety rule: trust what can be checked, not a version number. A game resumes silently only when the current engine, replaying the saved moves, rebuilds the table the player last saw. Continuing from a stored table snapshot is the one migrated path: offered only on the player's choice, and only after the snapshot passes a check against the current engine (user decision, 2026-11-11).

## What does not move

- Every replay of a current save (same engine version, same data) takes the path it takes now, with no extra work on it: no digest is computed while replaying a current save.
- `src/rules/engine/version.ts` keeps `ENGINE_VERSION` at its value; no rule changes. Every `golden.json`, step log, fixture and `data/` file is unchanged, except the per-move checks section E adds to the golden snapshots.
- The per-intent write stays the size it is now plus one number (`writeActive`, `writeStandaloneActive`). The table snapshot is never written per intent.
- Undo, relaunch replay, skip, Back, the haptics and the banner wait behave as they do. `src/play/compiler.test.ts` stays at zero bailouts. `src/screens` imports nothing from `src/rules`.
- Out of scope: shipping old engines beside the new one (the bundle grows with every bump and the old engine also needs the old data).

## A. Never drop on read

- `use-save.ts`, `standalone-store.ts`, `src/screens/session/table-open.ts` and `src/screens/session/standalone-open.ts` no longer write a drop for a stale open game. They report that it needs a choice and leave the row as it is.
- A sheet on the two table routes (`src/screens/routes/table/[saveId].tsx`, `src/screens/routes/standalone/table/[gameId].tsx`), built from the design system's reading panel and buttons, warns that the rules or the card data changed since the game was dealt and offers:
  - **Continue**: replay the moves on the new rules as far as they are accepted and play on from there; the sheet says the table may not be the one left.
  - **Restart**: deal the scenario again with the stored loadout and a new seed (`deal`, `dealStandalone`), keeping the log and the decks as a drop does now.
- Leaving the sheet without a choice writes nothing; it shows again on the next open. The lists say "Needs a choice" in place of "Dropped" (`src/screens/history/entries.ts`, `src/screens/history/standalone-words.ts`), and the sheet's words replace `droppedSentence` and `STANDALONE_DROPPED`.
- An open scenario that does not parse at all is still dropped, with its message.

## B. Scope the data guard to the game

- `worldHash` (`src/campaign/world.ts`) hashes what a replay of this game reads: the printed rows of `worldCodes(...)` with the loadout's codes and `logCodes(log)`, the scenario and campaign data, and the effect records of those codes. It reuses the content hash of `scripts/build/catalog-version.ts`, moved under `src/catalog` if the lint zones need it.
- `ActiveScenario` gains `world`, with a Zod default in `src/campaign/save.ts`; `beginActive` stamps it, and the stale check compares it with the opened world's hash instead of comparing `dataHash` with `CATALOG_VERSION`.
- A save written before `world` existed is current when its `dataHash` equals `CATALOG_VERSION` and its engine version matches: it is stamped with `world` and written back on open. Sections A to C ship in a release with no card, campaign or engine change, so open games convert cleanly.

## C. Check the replay move by move

- `tableDigest(state)` (`src/campaign/digest.ts`) is a 32-bit hash of a curated view of the table: each card in id order (code, zone, face, exhausted, damage, progress, resources, host, controller, committed), each seat's threat, the phase, the round, the quest stage, and the open window's kind and seat. It leaves out `undo`, caches and internal queues, so a new state field does not change it; a hidden difference that matters shows at the next move that changes the table.
- `recordIntent` appends the digest of the state after the intent to `checks` beside `intents` (Zod default `[]`); `dropLastIntent` drops both.
- When the engine version or `world` differs, the replay runs checked: it compares each digest and returns either a match (every move accepted and matching: resume with no message and restamp the versions) or the index of the first move that was refused or does not match. The sheet of section A shows only on a mismatch, or for a stale save with no checks to compare.
- A current save without checks gets them on its next open, written back.
- Measure: `tableDigest` per move and the checked replay of the longest golden, before and after, with a scratch script; both stay under about 1 ms a move.

## D. Continue from where you were

- A nullable `checkpoint` column on `saves` and `standalone_games` (a Drizzle migration) holds `{ stateVersion, intentCount, state }`: the scenario state without `undo`, written at each phase boundary and on the play clock's pause write, never per intent.
- `src/rules/engine/state-version.ts` holds `STATE_VERSION` and the ordered pure migrations from each version to the next, and `checkState(state, ctx)`, which refuses a state the current engine cannot play: a code not in the world, an unknown zone, a missing host, a wrong seat count, or `legalIntents` throwing.
- On a mismatch, Continue migrates the checkpoint, checks it, replays the moves after `intentCount` checked as far as they match, and rebases the save onto it (`ActiveScenario.from`, the state a replay starts from in place of `startScenario`). Undo cannot go back past the rebase. When the checkpoint fails its check, Continue resumes at the last matching move and the sheet says how many moves that takes back. Restart is always offered.
- `runs` gains a `rebased` flag (a migration) so History can mark a game finished across an update.
- `docs/brief.md` (Persistence and shipping) and `docs/architecture.md` (Persistence) state the new rule in place of "Do not migrate a half-played game during this box", stamped (user decision, 2026-11-11). `PRIVACY.md` names the checkpoint, a new kind of data kept on the device.
- Measure: the checkpoint write at a phase boundary on the longest golden.

## E. Say what changed, before and after the update

- `src/rules/engine/version.ts` holds `ENGINE_CHANGES`, one entry per bump with the scenarios it reaches (or all) and one line for players, in place of the comment history. The sheet lists the lines between the save's version and the build's that reach its scenario; a `world` change says the cards or the scenario changed.
- The golden suite (`test/harness/golden-suite.ts`) writes each golden's checks into its file snapshot, so a scenario's checks move only when a change reaches its games.
- `scripts/release/notes.ts` replaces the blanket "A scenario left open in an earlier release is dropped" line under Before you update with the scenarios whose golden checks or `ENGINE_CHANGES` lines changed since the last tag: open games of those may ask to continue or restart.

## Checks

- Tests: an unrelated catalog row leaves `worldHash` unchanged; a game whose replay matches resumes across an engine bump with no message; a changed check gives a mismatch at that move; a stale game is not written on read; a checkpoint round-trips to an equal state and `checkState` refuses one with an unknown code; Continue rebases and a later replay from `from` gives the same state; Restart keeps the log.
- The web build: a save with an older engine version and a mismatching check shows the sheet, Continue lands on the checkpoint's table, Restart deals again, and leaving writes nothing.
