// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.sailing, dcce.heading, rr.quest-advancement, rr.search, rr.cancel (data/rules/entries.json). The Flight of the Stormcaller quest stages on a table of
// plain-number heroes and the Campaign Expansion's cards (scripts/stormcaller-scene.ts): the progress caps, the extra reveal, the Weather treachery the Cape of Andrast resolves and the damage it deals.
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../rules/keywords.ts";
import { settle } from "../rules/machine.ts";
import { placeQuestProgress } from "../rules/quest.ts";
import type { ScenarioState } from "../rules/state.ts";
import { questRoom } from "../rules/families/caves/progress.ts";
import { CODES, codesIn, flightTable, idOf, loadFlightWorld, resolveRecords, send, start, type FlightLayout, type FlightWorld } from "../../scripts/stormcaller-scene.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

const make = (layout: FlightLayout = {}) => flightTable(world, layout);
const damageOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;

describe("Full Sail Ahead, stage 2B (12013)", () => {
  it("adds Swift Raider to the staging area when it is revealed, searching the encounter deck and discard pile, and shuffles the deck (A:1)", () => {
    const made = make({ stage: "12013", discard: [CODES.raider] });
    const found = resolveRecords(made.state, made.ctx, "12013", "whenRevealed", made.state.questStage ?? undefined);
    expect(codesIn(found.state, "staging")).toContain(CODES.raider);
    expect(found.state.encounterDiscard).toHaveLength(0);
    const inDeck = make({ stage: "12013", deck: ["f0", CODES.raider, "f0"] });
    expect(codesIn(resolveRecords(inDeck.state, inDeck.ctx, "12013", "whenRevealed", inDeck.state.questStage ?? undefined).state, "staging")).toContain(CODES.raider);
  });

  it("allows no more than 8 progress each round, and 4 when the players are off-course (B:2)", () => {
    expect(questRoom(make({ stage: "12013", heading: "Sun" }).state)).toBe(8);
    expect(questRoom(make({ stage: "12013", heading: "Cloud" }).state)).toBe(4);
    expect(questRoom(make({ stage: "12013", heading: "Storm" }).state)).toBe(4);
    const full = placeQuestProgress(make({ stage: "12013", heading: "Sun" }).state, 20, world.cards, [], () => true);
    expect(full.cards[full.questStage ?? ""]?.progress).toBe(8);
    const off = placeQuestProgress(make({ stage: "12013", heading: "Rain" }).state, 20, world.cards, [], () => true);
    expect(off.cards[off.questStage ?? ""]?.progress).toBe(4);
  });

  it("wins when it is defeated while the Stormcaller is at stage 2, and goes on to stage 3 when it is at stage 3 (B:3)", () => {
    const caught = placeQuestProgress(make({ stage: "12013", progress: 6, caller: 2 }).state, 6, world.cards, [], () => true);
    expect(caught.stageCleared).toBe(true);
    expect(caught.cards[caught.questStage ?? ""]?.code).toBe("12013");
    const ahead = placeQuestProgress(make({ stage: "12013", progress: 6, caller: 3 }).state, 6, world.cards, [], () => true);
    expect(ahead.stageCleared).toBe(false);
    expect(ahead.cards[ahead.questStage ?? ""]?.code).toBe("12014");
  });
});

describe("The Weather Turns Foul, stage 3B (12014)", () => {
  it("reveals an additional encounter card at the end of the staging step when the players are off-course (B:2)", () => {
    const stagingStep = (heading: "Sun" | "Cloud"): ScenarioState => {
      const made = make({ stage: "12014", heading, deck: ["f0", "f3", "f0", "f3", "f0"] });
      let state = settle({ ...made.state, mode: "staging", window: null }, made.ctx, []);
      for (let guard = 0; guard < 12 && state.mode === "staging"; guard += 1) state = settle(state, made.ctx, []);
      return state;
    };
    // One card is revealed for the one player; off-course a second joins it.
    expect(stagingStep("Sun").staging).toHaveLength(1);
    expect(stagingStep("Cloud").staging).toHaveLength(2);
  });

  it("wins when it is defeated at the Stormcaller's stage 3, and goes on to stage 4 when it is at stage 4 (B:3)", () => {
    expect(placeQuestProgress(make({ stage: "12014", progress: 16, caller: 3 }).state, 2, world.cards, [], () => true).stageCleared).toBe(true);
    const ahead = placeQuestProgress(make({ stage: "12014", progress: 16, caller: 4 }).state, 2, world.cards, [], () => true);
    expect(ahead.stageCleared).toBe(false);
    expect(ahead.cards[ahead.questStage ?? ""]?.code).toBe("12015");
  });
});

