import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../src/catalog/boundary.ts";
import { EFFECTS } from "../src/effects/index.ts";

import { formatProblem, smokeCard, smokeCodes, smokeWorld, type SmokeWorld } from "./card-smoke.ts";

// Every player card with an effect record, smoked in a real game (scripts/card-smoke.ts): no throw, no refused intent, no
// state.failure. Whether a copy gets played depends on the starter table: a card that asks for heroes, traits or targets
// the table does not have is never played there. So most of them must be, not each one.
const PLAYED_SHARE = 0.75;

// Vitest runs a file in one worker, so the sweep is split across SMOKE_SHARDS files (card-smoke-<n>.test.ts) that run side by
// side. A shard takes every SMOKE_SHARDS-th code, so each one is a fair sample for the played share.
export const SMOKE_SHARDS = 4;

export function smokeShard(shard: number): void {
  const all = smokeCodes();
  const codes = all.filter((_, index) => index % SMOKE_SHARDS === shard - 1);
  let world: SmokeWorld;

  describe(`card smoke, shard ${shard} of ${SMOKE_SHARDS}`, () => {
    // Every shard deals the same world, built for every code, so a card plays the same game whichever shard runs it.
    beforeAll(async () => {
      world = await smokeWorld(all);
    }, 60_000);

    if (shard === 1) {
      it("reports a record the engine cannot run, with the intent and the step", () => {
        // Sam Gamgee (141002) is on the table from the start; an Action of his that the interpreter does not know fails the reduce.
        const broken: Effect = { id: "141002:action:99", cardCode: "141002", lines: ["141002:A:1"], timing: "action", instructions: [{ verb: "NoSuchVerb" } as unknown as Instruction] };
        const summary = smokeCard("141002", { world: { ...world, ctx: { ...world.ctx, effects: [...EFFECTS, broken] } } });
        expect(summary.ended).toBe("problem");
        expect(summary.problems).toHaveLength(1);
        expect(summary.problems[0]?.intent).toEqual({ type: "Trigger", cardId: expect.any(String), effectId: broken.id });
        expect(summary.problems[0]?.message).toContain("Unimplemented instruction NoSuchVerb");
      });

      it("smokes at least every starter card with a record", () => {
        for (const code of ["141001", "141002", "141003", "141013", "141014", "142004"]) expect(all).toContain(code);
      });
    }

    const unplayed: string[] = [];
    for (const code of codes) {
      it(`smokes ${code}`, () => {
        const summary = smokeCard(code, { world });
        expect(summary.problems.map((problem) => formatProblem(code, problem))).toEqual([]);
        if (summary.type !== "hero" && summary.plays === 0) unplayed.push(code);
      }, 30_000);
    }

    it(`plays at least ${PLAYED_SHARE * 100}% of the cards it smokes`, () => {
      expect(1 - unplayed.length / codes.length, `never played: ${unplayed.join(", ")}`).toBeGreaterThanOrEqual(PLAYED_SHARE);
    });
  });
}
