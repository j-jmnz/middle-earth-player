// Rules: mec112.defense (data/rules/entries.json); ledger lines 143033:A:3, 143073:B:1, 143075:B:3. What the table says of Helm's Deep's pieces: the Defense dial and its limit, the quest meter and the quest result on a stage with Defense,
// and the stage whose filling loses the game. The engine decided each; nothing here changes one. No seat holds a dial.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { scenarioDefinition } from "../../catalog/scenario-data.ts";
import { updateCard } from "../../rules/core/state.ts";
import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { questTitle } from "../cards/table-preview.ts";
import { stripText } from "../canvas/table-canvas-views.ts";
import type { CardSlot } from "../layout/layout.ts";
import { defenseOutcome, defenseTokens, stageDefeatLoses, stageDetail, stageHasDefense } from "../readouts/fortress.ts";
import { advanceWords } from "../readouts/quest-advance.ts";
import { readoutFor } from "../readouts/readout.ts";
import { questScaleOf, scaleLabel, scaleMarker, type QuestScale } from "../readouts/quest-scale.ts";
import { threatMeter } from "../readouts/threat-level.ts";
import { heldDials } from "../readouts/widgets.ts";
import { DEFENSE_STAGE, defenseLimitWords, defenseQuestResult } from "../words/scenarios/fortress.ts";

const table = (layout: Layout = {}) => tableFromLayout("helms-deep", layout);
const nameOf = (made: ReturnType<typeof table>) => (code: string) => made.cards.get(code)?.name ?? code;

describe("the Defense dial", () => {
  it("is declared by the scenario's definition with the number read from the record, and a scenario with no such card declares none", () => {
    expect(table().definition.widgets.defenseTracker).toEqual({ code: "143033", limit: 8, stage: 5 });
    expect(scenarioDefinition(loadScenario("the-oath"), loadCampaign(), []).widgets).not.toHaveProperty("defenseTracker");
  });

  it("reads the tokens the engine holds while the objective is in play, and is none before it joins the staging area and after it joins the victory display", () => {
    const made = table({ staging: [{ code: "143033", resources: 5 }] });
    expect(defenseTokens(made.state, nameOf(made))).toEqual({ name: "The Defense of Helm's Deep", value: 5, limit: 8, stage: 5 });
    expect(defenseTokens(table({ setAside: ["143033"] }).state, nameOf(made))).toBeNull();
    expect(defenseTokens(table({ victory: ["143033"] }).state, nameOf(made))).toBeNull();
    const none = { ...made.state, widgets: { ...made.state.widgets, defenseTracker: undefined } };
    expect(defenseTokens(none, nameOf(made))).toBeNull();
    const more = updateCard(made.state, idOf(made.state, "143033"), { resources: 6 });
    expect(defenseTokens(more, nameOf(made))?.value).toBe(6);
  });

  it("fills its ring against the limit, and is read as the tokens on the objective with how many more advance the players (the limit is their way out: no warning)", () => {
    expect(threatMeter(4, 8)).toBe(0.5);
    expect(defenseLimitWords(6, 8, 5)).toBe("2 more and the players advance to stage 5");
    expect(defenseLimitWords(7, 8, 5)).toBe("1 more and the players advance to stage 5");
  });

  it("143073:B:1 leaves every seat without a held dial", () => {
    const made = table({ seats: 2, stage: "143073", staging: ["143033"] });
    expect(heldDials(made.state, nameOf(made), (code) => made.cards.get(code)?.type === "enemy")).toEqual([]);
  });
});

