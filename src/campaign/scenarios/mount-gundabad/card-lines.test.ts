// Rules: emce.gundabad-quest-deck, emce.setup-mount-gundabad, rr.quest-advancement, rr.quest-cards-quest-deck, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 19137:A:1 to 19142:A:2 (side A of the stage 2s 19137 to 19142).
// Each Exploring Gundabad stage 2 prints on side A "When Revealed: Return Dagnir to the staging area." and "If Exploring Gundabad is the current main quest, do not flip it over until the beginning of the quest phase."
// Each test runs a second time on the records less the stage's line (the scenario definition built without them too) and shows that the result differs.
import { beforeAll, describe, expect, it } from "vitest";

import { scenarioDefinition } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { CODES, SCENE_EFFECTS, STAGE_TWOS, campaign, dealt, gundabadTable, legalIntents, loadGundabadWorld, send, start, type GundabadLayout, type GundabadWorld } from "../../../../test/scenarios/mount-gundabad/scene.ts";

let world: GundabadWorld;
beforeAll(async () => {
  world = await loadGundabadWorld();
}, 120_000);

type Stage = (typeof STAGE_TWOS)[number];
// The table on the scene's records, or on them less `line` (the definition, which copies a stage's flip marker onto it, built without the line as well).
function table(layout: GundabadLayout, line?: string) {
  if (!line) return gundabadTable(world, layout);
  return gundabadTable({ ...world, definition: scenarioDefinition(dealt, campaign, withoutLine(EFFECTS, line)) }, { ...layout, effects: withoutLine(SCENE_EFFECTS, line) });
}
const quest = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;
const face = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.face;
const dagnir = (state: ScenarioState) => Object.values(state.cards).find((card) => card.code === CODES.dagnir);

// The Upper Levels (19135, 3 quest points) is defeated in the quest phase with `code` on top of the quest deck and Dagnir engaged with the second player: `code` is revealed.
function revealedAfterDefeat(code: Stage, line?: string): ScenarioState {
  const t = table({ seats: 2, stage: "19135", progress: 3, questDeck: [code, ...STAGE_TWOS.filter((other) => other !== code && other !== "19135")], engaged: [{ code: CODES.dagnir, seat: 1 }] }, line);
  return settle({ ...t.state, window: null, mode: "stopped" }, t.ctx, []);
}

// The planning phase ends with `code` the current stage, side A up: the run goes on until the quest phase has begun.
function intoQuestPhase(code: Stage, line?: string): ScenarioState {
  const t = table({ phase: "Planning", stage: code, faceA: true, questDeck: STAGE_TWOS.filter((other) => other !== code && other !== "19135") }, line);
  let run = start(t.state);
  for (let guard = 0; guard < 20 && run.state.phase !== "Quest"; guard += 1) {
    const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass, t.ctx);
  }
  expect(run.state.phase).toBe("Quest");
  return run.state;
}

// "When Revealed: Return Dagnir to the staging area.": she leaves the player she is engaged with.
function returnsDagnir(code: Stage): void {
  const after = revealedAfterDefeat(code);
  expect(quest(after)).toBe(code);
  expect(dagnir(after)?.zone).toBe("staging");
  const without = revealedAfterDefeat(code, `${code}:A:1`);
  expect(quest(without)).toBe(code);
  expect(dagnir(without)?.zone).toBe("engaged");
}

// "Do not flip it over until the beginning of the quest phase": revealed in the quest phase it stays side A for the rest of the round, and the next quest phase turns it to side B.
function flipsAtQuestPhase(code: Stage): void {
  const revealed = revealedAfterDefeat(code);
  expect(quest(revealed)).toBe(code);
  expect(face(revealed)).toBe("A");
  expect(face(intoQuestPhase(code))).toBe("B");
  // Without the line's two records the stage is flipped as it is revealed, and the quest phase does not turn a stage that shows side A.
  const unheld = revealedAfterDefeat(code, `${code}:A:2`);
  expect(quest(unheld)).toBe(code);
  expect(face(unheld)).not.toBe("A");
  expect(face(intoQuestPhase(code, `${code}:A:2`))).not.toBe("B");
}

describe("the stage 2s, side A: When Revealed", () => {
  it("19137:A:1 When Revealed: Dagnir, engaged with the second player, returns to the staging area", () => returnsDagnir("19137"));
  it("19138:A:1 When Revealed: Dagnir, engaged with the second player, returns to the staging area", () => returnsDagnir("19138"));
  it("19139:A:1 When Revealed: Dagnir, engaged with the second player, returns to the staging area", () => returnsDagnir("19139"));
  it("19140:A:1 When Revealed: Dagnir, engaged with the second player, returns to the staging area", () => returnsDagnir("19140"));
  it("19141:A:1 When Revealed: Dagnir, engaged with the second player, returns to the staging area", () => returnsDagnir("19141"));
  it("19142:A:1 When Revealed: Dagnir, engaged with the second player, returns to the staging area", () => returnsDagnir("19142"));
});

describe("the stage 2s, side A: flipped at the beginning of the quest phase", () => {
  it("19137:A:2 revealed in the quest phase it stays side A; the next quest phase flips it to side B", () => flipsAtQuestPhase("19137"));
  it("19138:A:2 revealed in the quest phase it stays side A; the next quest phase flips it to side B", () => flipsAtQuestPhase("19138"));
  it("19139:A:2 revealed in the quest phase it stays side A; the next quest phase flips it to side B", () => flipsAtQuestPhase("19139"));
  it("19140:A:2 revealed in the quest phase it stays side A; the next quest phase flips it to side B", () => flipsAtQuestPhase("19140"));
  it("19141:A:2 revealed in the quest phase it stays side A; the next quest phase flips it to side B", () => flipsAtQuestPhase("19141"));
  it("19142:A:2 revealed in the quest phase it stays side A; the next quest phase flips it to side B", () => flipsAtQuestPhase("19142"));
});
