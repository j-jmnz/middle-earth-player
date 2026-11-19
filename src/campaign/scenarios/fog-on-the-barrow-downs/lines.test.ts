// Rules: rr.forced, rr.travel, rr.immune, rr.engaged, rr.effects, rr.lasting-effects (data/rules/entries.json); ledger lines 148001:A:1, 148002:B:1, 148007:A:1, 148010:A:1, 148011:A:1, 148012:A:1, 148013:A:1, 148014:A:1, 148017:A:2.
// The lines of Fog on the Barrow-downs a spec row cannot express: the Setup shuffle, the refresh phase's own end, what a seat's flags bar, and the keywords of Great Barrow. Each test starts its title with its line id.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalTargets } from "../../../rules/engine/legal.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "fog-on-the-barrow-downs";
type Layout = NonNullable<Parameters<typeof tableFromLayout>[1]>;
const table = (layout: Layout = {}) => tableFromLayout(SCENARIO, { phase: "Quest", ...layout });
const settled = (layout: Layout) => {
  const t = table(layout);
  return { t, state: settle({ ...t.state, mode: "stopped", window: null }, t.ctx, []) };
};
const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

describe("148001:A:1 Setup", () => {
  it("148001:A:1 shuffles the encounter deck (each copy of Great Barrow, Standing Stones and Hollow Circle is set aside by the Setup's data)", () => {
    const deck = ["f0", "f3", "place", "treachery", "attachment", "f0", "f3", "place", "treachery", "attachment"];
    const t = table({ stage: "148001", deck, seed: 5 });
    const before = codes(t.state, t.state.encounterDeck);
    const run = resolveRecords(t.state, t.ctx, "148001", "setup");
    const after = codes(run.state, run.state.encounterDeck);
    expect([...after].sort()).toEqual([...before].sort());
    expect(after).not.toEqual(before);
  });
});

describe("148002:B:1 the end of the refresh phase", () => {
  it("148002:B:1 raises each player's threat by 1 once when the refresh phase ends, not once for each player", () => {
    const t = table({ stage: "148002", seats: 2, phase: "Refresh" });
    const steps: EngineStep[] = [];
    const run = settle({ ...t.state, window: null }, t.ctx, steps);
    const raised = steps.filter((step) => step.kind === "threat" && "effect" in step.cause && step.cause.effect === "148002:forced:1");
    expect(raised.map((step) => (step.kind === "threat" ? step.seat : -1)).sort()).toEqual([0, 1]);
    expect(run.round).toBeGreaterThanOrEqual(t.state.round);
  });
});

describe("148007:A:1 Great Barrow's keywords", () => {
  it("148007:A:1 cannot be traveled to while other locations can, and is immune to player card effects", () => {
    const t = table({ phase: "Travel", staging: ["148007", "place"] });
    const targets = legalTargets({ ...t.state, window: { kind: "travel" } }, { type: "Travel" }, t.ctx);
    expect(targets).toEqual([idOf(t.state, "place")]);
    const keywords = printedOf(t.ctx.cards, "148007").keywords;
    expect(keywords.immuneToPlayerCardEffects).toBe(true);
    expect(keywords.peril).toBe(true);
  });
});

describe("148010:A:1 North Downs", () => {
  it("148010:A:1 characters of the players at its stage defend against a Wight with their Willpower, against any other enemy with their Defense, and only while it is in the staging area", () => {
    const withIt = settled({ seats: 1, staging: ["148010"], engaged: ["148011", "f3"] });
    const hero = withIt.state.seats[0].heroes[0] ?? "";
    const card = withIt.state.cards[hero]!;
    const printed = printedOf(withIt.t.ctx.cards, card.code);
    const against = (state: ScenarioState, enemy: string) => ({ ...state, pendingAttack: { enemyId: idOf(state, enemy), seat: 0, defenderId: hero } }) as ScenarioState;
    expect(modifiedStat(against(withIt.state, "148011"), card, "defense", withIt.t.ctx.cards)).toBe(printed.willpower ?? 0);
    expect(modifiedStat(against(withIt.state, "f3"), card, "defense", withIt.t.ctx.cards)).toBe(printed.defense ?? 0);
    const without = settled({ seats: 1, engaged: ["148011"] });
    expect(modifiedStat(against(without.state, "148011"), without.state.cards[hero]!, "defense", without.t.ctx.cards)).toBe(printed.defense ?? 0);
  });
});

