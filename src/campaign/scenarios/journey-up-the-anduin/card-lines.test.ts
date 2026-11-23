// Rules: rr.forced, rr.then, rr.step-3-4, rr.quest-advancement, rr.travel, rr.first-player, rr.guarded, rr.explored, rr.winning-the-game, emce.evil-creatures-deck, emce.boon-allies, emce.treasure, mec109.campaign-mode (data/rules/entries.json);
// ledger lines 18066:B:1, 18066:B:2, 18067:A:1, 18067:B:1, 18067:B:2, 18067:B:3, 18068:A:1, 18068:B:2, 18068:B:3, 18070:A:1, 18070:A:3, 120165:B:1, 120165:B:2.
// The quest stages of Journey Up the Anduin, Haldan and the campaign card's Resolution, each test written from the printed line. Rows run on `tableFromLayout` (test/harness/card-spec.ts) and run again without the
// line's records; the other tests build the same table. The stand-in heroes dh1 and dh2 quest for 4 Willpower together.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { updateCard, withMode, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { placeProgress } from "../../../rules/interpret/effect-verbs.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { cardSpecs, defend, attack, lost, quest, resolve, resourcesOn, revealedBy, travel, won, zone, deckCount, type Act, type Row } from "../../../../test/harness/card-spec.ts";
import { finish, idOf, legalIntents, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "journey-up-the-anduin";
// Codes read from data/scenarios/journey-up-the-anduin.json and data/cards.
const TRAVELING_NORTH = "18066"; // 10 quest points
const WOODMEN_UNDER_ATTACK = "18067"; // 5 quest points
const PASSAGE = "18068"; // 5 quest points
const OLD_FORD = "18016";
const WOODMEN_VILLAGE = "18069";
const HALDAN = "18070";
const LONELY_LANDS = "18024"; // 5 quest points
const BANKS = "01113";
const WOLF_RIDER = "01081";
const HILL_TROLL = "01082"; // 6 Attack
const TURAYN = "12166";
const TREASURE = "12196";

const evil = (...codes: string[]): Layout["piles"] => ({ evilCreaturesDeck: codes });
const endPhase: Act = { act: "endPhase" };

const ROWS: readonly Row[] = [
  // 18066 Traveling North: "Forced: After placing progress here from questing successfully, place 1 resource here."
  { line: "18066:B:1", name: "a successful quest that places progress on the stage places 1 resource on it", layout: { stage: TRAVELING_NORTH, deck: ["f0"] }, act: quest("success"), expect: resourcesOn(TRAVELING_NORTH, 1) },

  // 18067 Woodmen Under Attack: "When Revealed: The first player adds Woodmen Village to the staging area. Each other player reveals an encounter card."
  { line: "18067:A:1", name: "the first player adds Woodmen Village and the other player reveals a card", layout: { stage: WOODMEN_UNDER_ATTACK, seats: 2, setAside: [WOODMEN_VILLAGE], deck: ["f0", "f0"] }, act: resolve(WOODMEN_UNDER_ATTACK, "whenRevealed"), expect: [zone(WOODMEN_VILLAGE, "staging"), revealedBy("f0", 1), deckCount(1)] },
  { line: "18067:A:1", name: "with the second player first, the first seat is the other player who reveals", layout: { stage: WOODMEN_UNDER_ATTACK, seats: 2, firstPlayer: 1, setAside: [WOODMEN_VILLAGE], deck: ["f0", "f0"] }, act: resolve(WOODMEN_UNDER_ATTACK, "whenRevealed"), expect: [zone(WOODMEN_VILLAGE, "staging"), revealedBy("f0", 0), deckCount(1)] },
  // "Forced: After the players travel to a location, add the top card of the Evil Creatures deck to the staging area."
  { line: "18067:B:2", name: "after the players travel the top Evil Creatures card enters the staging area", layout: { stage: WOODMEN_UNDER_ATTACK, phase: "Travel", staging: [BANKS], piles: evil(HILL_TROLL, WOLF_RIDER) }, act: travel(BANKS), expect: [zone(BANKS, "activeLocation"), zone(HILL_TROLL, "staging"), zone(WOLF_RIDER, "evilCreaturesDeck")] },
  // "The players cannot defeat this stage unless the first player controls Haldan." 1 + 4 progress fill its 5 quest points.
  { line: "18067:B:3", name: "a full stage is not defeated while the first player does not control Haldan", layout: { stage: WOODMEN_UNDER_ATTACK, progress: 1, deck: ["f0"] }, act: quest("success"), expect: zone(WOODMEN_UNDER_ATTACK, "questStage") },

  // 18068 The Passage of the Ford: "When Revealed: The first player adds The Old Ford to the staging area. Each other player adds the top card of the Evil Creatures deck to the staging area."
  { line: "18068:A:1", name: "the first player adds The Old Ford and the other player the top Evil Creatures card", layout: { stage: PASSAGE, seats: 2, setAside: [OLD_FORD], piles: evil(HILL_TROLL, WOLF_RIDER) }, act: resolve(PASSAGE, "whenRevealed"), expect: [zone(OLD_FORD, "staging"), zone(HILL_TROLL, "staging"), zone(WOLF_RIDER, "evilCreaturesDeck")] },
  // "Forced: At the beginning of the quest phase, add the top card of the Evil Creatures deck to the staging area."
  { line: "18068:B:2", name: "the quest phase begins and the top Evil Creatures card enters the staging area", layout: { stage: PASSAGE, phase: "Planning", piles: evil(HILL_TROLL) }, act: endPhase, expect: zone(HILL_TROLL, "staging") },
  // "When The Old Ford is explored, the players win the game."
  { line: "18068:B:3", name: "the players win when The Old Ford is explored", layout: { stage: PASSAGE, active: OLD_FORD }, act: { act: "announce", trigger: "locationExplored", code: OLD_FORD }, expect: won },

  // 18070 Haldan: "If Haldan leaves play, the players lose the game." Hill Troll's 6 Attack against his 1 Defense destroys him (4 hit points).
  { line: "18070:A:3", name: "the players lose when he is destroyed defending", layout: { play: [HALDAN] }, act: [attack(HILL_TROLL), defend(HALDAN)], expect: [zone(HALDAN, "encounterDiscard"), lost] },
  { line: "18070:A:3", name: "the players lose when he leaves play", layout: { play: [HALDAN] }, act: { act: "announce", trigger: "leftPlay", code: HALDAN }, expect: lost },
];

cardSpecs(SCENARIO, ROWS);

const played = (layout: Layout, act: Act | readonly Act[]) => play(SCENARIO, { line: "", layout, act, expect: [] } satisfies Row, EFFECTS, false);
const codeAt = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

describe("18066 Traveling North", () => {
  it("18066:B:1 places no resource when the quest's progress all goes to the active location", () => {
    // Lonely Lands, active with 5 quest points, takes the 4 progress: none is placed on the stage.
    const done = played({ stage: TRAVELING_NORTH, active: LONELY_LANDS, deck: ["f0"] }, quest("success"));
    expect(done.run.state.cards[idOf(done.run.state, LONELY_LANDS)]?.progress).toBe(4);
    expect(done.run.state.cards[idOf(done.run.state, TRAVELING_NORTH)]).toMatchObject({ progress: 0, resources: 0 });
  });

  it("18066:B:1 places no resource for progress a card effect places in the quest phase", () => {
    const made = tableFromLayout(SCENARIO, { stage: TRAVELING_NORTH });
    const stage = idOf(made.state, TRAVELING_NORTH);
    const placed = finish({ state: settle(runInstruction({ ...start(made.state).state, window: null }, { verb: "PlaceQuestProgress", perPlayer: 2 }, { seat: 0, sourceId: stage }, made.ctx, []), made.ctx, []), steps: [] }, made.ctx);
    expect(placed.state.cards[stage]).toMatchObject({ progress: 2, resources: 0 });
  });

  // "Forced: At the beginning of the encounter phase, remove 1 resource from this stage. Then, add the top card of the Evil Creatures deck to the staging area."
  const toEncounter = (resources: number) => {
    // The filler enemy in the staging area (engagement cost above the threat) holds the round in the encounter phase's optional engagement.
    const made = tableFromLayout(SCENARIO, { stage: TRAVELING_NORTH, phase: "Travel", staging: ["f0"], piles: evil(HILL_TROLL, WOLF_RIDER) });
    const stage = idOf(made.state, TRAVELING_NORTH);
    const run = finish(send(start(updateCard(made.state, stage, { resources })), { type: "DeclineTravel" }, made.ctx), made.ctx);
    return { run, stage };
  };

  it("18066:B:2 removes 1 resource at the beginning of the encounter phase, then adds the top Evil Creatures card", () => {
    const { run, stage } = toEncounter(2);
    expect(run.state.phase).toBe("Encounter");
    expect(run.state.cards[stage]?.resources).toBe(1);
    expect(codeAt(run.state, run.state.staging)).toEqual(["f0", HILL_TROLL]);
  });

  it("18066:B:2 adds no Evil Creatures card when no resource could be removed (rr.then)", () => {
    const { run, stage } = toEncounter(0);
    expect(run.state.phase).toBe("Encounter");
    expect(run.state.cards[stage]?.resources).toBe(0);
    expect(codeAt(run.state, run.state.staging)).toEqual(["f0"]);
    expect(run.state.piles?.evilCreaturesDeck).toHaveLength(2);
  });
});

describe("18067 Woodmen Under Attack", () => {
  it("18067:A:1 with one player adds only Woodmen Village and reveals nothing", () => {
    const done = played({ stage: WOODMEN_UNDER_ATTACK, setAside: [WOODMEN_VILLAGE], deck: ["f0", "f0"] }, resolve(WOODMEN_UNDER_ATTACK, "whenRevealed"));
    expect(codeAt(done.run.state, done.run.state.staging)).toEqual([WOODMEN_VILLAGE]);
    expect(done.run.state.encounterDeck).toHaveLength(2);
  });

  // "No more than 1 progress can be placed on each location in the staging area each round."
  it("18067:B:1 lets 1 progress onto a location in the staging area each round", () => {
    const made = tableFromLayout(SCENARIO, { stage: WOODMEN_UNDER_ATTACK, staging: [LONELY_LANDS] });
    const lands = idOf(made.state, LONELY_LANDS);
    const once = placeProgress(made.state, lands, 3, made.ctx, []);
    expect(once.cards[lands]?.progress).toBe(1);
    expect(placeProgress(once, lands, 2, made.ctx, []).cards[lands]?.progress).toBe(1);
    // A new round lets 1 more on.
    expect(placeProgress(withMode(once, "beginRound"), lands, 2, made.ctx, []).cards[lands]?.progress).toBe(2);
  });

  it("18067:B:1 does not cap the active location", () => {
    const made = tableFromLayout(SCENARIO, { stage: WOODMEN_UNDER_ATTACK, active: LONELY_LANDS });
    const lands = idOf(made.state, LONELY_LANDS);
    expect(placeProgress(made.state, lands, 3, made.ctx, []).cards[lands]?.progress).toBe(3);
  });

  it("18067:B:3 is defeated once the first player controls Haldan", () => {
    const done = played({ stage: WOODMEN_UNDER_ATTACK, progress: 1, play: [HALDAN], deck: ["f0"] }, quest("success"));
    expect(done.run.state.cards[idOf(done.run.state, WOODMEN_UNDER_ATTACK)]?.zone).not.toBe("questStage");
    expect(done.run.state.cards[done.run.state.questStage ?? ""]?.code).toBe(PASSAGE);
  });
});

describe("18068 The Passage of the Ford", () => {
  it("18068:A:1 with one player adds only The Old Ford", () => {
    const done = played({ stage: PASSAGE, setAside: [OLD_FORD], piles: evil(HILL_TROLL) }, resolve(PASSAGE, "whenRevealed"));
    expect(codeAt(done.run.state, done.run.state.staging)).toEqual([OLD_FORD]);
    expect(done.run.state.piles?.evilCreaturesDeck).toHaveLength(1);
  });

  it("18068:B:2 adds nothing at the beginning of another phase", () => {
    const done = played({ stage: PASSAGE, phase: "Travel", staging: ["f0"], piles: evil(HILL_TROLL) }, endPhase);
    expect(done.run.state.phase).toBe("Encounter");
    expect(done.run.state.cards[idOf(done.run.state, HILL_TROLL)]?.zone).toBe("evilCreaturesDeck");
  });

  // "This stage cannot be defeated while The Old Ford is in play." An effect places the stage's 5 quest points of progress.
  const filled = (layout: Layout) => {
    const made = tableFromLayout(SCENARIO, { stage: PASSAGE, ...layout });
    const stage = idOf(made.state, PASSAGE);
    const state = settle(runInstruction({ ...start(made.state).state, window: null }, { verb: "PlaceQuestProgress", perPlayer: 5 }, { seat: 0, sourceId: stage }, made.ctx, []), made.ctx, []);
    return { state, stage };
  };

  it("18068:B:3 is not defeated with its quest points of progress while The Old Ford is in play", () => {
    const { state, stage } = filled({ staging: [OLD_FORD] });
    expect(state.cards[stage]).toMatchObject({ zone: "questStage", progress: 5 });
    expect(state.stageCleared).not.toBe(true);
  });

  it("18068:B:3 is defeated, and the game won, with The Old Ford out of play", () => {
    expect(filled({ setAside: [OLD_FORD] }).state.stageCleared).toBe(true);
  });

  it("18068:B:3 does not win when another location is explored", () => {
    const done = played({ stage: PASSAGE, active: BANKS }, { act: "announce", trigger: "locationExplored", code: BANKS });
    expect(done.run.state.stageCleared).not.toBe(true);
  });
});

describe("18070 Haldan", () => {
  // "The first player gains control of Haldan while he is free of encounters." A Hill Troll guards him in the staging area, as Woodmen Village leaves him.
  const guarded = (firstPlayer: 0 | 1) => {
    const made = tableFromLayout(SCENARIO, { seats: 2, firstPlayer, staging: [HALDAN, HILL_TROLL] });
    const haldan = idOf(made.state, HALDAN);
    const troll = idOf(made.state, HILL_TROLL);
    const state = settle(updateCard(attachTo(made.state, troll, haldan), troll, { guard: true }), made.ctx, []);
    return { made, state, haldan, troll };
  };

  it("18070:A:1 is controlled by nobody while an enemy guards him", () => {
    const { state, haldan } = guarded(1);
    expect(state.cards[haldan]).toMatchObject({ zone: "staging", controller: null });
  });

  it("18070:A:1 comes under the first player's control, the second seat here, once free of encounters", () => {
    const { made, state, haldan, troll } = guarded(1);
    const freed = settle(moveCard(state, troll, { zone: "encounterDiscard" }), made.ctx, []);
    expect(freed.cards[haldan]).toMatchObject({ zone: "play", controller: 1 });
  });

  it("18070:A:3 does not lose the game when another card leaves play", () => {
    const done = played({ play: [HALDAN, "ally"] }, { act: "announce", trigger: "leftPlay", code: "ally" });
    expect(done.run.state.lost).not.toBe(true);
  });
});

describe("120165 Journey Up the Anduin, Resolution", () => {
  // The scenario won on a table with the campaign card: the Resolution opens, and the first player's answer is `pick`.
  const resolved = (state: ScenarioState, ctx: ReduceContext, pick: (options: readonly string[]) => string | undefined) => {
    let next = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
    const asked: string[][] = [];
    for (let guard = 0; guard < 10 && next.window?.kind === "resolution"; guard += 1) {
      const options = legalIntents(next, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
      asked.push(options);
      next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: pick(options) ?? "" } as PlayerIntent, ctx)).state, ctx);
    }
    return { result: resolutionResult(next), asked };
  };

  // "If the heroes choose to accept his aid, add Turayn to the campaign pool ... Otherwise, mark in the campaign log that 'Turayn has taken an oath of vigilance'."
  it("120165:B:1 asks whether Turayn joins the pool, for either of two players, or the oath is written", () => {
    const made = tableFromLayout(SCENARIO, { seats: 2, campaign: true });
    const line = resolved(made.state, made.ctx, (options) => options.find((option) => option === "line"));
    expect(line.asked[0]?.filter((option) => option.startsWith(`${TURAYN}>`))).toHaveLength(2);
    expect(line.result?.allyLines).toEqual(["turayn"]);
    expect(line.result?.earned.map((item) => item.code)).not.toContain(TURAYN);
    const joined = resolved(made.state, made.ctx, (options) => options.find((option) => option.startsWith(`${TURAYN}>`)));
    expect(joined.result?.earned.map((item) => item.code)).toContain(TURAYN);
    expect(joined.result?.allyLines).toBeUndefined();
  });

  // "The players discover each treasure they control."
  it("120165:B:2 discovers a treasure the players control, attached to a hero", () => {
    const made = tableFromLayout(SCENARIO, { campaign: true, attached: [{ code: TREASURE, to: "dh1" }] }, { extra: [TREASURE] });
    const owned = updateCard(made.state, idOf(made.state, TREASURE), { claimed: true, controller: 0 });
    expect(resolved(owned, made.ctx, (options) => options.find((option) => option === "line")).result?.treasures).toEqual([TREASURE]);
  });

  it("120165:B:2 does not discover a treasure in the staging area, which no player controls", () => {
    const made = tableFromLayout(SCENARIO, { campaign: true }, { extra: [TREASURE] });
    const staged = spawn(made.state, TREASURE, { zone: "staging" }).state;
    expect(resolved(staged, made.ctx, (options) => options.find((option) => option === "line")).result?.treasures ?? []).toEqual([]);
  });
});
