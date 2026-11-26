// Rules: rm.scour, rr.first-player (data/rules/entries.json). The verb TriggerScour of the ring-maker family on its own: the set of Scour cards it resolves, and the scopes `inPlay` and `topmostDiscard`. The scenario's lines that use it are tested in src/campaign/scenarios/celebrimbors-secret/scour.test.ts.
import { describe, expect, it } from "vitest";

import { idOf, run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "celebrimbors-secret";
const TOWER = "08131";
const PLAZA = "08130";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const IN_PLAY = { verb: "TriggerScour", scope: "inPlay" } as const;
const TOP = { verb: "TriggerScour", scope: "topmostDiscard" } as const;

describe("TriggerScour", () => {
  it("resolves the scour effect of a card in play and does nothing when no card has one", () => {
    const none = table({ staging: [PLAZA] });
    expect(run(none, none.state, IN_PLAY).cards[idOf(none.state, PLAZA)]?.damage).toBe(0);
    const one = table({ active: TOWER });
    expect(run(one, one.state, IN_PLAY).cards[idOf(one.state, TOWER)]).toMatchObject({ zone: "staging", damage: 2 });
  });

  it("topmostDiscard resolves the card nearest the top of the encounter discard pile, which stays there, and ignores a pile without a scour card", () => {
    const t = table({ discard: [PLAZA, TOWER], staging: [] });
    const done = run(t, t.state, TOP);
    expect(done.cards[idOf(done, TOWER)]).toMatchObject({ zone: "staging", damage: 2 });
    const bare = table({ discard: [PLAZA] });
    expect(run(bare, bare.state, TOP).cards[idOf(bare.state, PLAZA)]?.zone).toBe("encounterDiscard");
  });
});