describe("148011:A:1 Barrow-wight, 148012:A:1 Cold-wight and 148013:A:1 Dark-wight, engaged with a player", () => {
  it("148011:A:1 while engaged the player's threat cannot be reduced, and while in the staging area it can", () => {
    const engaged = settled({ seats: 2, engaged: [{ code: "148011", seat: 1 }] });
    expect(flagged(engaged.state, "seat:1", "threatReductionBarred")).toBe(true);
    expect(flagged(engaged.state, "seat:0", "threatReductionBarred")).toBe(false);
    expect(flagged(settled({ seats: 2, staging: ["148011"] }).state, "seat:1", "threatReductionBarred")).toBe(false);
  });

  it("148012:A:1 while engaged the player cannot draw cards from card effects, and draws one in the resource phase's way", () => {
    const engaged = settled({ seats: 1, engaged: ["148012"], deckOf: ["ally", "ally"] });
    expect(flagged(engaged.state, "seat:0", "noCardDraw")).toBe(true);
    const drawn = runInstruction(engaged.state, { verb: "Draw", amount: 1 }, { seat: 0, sourceId: null }, engaged.t.ctx, []);
    expect(drawn.seats[0].hand).toHaveLength(0);
    expect(flagged(settled({ seats: 1, staging: ["148012"] }).state, "seat:0", "noCardDraw")).toBe(false);
  });

  it("148013:A:1 while engaged the player's heroes cannot gain resources from card effects, and the other player's can", () => {
    const engaged = settled({ seats: 2, engaged: [{ code: "148013", seat: 0 }] });
    const mine = engaged.state.seats[0].heroes[0] ?? "";
    const theirs = engaged.state.seats[1].heroes[0] ?? "";
    expect(flagged(engaged.state, mine, "noCardResources")).toBe(true);
    expect(flagged(engaged.state, theirs, "noCardResources")).toBe(false);
  });
});

describe("148014:A:1 I'm Waiting for You!", () => {
  it("148014:A:1 each Wight engaged with a player makes an immediate attack, and with none the card gains surge", () => {
    const one = table({ seats: 1, engaged: ["148011"], deck: ["f0", "f0", "f0"] });
    const attacks = (state: ScenarioState, ctx: typeof one.ctx) => resolveRecords(state, ctx, "148014", "whenRevealed").steps.filter((step) => step.kind === "attack").length;
    expect(attacks(one.state, one.ctx)).toBe(1);
    const none = table({ seats: 1, engaged: ["f3"], deck: ["f0", "f0", "f0"] });
    expect(attacks(none.state, none.ctx)).toBe(0);
  });
});

describe("148017:A:2 Frozen by Fear", () => {
  it("148017:A:2 the players at the revealer's stage cannot trigger Action or Response effects or play events until the end of the round", () => {
    const t = table({ seats: 2, hand: ["event", { code: "event", seat: 1 }], heroResources: 3 });
    const run = resolveRecords(t.state, t.ctx, "148017", "whenRevealed");
    expect(flagged(run.state, "seat:0", "cannotTriggerEffects")).toBe(true);
    expect(flagged(run.state, "seat:1", "cannotTriggerEffects")).toBe(true);
    const plays = (state: ScenarioState) => settle({ ...state, phase: "Planning", mode: "planning", window: null }, t.ctx, []);
    expect(plays(run.state).cards[idOf(run.state, "event")]?.zone).toBe("hand");
  });
});
