// Rules: hrd.setup-beneath-the-sands, hrd.search-objective, hrd.track, rr.explored, rr.forced, rr.response, mec108.side-quests-in-play, mec108.side-quests (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { sandsStart, sandsWorld } from "../../../../test/scenarios/beneath-the-sands/game.ts";
import { flagged } from "../../../rules/core/state.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, flag, quest, resourcesOn, respond, reveal, rowProblems, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { codesIn, idOf, opened, resolveRecords, run, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { sideQuestCurrent } from "../../../rules/families/haradrim/race-kit.ts";
import { EFFECTS } from "../../../effects/index.ts";

const OFF = "17079";
const ON = "17080";
const BROOD_MOTHER = "17065";

describe("beneath-the-sands Setup", () => {
  it("17076:A:1 the deal sets Brood Mother aside and adds the Search objective to the staging area Off Track", async () => {
    const world = await sandsWorld();
    const state = expectOk(reduce(startScenario(sandsStart(1, 1, "Normal"), world.ctx), { type: "Keep" }, world.ctx)).state;
    expect(codesIn(state, "setAside")).toContain(BROOD_MOTHER);
    expect(codesIn(state, "staging")).toContain(OFF);
    expect(codesIn(state, "staging")).not.toContain(ON);
  });
});

// The rows that need a longer moment than one action: the scenario's side quest, an explored location, the objective's own end-of-phase Forced effect.
const ROWS: readonly Row[] = [
  // 17068:A:3 "Forced: When Spider Burrow leaves play explored, set Brood Mother aside, out of play. (Do not set aside at stage 3B.)" Quest success fills the active location, which is explored.
  { line: "17068:A:3", name: "explored, Spider Burrow sets Brood Mother aside", layout: { stage: "17076", side: "B", active: { code: "17068", progress: 1 }, engaged: [BROOD_MOTHER], staging: [ON], deck: ["17066", "f0", "f0", "17067", "f0", "f0"] }, act: quest("success"), expect: [zone("17068", "encounterDiscard"), zone(BROOD_MOTHER, "setAside")] },

  // 17075 Lost Underground. When Revealed: flip the Search objective to Off Track. (Do not resolve the Track keyword.) While it is in play the objective does not flip, and Track does not resolve. Response: when it is defeated flip the objective to On Track and ignore its Forced effects until the end of the phase.
  { line: "17075:A:1", name: "When Revealed: the objective flips to Off Track and cannot flip while the side quest is in play", layout: { stage: "17076", side: "B", staging: [ON] }, act: reveal("17075"), expect: [count(OFF, "staging", 1), flag("table", "cannotFlipSearch")] },
  { line: "17075:A:1", name: "(Do not resolve the Track keyword) while it is in play: a Track location discards no card and flips nothing", layout: { stage: "17076", side: "B", staging: ["17070", OFF], deck: ["f0", "f0", "17066", "f3"] }, act: [reveal("17075"), announce("traveled", "17070")], expect: [count(OFF, "staging", 1), deckCount(4)] },
  { line: "17075:A:2", name: "Response when it is defeated: the objective flips to On Track and ignores its Forced effects this phase", layout: { stage: "17076", side: "B", staging: [OFF, { code: "17075", progress: 5 }] }, act: [announce("questDefeated", "17075"), respond("17075")], expect: [count(ON, "staging", 1), flag(ON, "cannotTriggerForced")] },

  // 17079 Off Track. Forced: at the end of the quest phase it takes a resource, then the first player returns the topmost location of the discard pile to the staging area or each player raises their threat by the resources on it.
  { line: "17079:A:1", name: "end of the quest phase: a resource, and the topmost location of the discard pile returns to the staging area", layout: { phase: "Quest", stage: "17076", side: "B", staging: [OFF], discard: ["17068", "17071", "f0"] }, act: [announce("endOfPhase"), answer("location")], expect: [resourcesOn(OFF, 1), zone("17071", "staging"), zone("17068", "encounterDiscard")] },
  { line: "17079:A:1", name: "end of the quest phase: or each player raises their threat by the resources on it", layout: { stage: "17076", side: "B", phase: "Quest", staging: [{ code: OFF, resources: 1 }], discard: ["17068"] }, act: [announce("endOfPhase"), answer("threat")], expect: [resourcesOn(OFF, 2), threat(30)] },
  { line: "17079:A:1", name: "end of the quest phase: with no location in the discard pile only the threat option is offered", layout: { phase: "Quest", stage: "17076", side: "B", staging: [OFF], discard: ["f0"] }, act: announce("endOfPhase"), expect: [resourcesOn(OFF, 1), threat(29)] },
];
cardSpecs("beneath-the-sands", ROWS);

