// Rules: rr.setup, ltp.permanent, rr.traits, rr.attachment-cards, rr.cannot (data/rules/entries.json).
// Lines: 145014:A:3, 145014:A:4, 145015:A:2, 145015:A:3, 145062:A:2. The Esquires' Setup and the trait each gives, and Wraith on Wings' bar on attachments, read from the printed lines on a table built from data/
// (test/harness/layout.ts, tableFromLayout), each run again with the records of its line removed (test/harness/card-spec.ts, withoutLine), where it must not hold. The Wraith on Wings Setup is a row in spec.test.ts.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { withoutLines } from "../../../../test/harness/card-spec.ts";
import { idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-battle-of-the-pelennor-fields";
const ROHAN = "145014"; // Esquire of Rohan
const GONDOR = "145015"; // Esquire of Gondor
const WRAITH = "145062";
const FELL_BEAST = "145057"; // a Morgul treachery

// "Setup: Attach to a hero." The set-aside Esquire's Setup runs and the first player chooses the second hero.
function setUp(code: string, effects: readonly Effect[]) {
  const t = tableFromLayout(ID, { setAside: [code] }, { effects });
  const pickSecond = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === t.hero2) ?? "") : "");
  const run = resolveRecords(t.state, t.ctx, code, "setup", idOf(t.state, code), pickSecond);
  return { state: run.state, t };
}

describe("the Esquires", () => {
  it("145014:A:3 Setup: Esquire of Rohan is attached to the hero chosen", () => {
    const made = setUp(ROHAN, EFFECTS);
    expect(made.state.cards[idOf(made.state, ROHAN)]?.host).toBe(made.t.hero2);
    const bare = setUp(ROHAN, withoutLines(EFFECTS, "145014:A:3"));
    expect(bare.state.cards[idOf(bare.state, ROHAN)]?.host ?? null).toBeNull();
  });

  it("145015:A:2 Setup: Esquire of Gondor is attached to the hero chosen", () => {
    const made = setUp(GONDOR, EFFECTS);
    expect(made.state.cards[idOf(made.state, GONDOR)]?.host).toBe(made.t.hero2);
    const bare = setUp(GONDOR, withoutLines(EFFECTS, "145015:A:2"));
    expect(bare.state.cards[idOf(bare.state, GONDOR)]?.host ?? null).toBeNull();
  });

  // "Attached hero gains the Rohan trait." / "Attached hero gains the Gondor trait." Read on the hero the Setup chose, and not on the other hero.
  const traits = (code: string, trait: string, effects: readonly Effect[]) => {
    const { state, t } = setUp(code, effects);
    return [hasTrait(state, t.hero2, trait, t.ctx), hasTrait(state, t.hero, trait, t.ctx)];
  };
  it("145014:A:4 the attached hero gains the Rohan trait, and the other hero does not", () => {
    expect(traits(ROHAN, "Rohan", EFFECTS)).toEqual([true, false]);
    expect(traits(ROHAN, "Rohan", withoutLines(EFFECTS, "145014:A:4"))).toEqual([false, false]);
  });
  it("145015:A:3 the attached hero gains the Gondor trait, and the other hero does not", () => {
    expect(traits(GONDOR, "Gondor", EFFECTS)).toEqual([true, false]);
    expect(traits(GONDOR, "Gondor", withoutLines(EFFECTS, "145015:A:3"))).toEqual([false, false]);
  });
});

// "Cannot have non-Morgul attachments." A player attachment with no trait is barred, a Morgul card is not; another enemy takes either.
describe("Wraith on Wings", () => {
  const blocked = (effects: readonly Effect[]) => {
    const t = tableFromLayout(ID, { staging: [WRAITH, "f3"] }, { effects });
    const wraith = idOf(t.state, WRAITH);
    return [attachBlocked(t.state, t.ctx, wraith, "attachment"), attachBlocked(t.state, t.ctx, wraith, FELL_BEAST), attachBlocked(t.state, t.ctx, idOf(t.state, "f3"), "attachment")];
  };
  it("145062:A:2 cannot have a non-Morgul attachment, and can have a Morgul one", () => {
    expect(blocked(EFFECTS)).toEqual([true, false, false]);
    expect(blocked(withoutLines(EFFECTS, "145062:A:2"))).toEqual([false, false, false]);
  });
});
