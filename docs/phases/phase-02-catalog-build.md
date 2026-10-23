# Phase 2 — Catalog build

Depends on: phase 1
Blocks: phases 3, 4, and 7

## Goal

`scripts/build-catalog.ts` writes `assets/catalog.db` from RingsDB. The phone does not ship in this phase. Node tests read the built database.

## Build

Fetch `GET https://ringsdb.com/api/public/packs/` and `GET https://ringsdb.com/api/public/cards/{pack}.json`. Drop pack names that start with `ALeP - `. Cache each payload in a gitignored directory. A re-run with that cache present does not refetch. CI fetches on a miss. Do not commit the payloads.

Write one Drizzle schema from `drizzle-orm/sqlite-core` in `src/catalog`. The script opens it with `better-sqlite3`. Do not write a second catalog schema. Validate the boundary with Zod in `src/catalog`. That includes schemas for `Effect`, `Instruction`, `Condition`, `Cost`, and `ScenarioDefinition`, even while the effect and scenario tables are empty. Identifiers are RingsDB codes. When `has_errata` is set, store the errata text. Write the RingsDB pack `code` and the fetch date into a `meta` row.

`catalog.db` tables: `packs`, `cards`, `effects`, `scenarios`, `campaigns`, `meta`. No decks, no saves, no image bytes. Schema changes to this file are a new file, not an in-place migration.

`cards.deck_legal` is true for `hero`, `ally`, `attachment`, `event`, and for contracts, player side quests, and treasures once those `type_code` values are confirmed from a live payload. Campaign, encounter, quest, and nightmare rows are not deck-legal. TBR mixes heroes with `type_name: "Campaign"`. Filter those out in the script.

`cards.campaign_id` is set only for rows a campaign owns. The Fellowship campaign id is `fellowship-of-the-ring`. There is no RingsDB pack code for the 2022 box. TBR and TRD are the reprint packs.

The script writes `CATALOG_VERSION` next to the asset when it writes the database.

Effects and scenario rows may be empty tables in this phase. Do not parse Hall of Beorn. Do not author effect records yet. `src/effects` may import `src/catalog`. The build script and tests may import `src/effects`. `src/rules`, `src/campaign`, `src/play`, and `src/screens` may not.

## Exit

A Node test opens the built database and reads one known hero by code. `assets/catalog.db` and the payload cache are gitignored. A second run with the cache present does not refetch and writes the same rows. A run with the cache missing fetches.
