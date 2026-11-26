// Rules: hrd.orcs-area-different-stage, hrd.orcs-area-same-stage, hrd.stage-number, rr.lasting-effects, faq.lasting-effects, rr.modifiers (data/rules/entries.json); ledger lines 17040:A:1, 17041:A:1, 17046:A:1, 17053:B:1. What the Orcs' stage changes on other cards: Howling at their
// Heels' lasting effects (the Orcs' area Threat added to the staging total, read live; +1 Threat to each enemy), Expanse of Harad's Threat and the stage number Blistering Erg counts.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
import { expireModifiers } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { idOf, opened, run as runInstruction } from "../../../../test/harness/scene-kit.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { withStagingThreat } from "../attachments/hold.ts";
import { advancedTo, CHIEFTAIN, prepared, record, URUK } from "./race-kit.ts";

describe("17046:A:1 Howling at their Heels: at another stage the Orcs' area adds its Threat to the staging area's total", () => {
  it("the total Threat of the Orcs' area (the Chieftain's 4) is added to the staging total until the end of the phase", () => {
    const { made, state } = prepared({ staging: ["17040"] });
    expect(withStagingThreat(state, 2, made.cards)).toBe(2);
    const done = record(made, state, "17046:whenRevealed:1", idOf(state, "17040"), "whenRevealed");
    expect(withStagingThreat(done, 2, made.cards)).toBe(2 + 4);
    expect(done.modifiers.find((modifier) => modifier.stat === "orcsInStagingThreat")?.until).toBe("endOfPhase");
  });

  it("the raise is read live: a card that joins the area adds its Threat, one that leaves takes it away, and no engaged enemy counts", () => {
    const { made, state } = prepared({ staging: ["17042"], engaged: [URUK] });
    const road = idOf(state, "17042");
    const done = record(made, state, "17046:whenRevealed:1", road, "whenRevealed");
    expect(withStagingThreat(done, 0, made.cards)).toBe(4);
    const joined = runInstruction(made, done, { verb: "MoveToOrcsArea" }, { sourceId: road });
    expect(withStagingThreat(joined, 0, made.cards)).toBe(4 + 5);
    const left = runInstruction(made, joined, { verb: "Discard", target: { kind: "self" } }, { sourceId: road });
    expect(withStagingThreat(left, 0, made.cards)).toBe(4);
  });

  it("17046:A:1 both lasting effects end at the end of the phase: the staging total and the enemies' Threat are as they were", () => {
    const apart = prepared({ staging: ["17040"], engaged: [URUK] });
    const raised = record(apart.made, apart.state, "17046:whenRevealed:1", idOf(apart.state, "17040"), "whenRevealed");
    expect(withStagingThreat(expireModifiers(raised, ["endOfPhase"]), 2, apart.made.cards)).toBe(2);
    const same = prepared({ stage: "17047", engaged: [URUK], staging: ["17040"] });
    const uruk = idOf(same.state, URUK);
    const before = modifiedStat(same.state, same.state.cards[uruk]!, "threat", same.made.cards);
    const boosted = record(same.made, same.state, "17046:whenRevealed:1", idOf(same.state, "17040"), "whenRevealed");
    expect(modifiedStat(boosted, boosted.cards[uruk]!, "threat", same.made.cards)).toBe(before + 1);
    const over = expireModifiers(boosted, ["endOfPhase"]);
    expect(modifiedStat(over, over.cards[uruk]!, "threat", same.made.cards)).toBe(before);
  });

  it("once the players reach the Orcs' stage the cards are in the staging area and count there already: they are not added twice", () => {
    const { made, state } = prepared({ staging: ["17040"] });
    const done = record(made, state, "17046:whenRevealed:1", idOf(state, "17040"), "whenRevealed");
    const atSame = runInstruction(made, { ...done, questStage: idOf(state, "17047") }, { verb: "AddOrcsProgress", amount: 1 });
    expect(withStagingThreat(atSame, 4, made.cards)).toBe(4);
  });

  it("with no Orcs' area in the game the staging total is as it was", () => {
    const { made } = prepared();
    const bare = opened(made).state;
    expect(withStagingThreat(bare, 3, made.cards)).toBe(3);
  });

  it("at the same stage each enemy gets +1 Threat until the end of the phase, an enemy that enters play later too, and the staging total gets nothing from the area", () => {
    const { made, state } = prepared({ stage: "17047", engaged: [URUK], staging: ["17040"] });
    const uruk = idOf(state, URUK);
    const before = modifiedStat(state, state.cards[uruk]!, "threat", made.cards);
    const done = record(made, state, "17046:whenRevealed:1", idOf(state, "17040"), "whenRevealed");
    expect(modifiedStat(done, done.cards[uruk]!, "threat", made.cards)).toBe(before + 1);
    expect(done.modifiers.some((modifier) => modifier.stat === "orcsInStagingThreat")).toBe(false);
    const later = spawn(done, URUK, { zone: "staging" });
    expect(modifiedStat(later.state, later.state.cards[later.id]!, "threat", made.cards)).toBe(before + 1);
    expect(modifiedStat(done, done.cards[idOf(done, CHIEFTAIN)]!, "threat", made.cards)).toBe(4 + 1);
  });
});

describe("17040:A:1 Expanse of Harad gets +2 Threat while the players are at another stage than the Orcs", () => {
  it("+2 Threat at another stage, its printed Threat at the same stage", () => {
    const apart = prepared({ staging: ["17040"] });
    const expanse = idOf(apart.state, "17040");
    expect(modifiedStat(opened(apart.made, apart.state).state, apart.state.cards[expanse]!, "threat", apart.made.cards)).toBe(2 + 2);
    const same = prepared({ stage: "17047", staging: ["17040"] });
    expect(modifiedStat(opened(same.made, same.state).state, same.state.cards[idOf(same.state, "17040")]!, "threat", same.made.cards)).toBe(2);
  });

  it("the Threat follows the Orcs: when they catch up to the players the +2 ends", () => {
    const first = prepared({ stage: "17048", staging: ["17040"] });
    const expanse = idOf(first.state, "17040");
    const apart = opened(first.made, first.state).state;
    expect(modifiedStat(apart, apart.cards[expanse]!, "threat", first.made.cards)).toBe(4);
    const caught = opened(first.made, advancedTo(first.made, first.state, 2)).state;
    expect(modifiedStat(caught, caught.cards[expanse]!, "threat", first.made.cards)).toBe(2);
  });
});

describe("17041:A:1 X is the stage number of the main quest", () => {
  it("1 to 4 by the main quest card, as the stage the players are at", () => {
    const at = (stage: string): number => {
      const made = prepared({ stage }).made;
      const state = opened(made).state;
      return resolveAmount(state, { stage: true }, frameScope(state, 0, null), made.ctx);
    };
    expect([at("17047"), at("17048"), at("17049"), at("17050")]).toEqual([1, 2, 3, 4]);
  });
});
