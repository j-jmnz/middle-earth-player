# Phase 3 — Phone databases

Depends on: phase 2
Blocks: phase 5

## Goal

A device opens `catalog.db` from the binary and `user.db` beside it. A screen lists packs and opens one card by code.

## Databases

`catalog.db` is a Metro asset, copied by `assetSource`. `forceOverwrite` defaults to false. Pass true only when the bundled `CATALOG_VERSION` is greater than the version stored in `user.db`. On first launch the applied version is absent, so the copy runs. After changing the asset in development, bump `CATALOG_VERSION` or delete the app storage. Do not leave `forceOverwrite` unconditionally true.

Open the catalog with the phase 2 `drizzle-orm/sqlite-core` schema and `expo-sqlite`, read-only. `user.db` is a separate schema. Its tables: `decks`, `saves`, `image_files`, `meta` (applied catalog version). Drizzle migrations for `user.db` live in `drizzle/`, are committed, and run on open. `user.db` is never replaced by a catalog update. The `booklets` table arrives in phase 10.

Open the two files as two handles. Do not rely on nested `SQLiteProvider` plus `useSQLiteContext`. That hook returns the nearest provider, and the suspense helper keeps a single module-level database.

Use `expo-sqlite` on the device. The screen reads. It does not write a campaign.

The campaign list reads `campaigns` and `saves`. It does not query `cards`. Startup paints from local SQLite. It does not scan an image directory or count the catalog before the first paint.

## E2E

`.maestro/features/open-card.yaml` opens a pack and a card by a known RingsDB code, then relaunches and asserts that same code. Do not assert ability text. Card text stays out of git. The catalog is inside the build, so the flow does not need a network. The flow is written in this phase. `maestro test` runs after the last phase.

## Exit

Airplane mode, kill the app, relaunch. The pack list and the card by code are still there. A catalog version bump does not delete `user.db`. `.maestro/features/open-card.yaml` names the RingsDB code. Maestro runs after the last phase, not as this exit. The campaign list query does not read `cards`.
