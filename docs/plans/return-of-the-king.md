# Plan: The Return of the King

## Context

The app plays The Fellowship of the Ring and The Two Towers saga boxes, and a won Two Towers save writes the saga's end to its log. The user asked for **The Return of the King**: the third saga box, its campaign card and log, continuing the saga from a won Two Towers save, and its six scenarios, each playable in a campaign and standalone (user instruction, 2026-11-11).

`data/campaigns/index.json` lists `the-return-of-the-king` (6 scenarios, `playable: false`, box "The Return of the King Saga Expansion"). It has no campaign file, scenario files or printed-text ledger yet.

The work has the shape The Two Towers took (phases 61 to 68): a data phase, a campaign-shell phase, then one phase per scenario run as `docs/handover/agent-brief.md` (Scenario procedure). The scenario ids and their order are taken from the built campaign data (phase 69), not from memory.

Shelob's Lair (phase 68), which ends The Two Towers, is built. The open-games guards are merged into this branch: every scenario keeps them.
- A rule change that can move a replayed game bumps `ENGINE_VERSION` and adds its `ENGINE_CHANGES` entries (`src/rules/engine/version.ts`): one plain line for players, and the scenario ids it reaches (`"all"` only for a mechanic every scenario has).
- Each golden's `golden.json` carries per-move `checks`, written by the golden suite, never by hand. A change that moves another scenario's checks moves its games, so it needs a bump and its `ENGINE_CHANGES` line.

The standing decisions in `docs/phases/STATUS.md` bind this plan. Out of scope: Nightmare decks for the box.

## Stop and ask the user

Only for: a scan that cannot be read; a change that would alter a behaviour this plan or an earlier scenario keeps; a golden or fixture of another scenario that would move without a rule change. Every other open point is researched, not asked (`docs/handover/agent-brief.md`, Scenario procedure).

## Phase 69: The Return of the King data

As phase 61 did for The Two Towers (`git show --stat ca004e5`):
- The box's sources in `data/sources.json`: its rules booklet PDF, Hall of Beorn's scenario exports and card set, RingsDB's pack, DragnCards' decks and the card scans. `pnpm data sync` is the only network step.
- `pnpm data build`, which writes the campaign file, the six scenario files and the box's cards.
- The ledger `data/printed/the-return-of-the-king.json`, read from the scans. A scan that cannot be read is a question for the user.
- The booklet's rule spans in `data/rules/index.json` and its text in `data/rules/`.
- `pnpm data sync scans pictures` on the new cards: every card a built scenario deals has a picture pin (`scripts/data/sources/pictures.test.ts`).
- The pre-built decklists the box prints, in `data/prebuilt-decks.json`.

Exit: `pnpm data check` green; no scenario of the box playable yet.

## Phase 70: The Return of the King campaign shell

As phase 62 did for The Two Towers:
- The six campaign cards' Setup and Resolution records, on campaign-family verbs.
- The path, the log columns the booklet's campaign log adds, and the box's booklet.
- Continuing the saga from a won Two Towers save (`src/campaign/continue.ts`, `NewSaveOptions.continued`): the heroes, fallen heroes, threat penalties, pool, captives and notes carry over, and the Campaign Total carries on.
- The booklet in `docs/brief.md` under its own section, with the rules it adds.

Exit: a new save starts fresh or continues a won Two Towers save; no Return of the King scenario playable yet.

## Phases 71 to 76: the six scenarios

One phase per scenario, in campaign order as the built campaign data lists it, each run as `docs/handover/agent-brief.md` (Scenario procedure): Read, Build, Judge, Finish, one review round, Fix. A hand-off note per scenario in `.agent/handoff/<id>.md`.

- Phase 71: part 1.
- Phase 72: part 2.
- Phase 73: part 3.
- Phase 74: part 4.
- Phase 75: part 5.
- Phase 76: part 6. A win runs the campaign card's Resolution and ends the saga's box.

Each exit: the scenario in `src/campaign/playable.ts`, its goldens with their checks, its campaign test continuing from the previous part's golden state, within its test budget, and the full `pnpm test` green after its fix task.
