// Rules: rr.cannot, rr.travel, rr.engaged, rr.active-location, rr.effects, mec113.saga-staging-rules, mec113.immune-to-player-card-effects (data/rules/entries.json); ledger lines 146024:A:1, 146025:A:3, 146026:A:1, 146029:A:2, 146035:A:2.
// What a card-spec row cannot hold on The Black Gate Opens' own cards: a bar seen only in what is refused (the Black Gate's travel, the allies that cannot be played), a card that leaves the quest, and the Threat total of the
// engaged enemies of every seat. Each test title starts with the line it covers (scripts/checks/spec-coverage.test.ts).
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { legalIntents, legalTargets, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { answer, reveal } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-black-gate-opens";
const GATE = "146024";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
const travelTargets = (state: ScenarioState, ctx: ReduceContext) => legalTargets({ ...state, window: { kind: "travel" } }, { type: "Travel" }, ctx);
const playsAlly = (state: ScenarioState, ctx: ReduceContext) => legalIntents(state, ctx).some((intent) => intent.type === "PlayCard" && state.cards[intent.cardId]?.code === "ally");

describe("The Black Gate", () => {
  it("146024:A:1 cannot be traveled to, while other locations in the staging area can, and it is immune to player card effects", () => {
    const made = at({ phase: "Travel", staging: [GATE, "place"] });
    expect(travelTargets(made.state, made.ctx)).toEqual([idOf(made.state, "place")]);
    expect(made.cards.get(GATE)?.keywords.immuneToPlayerCardEffects).toBe(true);
  });
});

describe("Towers of the Teeth", () => {
  it("146025:A:3 while it is the active location no ally can be played, and with another location active one can", () => {
    const layout: Layout = { phase: "Planning", hand: ["ally"], heroResources: 3 };
    const open = at({ ...layout, active: "place" });
    expect(playsAlly(open.state, open.ctx)).toBe(true);
    const barred = at({ ...layout, active: "146025" });
    expect(playsAlly(barred.state, barred.ctx)).toBe(false);
  });
});

describe("Beleaguered Hills", () => {
  it("146026:A:1 lowers the staging Threat by the Threat of the enemies engaged with every player, not only the first", () => {
    const made = at({ seats: 2, active: "146026", staging: ["f3", "f3", "f3"], engaged: [{ code: "f3", seat: 0 }, { code: "f3", seat: 1 }] });
    expect(stagingThreat(made.state, made.cards)).toBe(3);
  });
});

describe("Reeking Moat", () => {
  it("146029:A:2 puts each enemy under it into play engaged with the first player, so that an Orc's 'after it engages you' is heard", () => {
    const row = { line: "146029:A:2", layout: { staging: ["146029"], under: [{ code: "146058", to: "146029" }] }, act: { act: "announce", trigger: "leftPlay", code: "146029" }, expect: [] } as const;
    const done = play(ID, row as never, EFFECTS, false);
    const orc = Object.values(done.run.state.cards).find((card) => card.code === "146058");
    expect(orc?.zone).toBe("engaged");
    expect(done.run.steps.some((step) => step.kind === "engage" && step.enemyId === orc?.id && step.seat === 0)).toBe(true);
  });
});

describe("Warrior of Rhûn", () => {
  it("146035:A:2 removes the character the revealing player chooses from the quest", () => {
    const row = { line: "146035:A:2", layout: { committed: ["dh1", "dh2"] }, act: [reveal("146035"), answer("dh1")], expect: [] } as const;
    const done = play(ID, row as never, EFFECTS, false);
    const committed = (code: string) => Object.values(done.run.state.cards).find((card) => card.code === code)?.committed;
    expect([committed("dh1"), committed("dh2")]).toEqual([false, true]);
  });
});
