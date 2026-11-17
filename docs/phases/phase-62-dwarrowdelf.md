# Phase 62: The Dwarrowdelf cycle, standalone with Nightmare

The second cycle on the roadmap (README, Roadmap), built the way Shadows of Mirkwood was: no Campaign Mode, each scenario played standalone on Easy, Normal and Nightmare, scored and recorded in History (`docs/brief.md`, Shadows of Mirkwood says what a cycle is).

Depends on: nothing open. Runs beside the Standalone scenarios work on another branch; it touches only the shared files a new cycle must (campaign defs, barrels, registries, snapshots), so the later of the two merges resolves those lists.

## Scenarios, in release order

| Part | Scenario | Product | Pack |
| --- | --- | --- | --- |
| 1 | Into the Pit | Khazad-dûm | KD |
| 2 | The Seventh Level | Khazad-dûm | KD |
| 3 | Flight from Moria | Khazad-dûm | KD |
| 4 | The Redhorn Gate | The Redhorn Gate | TRG |
| 5 | Road to Rivendell | Road to Rivendell | RtR |
| 6 | The Watcher in the Water | The Watcher in the Water | WitW |
| 7 | The Long Dark | The Long Dark | TLD |
| 8 | Foundations of Stone | Foundations of Stone | FoS |
| 9 | Shadow and Flame | Shadow and Flame | SaF |

## A. Data

- The cycle in `scripts/data/campaign-defs.ts` (`kind: "cycle"`, id `dwarrowdelf`, its products and the nine scenarios), generalising what the first cycle wired by name (the Setup normaliser, the cycle test, the authored and seed-finder paths, `scenario new`) so a cycle is data, not a second copy.
- The sources through `pnpm data sync`: Hall of Beorn's scenario files, the DragnCards Normal and Easy decks, the Khazad-dûm rules insert and the Adventure Packs' rules inserts (spans in `data/rules/index.json`; an insert with no text layer is cited by its PDF, as the first cycle's two are), the scans and the pictures, the Nightmare decks.
- The printed ledger `data/printed/dwarrowdelf.json` and the Nightmare entries, seeded with `pnpm data ledger-seed` and every line read against its scan (`readBy` set). An unreadable scan is the one question for the user (`.claude/rules/authority.md`, Open points).
- Exit: `pnpm data build`, `pnpm data check`, the pictures test and `pnpm test fast` green; the cycle lists under Coming later until a scenario is playable.

## B. The scenarios

Each scenario, in the order of the table, is the Scenario procedure of `docs/agents/agent-brief.md` (Read, Build, Judge, Finish), Nightmare included, with its readings in `docs/brief.md` under a Dwarrowdelf section. A mechanic the cycle adds goes in its family, found by the Read task from the ledger, not assumed.

Exit for each: the engine half's and the screen half's exits in the Scenario procedure.

## C. Review

One review round over the whole phase (`.claude/agents/orchestrator.md`, One review round), then the fix task with the one full `pnpm test`.
