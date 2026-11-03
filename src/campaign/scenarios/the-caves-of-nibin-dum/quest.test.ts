// Rules: rr.quest-advancement, rr.winning-the-game, rr.search, rr.step-3-3, rr.active-location, rr.first-player (data/rules/entries.json). The four quest cards of The Caves of
// Nibin-Dûm (41004 to 41007) on a table of plain-number heroes (test/scenarios/the-caves-of-nibin-dum/scene.ts): their When Revealed, the constants and what advances each stage.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { destroyCard, modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { questStageStart } from "../../../rules/families/quest/setup.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { codesIn, loadCavesWorld, cavesTable, type CavesLayout, type CavesWorld } from "../../../../test/scenarios/the-caves-of-nibin-dum/scene.ts";
import { first, send, start } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: CavesWorld;

beforeAll(async () => {
  world = await loadCavesWorld();
});

function make(layout: CavesLayout = {}) {
  const made = cavesTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

// `amount` progress placed on the quest, as questing does: the stage advances when it is full and nothing holds it back.
function progress(state: ScenarioState, amount: number, ctx: Table["ctx"]): ScenarioState {
  return settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "ProgressQuest", amount }, { seat: 0, sourceId: state.questStage }, ctx, []), ctx), ctx, []);
}

function choose(state: ScenarioState, optionId: string, ctx: Table["ctx"]): ScenarioState {
  return expectOk(reduce(state, { type: "Choose", optionId }, ctx)).state;
}

// Answers every open choice with its first option.
function answered(state: ScenarioState, ctx: Table["ctx"], pick: (state: ScenarioState) => string = (current) => (current.window?.kind === "choose" ? (current.window.options[0] ?? "") : "")): ScenarioState {
  let current = state;
  for (let guard = 0; guard < 12 && current.window?.kind === "choose"; guard += 1) current = choose(current, pick(current), ctx);
  return current;
}

const stageOf = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;
const stat = (made: Table, state: ScenarioState, code: string, name: Parameters<typeof modifiedStat>[2]) => modifiedStat(state, state.cards[first(state, code)]!, name, made.ctx.cards);

describe("The Dark of Nibin-Dûm, stage 1 (41004:A:1, 41004:B:1)", () => {
  it("is dealt by the scenario's piles and its record: Goblin Chieftain and Cracked Pillar set aside, the Cave Torch out of the encounter deck", () => {
    const setup = world.definition.setup.map((instruction) => ("code" in instruction ? `${instruction.verb}:${instruction.code}` : instruction.verb));
    expect(setup).toEqual(expect.arrayContaining(["SetAside:41027", "SetAside:41028"]));
    expect(setup).not.toContain("SetAside:41029");
    const record = cavesTable(world).ctx.effects.find((entry) => entry.id === "41004:setup:1");
    expect(record?.instructions.map((instruction) => instruction.verb)).toEqual(["SetAside", "Pick", "AttachSetAside", "ShuffleEncounterDeck"]);
  });

  it("has each player search the encounter deck for a different location and add it to the staging area", () => {
    const made = make({ seats: 2, deck: ["f0", "41032", "41033", "f0", "41034"], staging: [] });
    const current = answered(settle(questStageStart({ ...made.state, window: null }, made.ctx, []), made.ctx, []), made.ctx);
    const staged = codesIn(current, "staging");
    expect(staged).toHaveLength(2);
    expect(new Set(staged).size).toBe(2);
    expect(staged.every((code) => ["41032", "41033", "41034"].includes(code))).toBe(true);
  });

  it("makes the second search a different title: two Lightless Passages are one choice, and a lone title is found once (41004:B:1)", () => {
    const made = make({ seats: 2, deck: ["f0", "41033", "41033", "41034"], staging: [] });
    const current = answered(settle(questStageStart({ ...made.state, window: null }, made.ctx, []), made.ctx, []), made.ctx);
    expect(codesIn(current, "staging").sort()).toEqual(["41033", "41034"]);
    const twins = make({ seats: 2, deck: ["f0", "41033", "41033"], staging: [] });
    const lone = answered(settle(questStageStart({ ...twins.state, window: null }, twins.ctx, []), twins.ctx, []), twins.ctx);
    expect(codesIn(lone, "staging")).toEqual(["41033"]);
  });
});

