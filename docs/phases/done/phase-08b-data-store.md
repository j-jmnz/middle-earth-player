# Phase 8b: Data store

Plan: [docs/plans/done/data-store-refactor.md](../../plans/done/data-store-refactor.md).

## What it changed

Game data used to be hand-typed (`scripts/local-cards.ts`, `fixtures/*.json`, a hand timing manifest) and rules lived only in PDFs. Now:

- `data/sources.json` pins every source. `pnpm data:sync` is the only network command. `data/raw/` holds verbatim snapshots; the rule PDFs stay in `.cache/pdf`.
- `pnpm data:build` writes `data/cards` (one model, all printings, with text), `data/scenarios` and `data/campaigns` (piles from the DragnCards load lists, cross-checked against Hall of Beorn's counts and the quest card's Setup text), `data/rules` (page-anchored text, `entries.json`, `steps.json`) and `src/effects/generated`.
- `pnpm data:check` fails on drift. `pnpm data:query` reads it all with SQL.
- `buildStart` replaces the scenario script and registry. `catalog.db` holds cards, packs, campaigns and meta; its version is a content hash.

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` are green with the network off and no `assets/catalog.db`.
- The step 0 golden (printed cards, definition, full-game log on seeds 1, 2 and 9) held through every step. The full-game log stays as `src/campaign/scenarios/a-shadow-of-the-past/golden.test.ts`.
- Phone checks: none changed.

## Open

- Scenarios 2 to 6 are not written to `data/scenarios` yet: the cross-checks fail on Setup text wording, `sharedEncounterDeck2` burden decks and Hall of Beorn count gaps. `pnpm data:build -- --verbose` lists each. Resolve them in the phase that plays the scenario.
- `src/screens/images` reads RingsDB paths only. `data/cards` lists DragnCards and Hall of Beorn art in each printing's `imageUrls`.
- The `A Shortcut to Mushrooms` constant record (`141023:constant:1`) raises Hide willpower per ally, where the printed text says to add to the total Threat. No template writes it, so it stays authored and unchanged until someone confirms the card.
- A scenario that fails its cross-checks is left unbuilt and `data:build` still exits 0, so `data:check` passes while scenarios 2 to 6 are missing. That is deliberate until they are played; `campaign.scenarios` lists only the built ones, and the campaign prelude comes from the first scenario that builds.
- `catalog.db` does not carry `printings[].imageUrls`; the image pipeline needs a policy change for non-RingsDB hosts first.
