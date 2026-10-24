import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { byCode, expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { codesOf, fixture, FRODO, loadWorld, RING, SAM, type World } from "../../scripts/past-scene.ts";
import { scriptFor } from "./registry.ts";

let world: World;

beforeAll(async () => {
  world = await loadWorld();
});

describe("setup records", () => {
  const SETUP_CODES = ["141022", "141078", "141017"];

  function isSubsequence(part: readonly unknown[], whole: readonly unknown[]): boolean {
    let at = 0;
    for (const item of whole) {
      if (at < part.length && JSON.stringify(item) === JSON.stringify(part[at])) at += 1;
    }
    return at === part.length;
  }

  it("mirror the instructions the definition and the script already run", () => {
    const run = [...world.definition.setup, { verb: "ShuffleEncounterDeck" }];
    for (const code of SETUP_CODES) {
      const record = EFFECTS.find((effect) => effect.cardCode === code && effect.timing === "setup");
      expect(record, code).toBeDefined();
      expect(isSubsequence(record?.instructions ?? [], run), code).toBe(true);
    }
    // The campaign script, not the definition, runs the 141085 Setup record.
    expect(world.definition.setup.some((instruction) => "code" in instruction && instruction.code === RING)).toBe(false);
  });

  it("never place a card a second time", () => {
    const start = scriptFor("a-shadow-of-the-past").start({
      fixture,
      definition: world.definition,
      seatCount: 1,
      seed: 5,
      threatModifier: 0,
      seats: [{ heroes: [FRODO, SAM], deck: [] }],
    });
    const ctx: ReduceContext = { effects: EFFECTS, cards: world.cards };
    const started = startScenario(start, ctx);
    const kept = expectOk(reduce(started, { type: "Keep" }, ctx)).state;
    for (const code of ["141078", "141017", "141031", "141035"]) {
      expect(byCode(kept, code), code).toHaveLength(1);
    }
    expect(codesOf(kept, kept.staging).sort()).toEqual(["141039", "141078"]);
    expect(kept.encounterDeck).toHaveLength(42);
  });
});

describe("Gandalf's Delay", () => {
  it("141078 Gandalf's Delay: second setup record needs a cited source", () => {
    const records = EFFECTS.filter((effect) => effect.cardCode === "141078" && effect.timing === "setup");
    expect(
      records.length,
      "141078 Gandalf's Delay: cite the quest card or Learn to Play pages 28-30, then author its second Setup sentence",
    ).toBeGreaterThanOrEqual(2);
  });
});
