// Rules: dcce.scalable-upgradable (data/rules/entries.json). An upgraded card turned faceup from the encounter deck or the set-aside cards by an effect shows its Upgraded side, side B, in its place of `face: "up"`.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import { settle } from "../engine/machine.ts";
import { definePrinted } from "../core/printed.ts";
import { cardMap } from "../core/test-fixture.ts";
import type { ScenarioState } from "../core/state.ts";
import { spawn, turnedUpCode } from "../core/zones.ts";
import type { ReduceContext } from "./interpret.ts";
import { CARDS, table } from "../families/wilderland/fixture.ts";

const ALL = cardMap([...CARDS.values(), definePrinted({ code: "captain", name: "Corsair Captain", type: "enemy", traits: ["Corsair"], threat: 3, engagementCost: 49, attack: 5, defense: 3, health: 6 })]);
const ctx: ReduceContext = { effects: [], cards: ALL };
const upgraded = (state: ScenarioState, codes: readonly string[]): ScenarioState => ({ ...state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, upgraded: codes } });

function run(state: ScenarioState, instruction: Instruction): ScenarioState {
  return settle(pushEffectFrame(state, { frame: "travel", sourceId: "none", actor: 0, peril: false, effectId: "fixture:travel:1", instructions: [instruction], cancel: null, blockCancel: null }, []), ctx, []);
}

const faceOfCaptain = (state: ScenarioState): string | undefined => Object.values(state.cards).find((card) => card.code === "captain")?.face;

describe("a card turned faceup by an effect, in a game that upgraded it", () => {
  it("shows side B when a search takes it from the facedown encounter deck, and faceup otherwise", () => {
    const search: Instruction = { verb: "SearchMove", trait: "Corsair", type: "enemy", to: "staging" };
    const dealt = spawn(table(1), "captain", { zone: "encounterDeck" }, "down").state;
    expect(faceOfCaptain(run(upgraded(dealt, ["captain"]), search))).toBe("B");
    expect(faceOfCaptain(run(dealt, search))).toBe("up");
  });

  it("shows side B when AddSetAsideToStaging brings it from the set-aside cards, and faceup otherwise", () => {
    const bring: Instruction = { verb: "AddSetAsideToStaging", code: "captain" };
    const aside = spawn(table(1), "captain", { zone: "setAside" }).state;
    const done = run(upgraded(aside, ["captain"]), bring);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["captain"]);
    expect(faceOfCaptain(done)).toBe("B");
    expect(faceOfCaptain(run(aside, bring))).toBe("up");
  });
});

describe("a card whose Upgraded side prints no lines", () => {
  it("stays faceup even when the log lists it as upgraded (Gavin, Send for Help)", () => {
    for (const code of ["11210", "11211", "11214", "11038"]) expect(turnedUpCode(upgraded(table(1), [code]), code)).toBe("up");
  });
});
