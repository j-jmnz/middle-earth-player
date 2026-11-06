# Phase 34 — Nightmare data and pictures

Depends on: phase 27
Blocks: phases 35 and 36

Plan: [docs/plans/done/nightmare-mode.md](../plans/done/nightmare-mode.md).

## Goal

Every card of the 72 Nightmare decks is built for future use, with its picture bundled. Each built scenario that has a Nightmare deck carries it.

## Work

- `scripts/data/nightmare-defs.ts`: one hand-checked row per Hall of Beorn Nightmare set. Each row gives the code prefix, the Drive folder and the built scenario. A Nightmare card's code is the prefix plus its collector number. Cards go into `data/cards/Nightmare.json`, pack `Nightmare` (`addNightmareCards`). An unknown set is a build error.
- `data/scenarios/<id>.json` `nightmare`: the setup card, the removals pile by pile, and the deck's cards, from the setup card's side B (`scripts/data/normalize/nightmare.ts`).
- The `nightmare` source (`pnpm data:sync nightmare`) pins:
  - the Drive listing and the card lists (`data/raw/nightmare`);
  - each card side's picture (`.cache/pictures`, paths `pictures/<code>.<side>.<ext>`).
  The `pictures` source leaves the Nightmare pack to it, and `pnpm scans:pack` reads both.
- The Nightmare decks are in the ledger's scan scope, scanned from the Drive pictures (`scanTargets`).
- The `nightmare` icon: the Eye of Sauron, drawn for the app (`scripts/data/icons.ts`).

## Exit

- `pnpm data:build` and `pnpm data:check` green; `scripts/data/nightmare.test.ts` green.
- The tests check that the card lists agree with Hall of Beorn's copies, with one settled disagreement named, and that every side but one has a picture.
- `pnpm catalog:build`; `src/catalog/version.ts` committed.
- `pnpm scans:pack` on the build machine bundles the Nightmare pictures. Phone check: open.