describe("Surprise Attack, stage 2 (41005:A:1, 41005:B:1, 41005:B:2)", () => {
  it("adds the set-aside Goblin Chieftain and has each player search the deck and discard pile for an enemy", () => {
    const made = make({ seats: 2, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41031"], discard: ["41031"] });
    const advanced = progress(made.state, 8, made.ctx);
    const current = answered(advanced, made.ctx);
    expect(stageOf(current)).toBe("41005");
    const staged = codesIn(current, "staging");
    expect(staged).toContain("41027");
    // Two enemies besides the Chieftain, one for each player.
    expect(staged.filter((code) => code === "41030" || code === "41031")).toHaveLength(2);
  });

  it("makes each player's enemy a different one: two Great Cave-trolls or two Cavern Wargs cannot both be found (41005:A:1)", () => {
    const made = make({ seats: 2, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41030", "41031"], discard: ["41031"] });
    const staged = codesIn(answered(progress(made.state, 8, made.ctx), made.ctx), "staging");
    expect(staged.filter((code) => code === "41030")).toHaveLength(1);
    expect(staged.filter((code) => code === "41031")).toHaveLength(1);
    const twins = make({ seats: 2, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41030"], discard: ["41030"] });
    expect(codesIn(answered(progress(twins.state, 8, twins.ctx), twins.ctx), "staging").filter((code) => code === "41030")).toHaveLength(1);
  });

  it("treats each enemy's engagement cost as 0 in the encounter phase only", () => {
    const quiet = make({ stage: "41005", staging: ["41030"], phase: "Encounter" });
    const troll = first(quiet.state, "41030");
    expect(modifiedStat(quiet.state, quiet.state.cards[troll]!, "engagementCost", quiet.ctx.cards)).toBe(0);
    const quest = make({ stage: "41005", staging: ["41030"], phase: "Quest" });
    expect(modifiedStat(quest.state, quest.state.cards[first(quest.state, "41030")]!, "engagementCost", quest.ctx.cards)).toBe(36);
    // The engagement check of the encounter phase engages the Great Cave-troll at threat 20 on stage 2 (cost 0), and leaves it in the staging area on stage 1 (cost 36).
    const checked = make({ stage: "41005", staging: ["41030"], phase: "Encounter", threat: [20, 20] });
    const after = (made: Table) => made.state.cards[first(made.state, "41030")]!;
    const engaged = send(start(checked.state), { type: "DeclineEngage" }, checked.ctx);
    expect(engaged.state.cards[after(checked).id]?.zone).toBe("engaged");
    const other = make({ stage: "41004", staging: ["41030"], phase: "Encounter", threat: [20, 20] });
    const stays = send(start(other.state), { type: "DeclineEngage" }, other.ctx);
    expect(stays.state.cards[after(other).id]?.zone).toBe("staging");
  });

  it("gets 4 quest points for each enemy in play", () => {
    const none = make({ stage: "41005" });
    expect(modifiedStat(none.state, none.state.cards[none.state.questStage ?? ""]!, "questPoints", none.ctx.cards)).toBe(0);
    const some = make({ stage: "41005", staging: ["41030", "41031"], engaged: [{ code: "41032", seat: 0 }, { code: "f0", seat: 0 }] });
    // Two enemies in the staging area and one engaged with the player (a location is not an enemy).
    expect(modifiedStat(some.state, some.state.cards[some.state.questStage ?? ""]!, "questPoints", some.ctx.cards)).toBe(4 * 3);
  });
});

describe("The Chasm, stage 3 (41006:A:1, 41006:B:1 to 41006:B:3)", () => {
  it("sets Goblin Chieftain aside, out of play, and adds the set-aside Cracked Pillar to the staging area", () => {
    const made = make({ stage: "41005", staging: ["41027"], setAside: ["41028"], progress: 0 });
    const advanced = progress(made.state, 1, made.ctx);
    // The stage prints 0 quest points plus 4 per enemy: the Chieftain in play makes it 4, so 4 progress advance it.
    const current = progress(advanced, 3, made.ctx);
    expect(stageOf(current)).toBe("41006");
    expect(codesIn(current, "setAside")).toContain("41027");
    expect(codesIn(current, "staging")).toEqual(["41028"]);
  });

  it("sets a Goblin Chieftain engaged with a player aside too, and the Pillar joins the staging area", () => {
    const made = make({ stage: "41005", engaged: [{ code: "41027", seat: 0 }], setAside: ["41028"], progress: 0 });
    const current = progress(made.state, 4, made.ctx);
    expect(stageOf(current)).toBe("41006");
    expect(codesIn(current, "setAside")).toContain("41027");
    expect(current.seats[0]?.engaged).toEqual([]);
  });

  it("reveals one more card in the quest phase", () => {
    const made = make({ stage: "41006", phase: "Planning" });
    const effect = made.ctx.effects.find((entry) => entry.id === "41006:forced:1");
    expect(effect?.trigger).toBe("beginningOfPhase");
    expect(effect?.instructions).toEqual([{ verb: "RevealMore", amount: 1 }]);
  });

  it("takes no progress on Cracked Pillar while it is in the staging area, and has no quest points of its own", () => {
    const made = make({ stage: "41006", staging: ["41028"] });
    const pillar = first(made.state, "41028");
    const placed = settle(runInstruction({ ...made.state, window: null }, { verb: "PlaceProgressOn", amount: 2, target: "picked" }, { seat: 0, sourceId: made.state.questStage }, { ...made.ctx }, []), made.ctx, []);
    expect(placed.cards[pillar]?.progress).toBe(0);
    // Progress on the quest alone never advances stage 3B (no quest points).
    const quested = progress(made.state, 20, made.ctx);
    expect(stageOf(quested)).toBe("41006");
    expect(quested.stageCleared).toBe(false);
  });

  it("advances to stage 4A when Cracked Pillar leaves play as an explored location", () => {
    const made = make({ stage: "41006", active: "41028", setAside: [] });
    const pillar = first(made.state, "41028");
    expect(made.state.cards[pillar]?.zone).toBe("activeLocation");
    // Its 2 quest points are met by the quest's progress, which the active location takes first: it is explored.
    const current = progress(made.state, 2, made.ctx);
    expect(made.state.cards[pillar]?.zone).toBe("activeLocation");
    expect(current.cards[pillar]?.zone).not.toBe("activeLocation");
    expect(stageOf(current)).toBe("41007");
  });

  it("does not advance when Cracked Pillar leaves play any other way", () => {
    const made = make({ stage: "41006", staging: ["41028"] });
    const pillar = first(made.state, "41028");
    const gone = destroyCard(made.state, pillar, made.ctx.cards, [], false);
    const current = settle(syncConstants({ ...gone, window: null }, made.ctx), made.ctx, []);
    expect(stageOf(current)).toBe("41006");
  });
});

describe("Oathkeepers, stage 4 (41007:A:1, 41007:B:1, 41007:B:2)", () => {
  it("adds the set-aside Goblin Chieftain to the staging area when it is revealed", () => {
    const made = make({ stage: "41006", active: "41028", setAside: ["41027"] });
    const current = progress(made.state, 2, made.ctx);
    expect(stageOf(current)).toBe("41007");
    expect(codesIn(current, "staging")).toContain("41027");
  });

  it("lets Goblin Chieftain take damage only with 8 progress on the stage", () => {
    const damageOf = (progressOn: number) => {
      const made = make({ stage: "41007", progress: progressOn, staging: ["41027"] });
      const chieftain = first(made.state, "41027");
      return placeDamage(made.state, chieftain, 3, made.ctx.cards, [], "combat", ruleCause("rr.damage")).cards[chieftain]?.damage;
    };
    expect(damageOf(7)).toBe(0);
    expect(damageOf(8)).toBe(3);
    expect(damageOf(12)).toBe(3);
  });

  it("cannot be defeated while Goblin Chieftain is in play, and defeating it with the Chieftain gone wins the game", () => {
    const withChieftain = make({ stage: "41007", staging: ["41027"] });
    const held = progress(withChieftain.state, 8, withChieftain.ctx);
    expect(held.stageCleared).toBe(false);
    expect(held.cards[held.questStage ?? ""]?.progress).toBe(8);
    const chieftain = first(held, "41027");
    const gone = settle(syncConstants(destroyCard(held, chieftain, withChieftain.ctx.cards, []), withChieftain.ctx), withChieftain.ctx, []);
    const won = progress(gone, 1, withChieftain.ctx);
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBe(false);
    const free = make({ stage: "41007" });
    expect(progress(free.state, 8, free.ctx).stageCleared).toBe(true);
  });
});

describe("Goblin Chieftain's stats (41027:A:1)", () => {
  it("has Threat, Attack and Defense equal to the stage number of the quest", () => {
    for (const [index, stage] of (["41004", "41005", "41006", "41007"] as const).entries()) {
      const made = make({ stage, staging: ["41027"] });
      expect([stat(made, made.state, "41027", "threat"), stat(made, made.state, "41027", "attack"), stat(made, made.state, "41027", "defense")], stage).toEqual([index + 1, index + 1, index + 1]);
    }
  });
});
