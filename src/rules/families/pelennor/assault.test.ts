import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { cardMap, expectOk, fixtureDefinition, hero } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { ruleCause } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import { reduce } from "../../engine/reduce.ts";
import { blankScenario, updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";

// Rules: mec113.assault, rr.active-location, rr.quest-advancement, rr.step-3-4 (data/rules/entries.json); ledger lines 145075:B:1, 145075:B:4, 145076:B:1.
// Assault: no progress on the stage from questing or a player card effect, a failed quest damages Minas Tirith instead of raising threat, and an enemy's destruction places progress after the active location.

const city = definePrinted({ code: "145043", name: "Minas Tirith", type: "objective" });
const stage = definePrinted({ code: "stage-1", name: "Stage", type: "quest", questPoints: 6 });
const next = definePrinted({ code: "stage-2", name: "Next", type: "quest", questPoints: 4 });
const road = definePrinted({ code: "road", name: "Road", type: "location", threat: 0, questPoints: 2 });
const wolf = definePrinted({ code: "wolf", name: "Wolf", type: "enemy", threat: 3, engagementCost: 50, attack: 1, defense: 1, health: 3 });
const cards = cardMap([hero("sam", "leadership", 8, 2), stage, next, road, wolf, city]);

function atQuest(flag: "assault" | "progressAsDamage", opts: { withRoad?: boolean; stagingThreat?: boolean } = {}): ScenarioState {
  let state = blankScenario({ seatCount: 1, seed: 5, definition: fixtureDefinition(["stage-1", "stage-2"]) });
  const sam = spawn(state, "sam", { zone: "heroes", seat: 0 });
  state = updateCard(sam.state, sam.id, { committed: true, exhausted: true });
  const questStage = spawn(state, "stage-1", { zone: "questStage" }, "B");
  state = spawn(questStage.state, "stage-2", { zone: "questDeck" }, "A").state;
  state = spawn(state, "145043", { zone: "staging" }).state;
  if (opts.withRoad) state = spawn(state, "road", { zone: "activeLocation" }).state;
  if (opts.stagingThreat) state = spawn(state, "wolf", { zone: "staging" }).state;
  state = { ...state, modifiers: [...state.modifiers, { instanceId: questStage.id, sourceId: questStage.id, stat: flag, amount: 1, until: "whileSourceInPlay" }] };
  return { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 };
}

const resolve = (state: ScenarioState) => expectOk(reduce(state, { type: "Pass" }, { effects: [], cards })).state;
const idOf = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";

describe("Assault (145075:B:1)", () => {
  it("raises no threat for a failed quest and damages Minas Tirith by the shortfall (mec113.assault)", () => {
    const state = atQuest("assault", { stagingThreat: true });
    const before = state.seats[0].threat;
    const after = resolve(state);
    expect(after.seats[0].threat).toBe(before);
    expect(after.cards[idOf(after, "145043")]?.damage).toBe(1);
  });

  it("places no progress on the stage from a successful quest, only on the active location", () => {
    const state = atQuest("assault", { withRoad: true });
    const after = resolve(state);
    expect(after.cards[after.questStage ?? ""]?.progress).toBe(0);
    expect(after.cards[idOf(after, "road")]?.zone).toBe("encounterDiscard");
  });

  it("deals no damage when the quest does not fail", () => {
    const after = resolve(atQuest("assault"));
    expect(after.cards[idOf(after, "145043")]?.damage).toBe(0);
  });

  it("places progress after the active location, and the stage takes the rest (PlaceProgressActiveFirst, 145075:B:4)", () => {
    const state = atQuest("assault", { withRoad: true });
    const placed = runInstruction(state, { verb: "PlaceProgressActiveFirst", amount: 5 }, { seat: 0, sourceId: null }, { effects: [], cards }, []);
    expect(placed.cards[idOf(placed, "road")]?.zone).toBe("encounterDiscard");
    expect(placed.cards[placed.questStage ?? ""]?.progress).toBe(3);
  });

  it("advances a stage that the progress fills", () => {
    const state = atQuest("assault");
    const placed = runInstruction(state, { verb: "PlaceProgressActiveFirst", amount: 6 }, { seat: 0, sourceId: null }, { effects: [], cards }, []);
    expect(placed.cards[placed.questStage ?? ""]?.code).toBe("stage-2");
  });
});

describe("progressAsDamage (145076:B:1)", () => {
  it("holds the progress back from the stage and tells its record the amount (progressReplaced)", () => {
    const state = atQuest("progressAsDamage");
    const after = resolve(state);
    expect(after.cards[after.questStage ?? ""]?.progress).toBe(0);
  });

  it("is heard by a record of the stage as progressReplaced with the amount", () => {
    const record: Effect = { id: "stage-1:triggered:1", cardCode: "stage-1", lines: ["stage-1:B:1"], timing: "triggered", trigger: "progressReplaced", instructions: [{ verb: "PlaceResourceTokens", amount: { x: true }, on: "self" }] };
    const state = atQuest("progressAsDamage");
    const after = expectOk(reduce(state, { type: "Pass" }, { effects: [record], cards })).state;
    expect(after.cards[after.questStage ?? ""]?.progress).toBe(0);
    expect(after.cards[after.questStage ?? ""]?.resources).toBe(2);
  });
});

describe("the Threat an enemy's destruction places (145075:B:4)", () => {
  const destroyed = (flag: boolean) => {
    const base = atQuest("assault");
    const wolfCard = spawn(base, "wolf", { zone: "staging" });
    const bonus = { instanceId: wolfCard.id, sourceId: wolfCard.id, stat: "threat" as const, amount: 2, until: "whileSourceInPlay" as const };
    const state = { ...wolfCard.state, modifiers: [...wolfCard.state.modifiers.filter((modifier) => flag || modifier.stat !== "assault"), bonus] };
    const after = placeDamage(state, wolfCard.id, 9, cards, [], "combat", ruleCause("rr.damage"));
    return (after.pendingEvents ?? []).find((event) => event.trigger === "enemyDestroyed");
  };

  it("is stamped on the event as it stood in play, the Threat of a Wraith on Wings with its resources", () => {
    expect(destroyed(true)?.amount).toBe(5);
  });

  it("is left off the event when the stage has no Assault", () => {
    expect(destroyed(false)?.amount).toBeUndefined();
  });
});
