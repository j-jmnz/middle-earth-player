import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { byCode, expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { campaign, codesOf, FRODO, loadWorld, MERRY, RING, SAM, scenario, type World } from "../../scripts/past-scene.ts";
import { buildStart } from "./start.ts";

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
    const start = buildStart({ campaign, scenario, seatCount: 1, seed: 5, threatModifier: 0, seats: [{ heroes: [FRODO, SAM], deck: [] }], effects: EFFECTS });
    const run = start.definition.setup;
    for (const code of SETUP_CODES) {
      const record = EFFECTS.find((effect) => effect.cardCode === code && effect.timing === "setup");
      expect(record, code).toBeDefined();
      expect(isSubsequence(record?.instructions ?? [], run), code).toBe(true);
    }
    // The campaign script, not the definition, runs the 141085 Setup record.
    expect(start.definition.setup.filter((instruction) => "code" in instruction && instruction.code === RING)).toHaveLength(1);
  });

  it("never place a card a second time", () => {
    const start = buildStart({ campaign, scenario,
      seatCount: 1,
      seed: 5,
      threatModifier: 0,
      seats: [{ heroes: [FRODO, SAM], deck: [] }],
      effects: EFFECTS,
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
  const STARTER = Array.from({ length: 14 }, () => "f0");
  function begin(seed: number, seats: 1 | 2 = 1) {
    const start = buildStart({ campaign, scenario,
      seatCount: seats,
      seed,
      threatModifier: 0,
      seats: seats === 1
        ? [{ heroes: [FRODO, SAM], deck: STARTER }]
        : [{ heroes: [FRODO, SAM], deck: STARTER }, { heroes: [MERRY], deck: STARTER }],
      effects: EFFECTS,
    });
    const ctx: ReduceContext = { effects: EFFECTS, cards: world.cards };
    return { started: startScenario(start, ctx), ctx };
  }

  it("has two setup records, the second lowering the starting hand", () => {
    const records = EFFECTS.filter((effect) => effect.cardCode === "141078" && effect.timing === "setup");
    expect(records).toHaveLength(2);
    expect(records[1]?.instructions).toEqual([{ verb: "ReduceOpeningHand", amount: 1 }]);
  });

  it("deals every seat a starting hand of five on a fixed seed", () => {
    for (const seats of [1, 2] as const) {
      const { started } = begin(11, seats);
      expect(started.openingHandReduction).toBe(1);
      for (let seat = 0; seat < seats; seat += 1) expect(started.seats[seat]?.hand, `seat ${seat}`).toHaveLength(5);
    }
  });

  it("redraws five on a mulligan and still stages the card once", () => {
    const { started, ctx } = begin(11);
    const mulled = expectOk(reduce(started, { type: "Mulligan" }, ctx)).state;
    expect(mulled.seats[0]?.hand.slice(0, 5)).toHaveLength(5);
    expect(codesOf(mulled, mulled.staging)).toContain("141078");
    expect(byCode(mulled, "141078")).toHaveLength(1);
  });
});
