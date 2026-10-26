import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../src/catalog/boundary.ts";
import { EFFECTS } from "../src/effects/index.ts";

import { formatProblem, smokeCard, smokeCodes, smokeWorld, type SmokeWorld } from "./card-smoke.ts";

// Every player card with an effect record, smoked in a real game (scripts/card-smoke.ts): no throw, no refused intent, no
// state.failure, and a copy is played. A card listed here is still smoked, but the harness cannot play it, for the reason
// given; a listed card that gets played fails, so the list does not go stale.
const UNPLAYED: Readonly<Record<string, string>> = {
  // Stand and Fight: needs an ally of printed cost X in a discard pile, and the smoke game is lost before one is there.
  "01051": "no ally in a discard pile",
  // Haradrim Spear: its record attaches it to a Haradrim character, and no deck-legal character in data/cards has that
  // trait (Kahliel and the others are Harad). Check the scan before changing the record.
  "17056": "no Haradrim character in the pool",
};

const CODES = smokeCodes();
let world: SmokeWorld;

describe("card smoke", () => {
  beforeAll(async () => {
    world = await smokeWorld(CODES);
  }, 60_000);

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
    for (const code of ["141001", "141002", "141003", "141013", "141014", "142004"]) expect(CODES).toContain(code);
    for (const code of Object.keys(UNPLAYED)) expect(CODES).toContain(code);
  });

  for (const code of CODES) {
    it(`smokes ${code}`, () => {
      const summary = smokeCard(code, { world });
      expect(summary.problems.map((problem) => formatProblem(code, problem))).toEqual([]);
      const played = summary.type === "hero" || summary.plays > 0;
      if (code in UNPLAYED) expect(played, `${code} is played now: take it off UNPLAYED`).toBe(false);
      else expect(played, `${code} was never played`).toBe(true);
    }, 30_000);
  }
});
