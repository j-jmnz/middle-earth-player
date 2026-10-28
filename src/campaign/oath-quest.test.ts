// Rules: rr.quest-advancement, rr.winning-the-game, rr.search, rr.victory-display, rr.first-player (data/rules/entries.json). The three quest cards of The
// Oath (41001, 41002, 41003) on a table of plain-number heroes (scripts/oath-scene.ts): their Setup, When Revealed and what keeps a stage from advancing.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { runInstruction } from "../rules/interpret.ts";
import { destroyCard } from "../rules/keywords.ts";
import { settle } from "../rules/machine.ts";
import { expectOk } from "../rules/fixture.ts";
import { reduce } from "../rules/reduce.ts";
import type { ScenarioState } from "../rules/state.ts";
import { codesIn, loadOathWorld, oathTable, type OathLayout, type OathWorld } from "../../scripts/oath-scene.ts";
import { first } from "../../scripts/past-scene.ts";

let world: OathWorld;

beforeAll(async () => {
  world = await loadOathWorld();
});

function make(layout: OathLayout = {}) {
  const made = oathTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

// `amount` progress placed on the quest, as questing does: the stage advances when it is full and nothing holds it back.
function progress(state: ScenarioState, amount: number, ctx: Table["ctx"]): ScenarioState {
  return settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "ProgressQuest", amount }, { seat: 0, sourceId: state.questStage }, ctx, []), ctx), ctx, []);
}

// Answers the open choice through the reducer.
function choose(state: ScenarioState, optionId: string, ctx: Table["ctx"]): ScenarioState {
  return expectOk(reduce(state, { type: "Choose", optionId }, ctx)).state;
}

const stageOf = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;

describe("After the Raid, stage 1 (41001:A:1)", () => {
  it("is dealt by the scenario's piles: The Eaves of Mirkwood in the staging area, Goblin Troop set aside, and the record says so", () => {
    const record = world.definition.setup.map((instruction) => ("code" in instruction ? `${instruction.verb}:${instruction.code}` : instruction.verb));
    expect(record).toEqual(expect.arrayContaining(["SetAside:41019", "AddToStaging:41010"]));
    const effect = oathTable(world).ctx.effects.find((entry) => entry.id === "41001:setup:1");
    expect(effect?.instructions.map((instruction) => ("code" in instruction ? `${instruction.verb}:${instruction.code}` : instruction.verb))).toEqual(["AddToStaging:41010", "SetAside:41019", "ShuffleEncounterDeck"]);
  });
});

describe("Mirkwood Forest, stage 2B (41002:B:1, 41002:B:2)", () => {
  it("has each player search the encounter deck and discard pile for a Forest location and add it to the staging area", () => {
    // Stage 1 is full: stage 2 is revealed with its When Revealed effects.
    const made = make({ seats: 2, deck: ["f0", "41011", "f0", "41015"], discard: ["41012", "41014"] });
    const advanced = progress(made.state, 9, made.ctx);
    expect(stageOf(advanced)).toBe("41002");
    // Each player's search finds a Forest location (the first one is taken without asking when there is no choice, else the options are asked).
    let current = advanced;
    for (let guard = 0; guard < 8 && current.window?.kind === "choose"; guard += 1) {
      const window = current.window;
      current = choose(current, window.options[0] ?? "", made.ctx);
    }
    const staged = codesIn(current, "staging").filter((code) => code.startsWith("410"));
    expect(staged).toHaveLength(2);
    for (const code of staged) expect(["41011", "41012", "41014", "41015"]).toContain(code);
  });

  it("cannot be defeated unless a Goblin Trail is in the victory display", () => {
    const without = make({ stage: "41002" });
    const full = progress(without.state, 12, without.ctx);
    expect(stageOf(full)).toBe("41002");
    expect(full.cards[full.questStage ?? ""]?.progress).toBe(12);
    const withTrail = make({ stage: "41002", victory: ["41014"] });
    expect(stageOf(progress(withTrail.state, 12, withTrail.ctx))).toBe("41003");
  });
});

describe("The Rearguard, stage 3 (41003:A:1, 41003:B:1)", () => {
  it("has the first player add the set-aside Goblin Troop and each other player search for a Goblin enemy", () => {
    const made = make({ seats: 2, stage: "41002", victory: ["41014"], setAside: ["41019"], deck: ["f0", "41020", "41023"] });
    const advanced = progress(made.state, 12, made.ctx);
    let current = advanced;
    for (let guard = 0; guard < 8 && current.window?.kind === "choose"; guard += 1) current = choose(current, current.window.options[0] ?? "", made.ctx);
    expect(stageOf(current)).toBe("41003");
    const staged = codesIn(current, "staging");
    expect(staged).toContain("41019");
    // One Goblin enemy for the one other player, not two.
    expect(staged.filter((code) => code === "41020" || code === "41023")).toHaveLength(1);
  });

  it("has a lone player add Goblin Troop and search for nothing", () => {
    const made = make({ seats: 1, stage: "41002", victory: ["41014"], setAside: ["41019"], deck: ["f0", "41020"] });
    const current = progress(made.state, 12, made.ctx);
    expect(codesIn(current, "staging")).toEqual(["41019"]);
    expect(codesIn(current, "encounterDeck")).toEqual(["41020", "f0"]);
  });

  it("cannot be defeated while Goblin Troop is in play, and defeating it with the Troop gone wins the game", () => {
    const withTroop = make({ stage: "41003", staging: ["41019"] });
    const held = progress(withTroop.state, 6, withTroop.ctx);
    expect(held.stageCleared).toBe(false);
    expect(held.cards[held.questStage ?? ""]?.progress).toBe(6);
    const troop = first(held, "41019");
    const gone = settle(syncConstants(destroyCard(held, troop, withTroop.ctx.cards, []), withTroop.ctx), withTroop.ctx, []);
    const won = progress(gone, 1, withTroop.ctx);
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBe(false);
    const free = make({ stage: "41003" });
    expect(progress(free.state, 6, free.ctx).stageCleared).toBe(true);
  });
});