describe("17068:A:3 at stage 3B", () => {
  it("17068:A:3 Brood Mother is not set aside when Spider Burrow leaves play explored at stage 3B", () => {
    const row: Row = { line: "17068:A:3", layout: { stage: "17078", side: "B", active: { code: "17068", progress: 1 }, staging: [ON], engaged: [BROOD_MOTHER], deck: ["17066", "f0", "f0", "17067", "f0", "f0"] }, act: quest("success"), expect: [zone("17068", "encounterDiscard"), zone(BROOD_MOTHER, "engaged")] };
    expect(rowProblems("beneath-the-sands", row, EFFECTS)).toEqual([]);
  });
});

describe("the Search objective's plain readings", () => {
  const read = (row: Row) => expect(rowProblems("beneath-the-sands", row, EFFECTS)).toEqual([]);
  it("17073:A:2 Shadow: with Off Track in play the attacker makes no additional attack", () => {
    read({ line: "17073:A:2", layout: { staging: [OFF] }, act: attack("f0", { shadow: "17073", undefended: true }), expect: damageOn("dh1", 1) });
  });
  it("17070:A:1 Track does not resolve while On Track is in play", () => {
    read({ line: "17070:A:1", layout: { staging: ["17070", ON], deck: ["f0", "f0", "f3"] }, act: announce("traveled", "17070"), expect: [count(ON, "staging", 1), deckCount(3)] });
  });
});

const sideQuestTable = (effects: Parameters<typeof lineSpec>[2] extends (e: infer E) => unknown ? E : never) => {
  const made = tableFromLayout("beneath-the-sands", { stage: "17076", side: "B", staging: [OFF, "17075"] }, { effects });
  const state = sideQuestCurrent(opened(made).state, idOf(opened(made).state, "17075"));
  return { made, state };
};
lineSpec("17079:A:2", "Progress cannot be placed on the main quest, but the side quest that is the current quest takes it", (effects) => {
  const { made, state } = sideQuestTable(effects);
  const placed = run(made, state, { verb: "PlaceQuestProgress", perPlayer: 2 });
  expect(placed.cards[idOf(state, "17075")]?.progress).toBe(2);
  const toMain = run(made, state, { verb: "QuestProgress", amount: 3, main: true });
  expect(toMain.cards[state.questStage ?? ""]?.progress).toBe(0);
});

lineSpec("17075:A:2", "the flip is the card's own text: it happens while Lost Underground still stops other flips", (effects) => {
  const made = tableFromLayout("beneath-the-sands", { stage: "17076", side: "B", staging: [OFF, { code: "17075", progress: 5 }] }, { effects });
  const state = opened(made).state;
  const blocked = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: idOf(state, "17075"), stat: "cannotFlipSearch", amount: 1, until: "whileSourceInPlay" } as const] };
  const done = resolveRecords(blocked, made.ctx, "17075", "response", idOf(state, "17075")).state;
  expect(done.cards[idOf(state, OFF)]?.code).toBe(ON);
  expect(flagged(done, idOf(state, OFF), "cannotTriggerForced")).toBe(true);
});