describe("The Cape of Andrast, stage 4B (12015)", () => {
  it("discards cards from the top of the encounter deck until a Weather treachery is, and resolves its When Revealed effects, which cannot be canceled (A:1)", () => {
    const made = make({ stage: "12015", deck: ["f0", "f3", CODES.windsOfWrath, "f0"], heading: "Rain" });
    const run = resolveRecords(made.state, made.ctx, "12015", "whenRevealed", made.state.questStage ?? undefined);
    // Winds of Wrath: off-course, 1 damage to each character in play.
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0", "f3", CODES.windsOfWrath].sort());
    expect(run.state.encounterDeck).toHaveLength(1);
    expect(run.state.cards[made.hero]?.damage).toBe(1);
    expect(damageOn(run.state, CODES.dreamChaser)).toBe(1);
    const record = made.ctx.effects.find((effect) => effect.id === "12015:whenRevealed:1");
    expect(record?.uncancelable).toBeDefined();
  });

  it("does nothing when the encounter deck holds no Weather treachery (A:1)", () => {
    const made = make({ stage: "12015", deck: ["f0", "f3"] });
    const run = resolveRecords(made.state, made.ctx, "12015", "whenRevealed", made.state.questStage ?? undefined);
    expect(run.state.failure).toBeNull();
    expect(run.state.cards[made.hero]?.damage).toBe(0);
  });

  it("deals 1 damage to each Ship objective and each Ship enemy at this stage after a Weather treachery is revealed (B:2)", () => {
    const made = make({ stage: "12015", staging: [CODES.raider, CODES.skiff], area: [CODES.escort], deck: [CODES.suddenStorms, "f0"], heading: "Sun" });
    // The reveal happens in the staging step: the Weather treachery is revealed and the stage's Forced effect hears it.
    let state = settle({ ...made.state, mode: "staging", window: null }, made.ctx, []);
    for (let guard = 0; guard < 20 && state.mode === "staging"; guard += 1) {
      if (state.window?.kind === "choose") state = send(start(state), { type: "Choose", optionId: state.window.options[0] ?? "" }, made.ctx).state;
      else state = settle(state, made.ctx, []);
    }
    expect(damageOn(state, CODES.dreamChaser)).toBeGreaterThanOrEqual(1);
    expect(damageOn(state, CODES.raider)).toBe(1);
    expect(damageOn(state, CODES.skiff)).toBe(1);
    // The Sahír's Escort stands in the Stormcaller's area, at another stage than the players': it takes none.
    expect(damageOn(state, CODES.escort)).toBe(0);
  });

  it("wins when it is defeated (B:3)", () => {
    expect(placeQuestProgress(make({ stage: "12015", progress: 22, caller: 4 }).state, 2, world.cards, [], () => true).stageCleared).toBe(true);
  });
});

describe("the Stormcaller's stages 2D and 3D (12016:B, 12017:B)", () => {
  it("add the Stormcaller's Threat +2 off-course to the progress it places, and 3C adds a Sahír's Escort to the area (12017:A:1)", () => {
    const made = make({ caller: 3, discard: [CODES.escort] });
    const run = resolveRecords(made.state, made.ctx, "12017", "whenRevealed", made.callerStage);
    expect(codesIn(run.state, "stormcallerArea")).toContain(CODES.escort);
    const threat = (heading: "Sun" | "Cloud"): number => {
      const table = make({ caller: 3, heading });
      return modifiedStat(table.state, table.state.cards[table.caller]!, "threat", world.cards);
    };
    expect([threat("Sun"), threat("Cloud")]).toEqual([2, 4]);
  });
});