describe("the quest on a stage with Defense", () => {
  it("143073:B:1 holds the keyword on stages 2B to 4B and not on stage 1B or 5A", () => {
    expect(stageHasDefense(table({ stage: "143072" }).state)).toBe(false);
    for (const stage of ["143073", "143074", "143075"]) expect(stageHasDefense(table({ stage }).state)).toBe(true);
    expect(stageHasDefense(table({ stage: "143076" }).state)).toBe(false);
  });


  it("143073:B:1 says the encounter deck places the difference when the Threat wins, and no progress when the Willpower does, and names no threat for the players", () => {
    const none = { fills: "nothing", reveals: false } as const;
    expect(defenseQuestResult(2, 5, none)).toBe("The encounter deck places 3 progress, not your threat");
    expect(defenseQuestResult(5, 2, none)).toBe("The encounter deck places no progress");
    expect(defenseQuestResult(3, 3, none)).toBe("The encounter deck places no progress");
    // Committing 4 Willpower against 6 Threat in the staging area, the dock's result line is the Defense line; on stage 1B it is the plain one.
    const made = table({ stage: "143073", staging: ["f3", "f3"], committed: ["dh1", "dh2"] });
    const readout = readoutFor({ ...made.state, mode: "resolution" }, made.ctx, null, null, () => "");
    expect(readout?.result).toBe("The encounter deck places 2 progress, not your threat");
    const plain = table({ stage: "143072", staging: ["f3", "f3"], committed: ["dh1", "dh2"] });
    expect(readoutFor({ ...plain.state, mode: "resolution" }, plain.ctx, null, null, () => "")?.result).toMatch(/^Threat \+2 if nothing changes/);
  });

  it("143075:B:3 says what filling the stage does: stage 4B loses, 2B advances to stage 3, and 3B with no progress on it has the first player reveal a card (143074:B:2)", () => {
    // Stage 4B with 7 progress, 6 Threat against 2 Willpower: the encounter deck places 4 and the players lose, though no threat rises.
    const wall = table({ stage: "143075", progress: 7, staging: ["f3", "f3"], committed: ["dh1"] });
    expect(defenseOutcome(wall.state, wall.ctx)).toEqual({ fills: "loses", reveals: false });
    expect(readoutFor({ ...wall.state, mode: "resolution" }, wall.ctx, null, null, () => "")?.result).toBe("The encounter deck places 4 progress, not your threat; the stage fills: the players lose");
    const second = table({ stage: "143073", progress: 7, staging: ["f3", "f3"], committed: ["dh1"] });
    expect(defenseOutcome(second.state, second.ctx)).toEqual({ fills: { advancesTo: 3 }, reveals: false });
    expect(readoutFor({ ...second.state, mode: "resolution" }, second.ctx, null, null, () => "")?.result).toBe("The encounter deck places 4 progress, not your threat; the stage fills: advance to stage 3");
    // Willpower beats the Threat on stage 3B: nothing lands on it, so the first player reveals a card.
    const third = table({ stage: "143074", staging: ["f3"], committed: ["dh1", "dh2"] });
    expect(defenseOutcome(third.state, third.ctx)).toEqual({ fills: "nothing", reveals: true });
    expect(readoutFor({ ...third.state, mode: "resolution" }, third.ctx, null, null, () => "")?.result).toBe("The encounter deck places no progress; the first player reveals 1 encounter card");
  });

  it("143073:B:1 draws the meter's marker as the way the progress goes: +N to the stage for the encounter deck when short, Held when ahead", () => {
    const at = (delta: number, defense?: boolean): QuestScale => ({ threat: 0, willpower: 0, delta, live: true, seat: null, ...(defense ? { defense } : {}) });
    expect(scaleMarker(at(-2, true))).toEqual({ value: "+2", word: "Encounter", tone: "danger", caption: "to stage" });
    expect(scaleMarker(at(3, true))).toEqual({ value: "Held", word: "Held", tone: "muted", caption: null });
    expect(scaleMarker(at(0, true)).word).toBe("Even");
    expect(scaleMarker(at(-2))).toEqual({ value: "−2", word: "Short", tone: "danger", caption: null });
    const made = table({ stage: "143073", staging: ["f3", "f3"], committed: ["dh1", "dh2"] });
    const scale = questScaleOf(made.state, made.ctx, null);
    expect(scale.defense).toBe(true);
    expect(scaleLabel(scale)).toBe("threat in staging 6, willpower committed 4, the encounter deck places 2 progress, the stage has Defense");
    expect(questScaleOf(table({ stage: "143072" }).state, made.ctx, null).defense).toBeUndefined();
  });
});

describe("the stage that loses when it is full", () => {
  it("143075:B:3 is stage 4B alone, read from its record", () => {
    const made = table({ stage: "143075" });
    expect(stageDefeatLoses(made.ctx, "143075")).toBe(true);
    for (const code of ["143072", "143073", "143074", "143076"]) expect(stageDefeatLoses(made.ctx, code)).toBe(false);
  });

  it("says when a stage with Defense is full in its preview title line, beside its progress over its quest points, and on the advance screen: the loss first on 4B", () => {
    const made = table({ stage: "143075", progress: 3 });
    const stage = idOf(made.state, "143075");
    const title = questTitle(made.state, made.ctx, stage, "The Wall is Breached!", () => null);
    expect(title).toEqual({ title: "The Wall is Breached! · 3 / 8", detail: `The players lose at 8 progress. ${DEFENSE_STAGE}` });
    expect(advanceWords(made.state, made.ctx, stage, "The Wall is Breached!", () => null).detail).toBe(`The players lose at 8 progress. ${DEFENSE_STAGE}`);
    const second = table({ stage: "143073" });
    expect(stageDetail(second.state, second.ctx, "143073", 8, null, "8 quest points to complete it")).toEqual(["The encounter deck advances it at 8 progress", DEFENSE_STAGE]);
    const first = table({ stage: "143072" });
    expect(stageDetail(first.state, first.ctx, "143072", 8, null, "8 quest points to complete it")).toEqual(["8 quest points to complete it"]);
  });

  it("143075:B:3 says it on the quest card's progress strip on the table, in a word beside the threat red: \"5 / 8 · lose\" on 4B, the plain count on 3B", () => {
    const wall = table({ stage: "143075", progress: 5 });
    const numbers = slotNumbers(wall.state, wall.ctx, idOf(wall.state, "143075"));
    expect(numbers.stageLoses).toBe(true);
    expect(stripText({ progress: 5 } as CardSlot, numbers.questPoints, null, numbers.stageLoses)).toBe("5 / 8 · lose");
    const hosts = table({ stage: "143074", progress: 5 });
    const plain = slotNumbers(hosts.state, hosts.ctx, idOf(hosts.state, "143074"));
    expect(plain.stageLoses).toBe(false);
    expect(stripText({ progress: 5 } as CardSlot, plain.questPoints, null, plain.stageLoses)).toBe(`5 / ${plain.questPoints}`);
  });
});
