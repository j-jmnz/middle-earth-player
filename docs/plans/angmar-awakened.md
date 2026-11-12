# Angmar Awakened

The Angmar Awakened campaign made playable, in a campaign and standalone: the ninth campaign the catalog lists (`data/campaigns/index.json`, `angmar-awakened`) and the last one still not playable. Run by the orchestrator (`.claude/agents/orchestrator.md`) as the phases below, in order. Ered Mithrin is the pattern: a deluxe box and six Adventure Packs as the base cards, a Campaign Expansion as the campaign (`docs/brief.md`, Ered Mithrin; `scripts/data/campaign-defs.ts`).

## Scope

- **Products.** The base cards are The Lost Realm (RingsDB `TLR`) and the Angmar Awakened cycle: The Wastes of Eriador (`WoE`), Escape from Mount Gram (`EfMG`), Across the Ettenmoors (`AtE`), The Treachery of Rhudaur (`ToR`), The Battle of Carn Dûm (`BoCD`), The Dread Realm (`TDR`). The campaign is the Angmar Awakened Campaign Expansion (MEC108, RingsDB `AACE`): its campaign cards, boons, burdens and campaign-only cards. Its scans are on cardgame.tools as `MEC108-*` (some already pinned in `data/sources.json`).
- **Rulebook.** MEC108's rulebook, pinned like `emce` (`scripts/data/sources/rules.ts`): `https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mec108_rules.pdf` answers `application/pdf`, and Hall of Beorn's S3 host has `Images/LotR/Rules/MEC108.pdf`; the data phase pins one and records which. Its spans are `mec108.*` (setup of each scenario, campaign rules, the Campaign Log).
- **Scenarios**, in campaign order: Intruders in Chetwood, The Weather Hills, Deadmen's Dike (The Lost Realm); The Wastes of Eriador, Escape from Mount Gram, Across the Ettenmoors, The Treachery of Rhudaur, The Battle of Carn Dûm, The Dread Realm (one per Adventure Pack). Ids are the titles in kebab case (`intruders-in-chetwood`, `the-battle-of-carn-dum`).
- **Out of scope.** Nightmare decks of these scenarios. The Messenger of the King cards (standing decision).

## Decisions

- **Open points are researched online, not asked** in every phase, the data and campaign-shell phases too, as `.claude/rules/authority.md` (Open points) says (an Easy count, a rewording, a campaign rule the booklet leaves open). A scan that cannot be read is the one question that goes to the user.
- **One review round per phase** (`reviewer`, and `ux` when `src/screens` or `src/play` changed), then one fix task, as for The Return of the King.
- **Each phase is one checkpointed commit series on the session branch**; nothing moves another scenario's golden or fixture unless a researched rule changes it (then `ENGINE_VERSION`, and the commit says which goldens moved and why).

## Phase 77: Angmar Awakened data

As Ered Mithrin's data phase (49), for the products above.

- `PRODUCTS` and `CAMPAIGNS` entries in `scripts/data/campaign-defs.ts` (`campaignExpansion` for MEC108, the scenario defs with each one's setup span, normal and Easy deck ids, shared decks), the Hall of Beorn scenario files, the MEC108 rulebook pinned and split into `mec108.*` spans (`data/rules/index.json`, `columns.json`), the booklet packed (`scripts/build/pack-booklets.ts`).
- Scans and pictures pinned for every card the nine scenarios deal on Normal and Easy, the campaign cards, boons, burdens and the campaign-only cards; the scan-read ledger `data/printed/angmar-awakened.json`. Where the MEC108 printing words a card differently from its 2015 printing, the ledger takes MEC108 and the card goes in a `MEC108_CHANGED` list beside `MEC113_CHANGED` (`scripts/data/printed/scope.ts`).
- The nine `data/scenarios/<id>.json` and `data/campaigns/angmar-awakened.json`, built by `pnpm data build`, with every cross-check green (`pnpm data build -- --verbose`); the data test file `scripts/data/angmar-awakened.test.ts`; `scripts/data/campaigns.test.ts` and `scripts/build/catalog-exit.test.ts` updated for the campaign's data existing (still not playable).
- Exit: `pnpm data check`, `pnpm test fast`, `pnpm lint`, `pnpm typecheck`. Not playable yet: no scenario joins `PLAYABLE_SCENARIOS`.

## Phase 78: Angmar Awakened campaign shell

As Ered Mithrin's campaign shell (50): the campaign cards' Setup and Resolution lines (each scenario's own lines may be left to its phase's Build, listed in the Open items), the Campaign Log's rows for this box (boons, burdens, experience and anything else `mec108.*` prints), the booklet in the app (`bookletId`, `bookletDoc: "mec108"`), the campaign start, and the campaign shell test. `docs/brief.md` gets an `## Angmar Awakened` section with the scenario table and the box's rules. Exit as phase 77, plus the campaign's tests.

## Phases 79 to 87: the scenarios

One phase per scenario, in campaign order: 79 Intruders in Chetwood, 80 The Weather Hills, 81 Deadmen's Dike, 82 The Wastes of Eriador, 83 Escape from Mount Gram, 84 Across the Ettenmoors, 85 The Treachery of Rhudaur, 86 The Battle of Carn Dûm, 87 The Dread Realm. Each follows `docs/handover/agent-brief.md` (Scenario procedure): Read, Build, the reading judge, Finish, the review round, the fix task. Engine half and screen half are both done in the phase. A new mechanic (encounter side quests are the box's own: The Lost Realm prints them) is a family, reused by the later phases rather than re-made. Each scenario's readings go to `docs/brief.md`, `### <Scenario>` under `## Angmar Awakened`.

Exit of each: the procedure's engine and screen half exits; the scenario in `PLAYABLE_SCENARIOS`; its goldens in the golden registry; the campaign test continuing from the previous part's golden state. `data/campaigns/index.json` marks the campaign playable once its first scenario is, and the hub shows the rest as coming later.
