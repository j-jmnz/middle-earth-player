import { describe, expect, it } from "vitest";

import { PLAYABLE_SCENARIOS } from "../../src/campaign/playable.ts";

import { problemsOf, smokeScenario } from "./encounter.ts";

// Every playable scenario's encounter smoke (scripts/card-smoke/encounter.ts) on every run of the suite, so an engine change that breaks a scenario it was not made for fails here and not at the
// next `pnpm test scenario` of that scenario: each encounter-side card played once, and SWEEP_GAMES seeded games with their table checks (scripts/card-smoke/invariants.ts). `pnpm test scenario`
// still plays the scenario's whole set of games.

// The games a scenario plays here: the first of each kind (strong, weak and tense heroes alone, brittle heroes two-handed).
export const SWEEP_GAMES = 4;
// Vitest runs a file in one worker, so the sweep is split across SWEEP_SHARDS files (encounter-sweep-<n>.test.ts) that run side by side. A shard takes every SWEEP_SHARDS-th scenario.
export const SWEEP_SHARDS = 4;

export function encounterShard(shard: number): void {
  const ids = PLAYABLE_SCENARIOS.filter((_, index) => index % SWEEP_SHARDS === shard - 1);

  describe(`encounter smoke of every playable scenario, shard ${shard} of ${SWEEP_SHARDS}`, () => {
    for (const id of ids) {
      it(`smokes ${id}`, async () => {
        const summary = await smokeScenario(id, { games: SWEEP_GAMES });
        expect(problemsOf(summary)).toEqual([]);
        expect(summary.games).toHaveLength(SWEEP_GAMES);
      }, 120_000);
    }
  });
}
