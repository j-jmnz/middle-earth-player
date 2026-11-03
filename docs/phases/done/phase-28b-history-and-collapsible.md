# Phase 28b — Collapsible sections and run history

Depends on: phase 28
Blocks: phase 29

User request, 2026-10-27: "Make scenarios and campaign sections collapsible, add a history screen for both campaign and scenarios, it will show a list with the corresponding runs and relevant information." It runs after phase 28, which rewrites both tabs (one start panel per campaign, one section per box).

**Review rule (user instruction, 2026-10-27):** one review round per phase. The main session runs `/reviewer` once on this phase's diff and `/ux` once (this phase changes `src/screens`), hands their blocks to one implementer fix pass, and closes the phase without re-running the reviewers. A block that fix pass leaves open is recorded in this phase's `STATUS.md` note. This replaces "until `/reviewer` reports no blocks" for phases 27 to 33.

## Goal

The Campaigns and Scenarios tabs fold their sections. A History screen lists every finished run, campaign and standalone, with what happened in it. Nothing in the engine, the log or the goldens changes.

## Collapsible sections

- Campaigns tab: each section the tab shows (the current playthrough, other journeys, one start panel per campaign, archived, coming later) has a header that folds and unfolds it. The existing `archived-toggle` becomes one instance of the same control; its testID stays.
- Scenarios tab: each box section (Fellowship, Revised Core, The Dark of Mirkwood) and the archived list fold the same way.
- One shared header control in `src/screens` (chevron, title, count when folded), following `docs/design-system.md`: 44 pt target, `accessibilityState.expanded`, an announcement on toggle. No new palette, type step or animation system; motion follows phase 23's rules.
- Fold state is per viewer and survives a relaunch: one `settings` key (`sections`), a map from section id to folded. Defaults: everything unfolded except the archived lists, which stay folded as today.
- testIDs: `section-<id>` on the header, `section-<id>-body` on the body.

## Run history

- **What a run is.** Campaign: one scenario attempt inside a playthrough, won or lost. Standalone: one standalone game that ended. A game abandoned or still open is not a run.
- **Record.** A new `user.db` table `runs` (a Drizzle migration), one row written when a scenario ends, beside, not inside, the campaign log: the log's rule that a loss writes nothing stays. Columns: id, kind (`campaign` | `standalone`), save id or standalone game id, campaign id (null for standalone), box, scenario id, result (`won` | `lost`), the loss cause the engine reports (threat elimination, heroes dead, life 0, a quest card's loss line), seat count, each seat's heroes, rounds, each seat's final threat, victory points and score on a win (from the engine; never typed), the reward chosen on a win, started and ended times, engine version. A run row is never rewritten.
- **Back-fill.** On migration, write rows for what the store already knows: each won scenario row in each save's log and each standalone game with a result. Back-filled campaign losses cannot exist; the screen does not invent them. A back-filled row marks the fields it could not know as absent.
- **Screen.** Route `history`, opened from a History button on each tab (`history-open`), landing on that tab's kind. A segmented switch (`history-campaign`, `history-standalone`) changes kind. Each row (`run-<id>`): scenario name and box, won or lost (with the loss cause), date, seats and heroes, rounds, final threat; on a won campaign run the score and the reward. Newest first. Campaign runs group under their playthrough (a foldable header, the same control as above), with the playthrough's name and campaign; an archived playthrough's runs stay listed. Filters: campaign or box, result. An empty list says so in one line.
- Tapping a campaign run opens that playthrough's log; a standalone run opens its outcome screen when the game still exists. A deleted save or game keeps its runs; its row says it was deleted and does not open.
- No control edits or deletes a run in this phase.

## Brief

`docs/brief.md`: the `runs` table in the `user.db` list; a History row in the Screens table; "collapsible sections" on the Campaigns and Scenarios rows; the run-versus-log rule (a loss writes a run, not a log entry).

## Tests

Run written on a campaign win and on a campaign loss (the log unchanged on the loss), on a standalone win and loss; nothing written for an abandoned game; back-fill from a seeded save and a seeded standalone game; deleting a save keeps its runs; fold state round-trips through `settings`; the History list sorts, groups and filters.

## E2E

`.maestro/features/history.yaml`: open History from each tab, switch kinds, find a seeded run's row. `.maestro/features/sections-fold.yaml`: fold a section on each tab, relaunch, still folded. Written in this phase; in a cloud session they do not run and stay open in `STATUS.md`.

## Exit

- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm data:check` green; every golden unchanged; `ENGINE_VERSION` unchanged (no engine change).
- The web build (`expo export --platform web`) renders both tabs and History at 390 pt wide.
- One review round (`/reviewer` and `/ux`), as above. Phone checks and Maestro runs stay open in a cloud session.
