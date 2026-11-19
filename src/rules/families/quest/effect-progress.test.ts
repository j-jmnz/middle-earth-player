// Rules: rr.step-3-4, rr.active-location, rr.cannot (data/rules/entries.json); ledger line 00018:B:1.
// The flag noEffectProgress on stage 3 of The Massing at Osgiliath: progress from card effects cannot be placed on the quest card or the active location; a location in the staging area still takes it, and questing's own progress goes
// on the active location first as usual.
import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import { placeQuestingProgress } from "../defense/damage.ts";
import { first, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const WATCHTOWER = "00007";
const RUINS = "00011";

const table = (layout: Layout = {}) => tableFromLayout("the-massing-at-osgiliath", { stage: "00018", ...layout });

describe("noEffectProgress (00018:B:1)", () => {
  it("00018:B:1 a card effect places no progress on the quest card or the active location", () => {
    const made = table({ active: RUINS });
    const stage = made.state.questStage ?? "";
    const quest = runInstruction(made.state, { verb: "ProgressQuest", amount: 2 }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(quest.cards[stage]?.progress).toBe(0);
    expect(quest.cards[first(quest, RUINS)]?.progress).toBe(0);
    const direct = runInstruction(made.state, { verb: "PlaceProgressOn", amount: 2, target: "activeLocation" }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(direct.cards[first(direct, RUINS)]?.progress).toBe(0);
  });

  it("00018:B:1 a location in the staging area still takes progress from an effect", () => {
    const made = table({ staging: [WATCHTOWER] });
    const placed = runInstruction(made.state, { verb: "PlaceProgressOn", amount: 1, target: "eachStagingLocation" }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(placed.cards[first(placed, WATCHTOWER)]?.progress).toBe(1);
  });

  it("00018:B:1 the progress a successful quest places goes on the active location first", () => {
    const made = table({ active: RUINS });
    const placed = placeQuestingProgress(made.state, 2, made.cards, [], () => true);
    expect(placed.cards[first(placed, RUINS)]?.progress).toBe(2);
  });

  it("00018:B:1 other stages leave effect progress free", () => {
    const made = table({ stage: "00017", active: RUINS });
    const quest = runInstruction(made.state, { verb: "ProgressQuest", amount: 2 }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(quest.cards[first(quest, RUINS)]?.progress).toBe(2);
  });
});
