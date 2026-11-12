// Rules: mec113.saga-staging-rules, mec113.peril, mec113.multiplayer-aragorn, mec113.immune-to-player-card-effects, rr.cannot, rr.effects, rr.then, rr.quest-advancement, rr.winning-the-game, rr.travel, rr.damage, rr.engagement-check, rr.running-out-of-cards (data/rules/entries.json);
// ledger lines 145030:A:2, 145033:A:1, 145035:A:1, 145035:A:2, 145030:A:3, 145031:A:2, 145032:A:2, 145039:A:2, 145042:A:2, 145068:A:1, 145069:B:2, 145071:A:1. What a card-spec row cannot hold on The Siege of Gondor's own cards: a bar seen only in what is
// refused (the Great Corsair Ship's travel, the Port's heal cap, Corsair Captain's engagement, the stage's hold), an option that is not offered, and a whole staging step (The Corsair Fleet and Driven to the Brink). Each test title starts with the line it covers
// (scripts/checks/spec-coverage.test.ts).
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { legalTargets, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { announce, attackersOf, deckCount, endPhase, rowProblems, zone } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { idOf, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-siege-of-gondor";
const GREAT_SHIP = "145030";
const FLEET = "145071";
const CAPTAIN = "145035";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
const travelTargets = (state: ScenarioState, ctx: ReduceContext) => legalTargets({ ...state, window: { kind: "travel" } }, { type: "Travel" }, ctx);
const hasCard = (state: ScenarioState, code: string, where: string): boolean => Object.values(state.cards).some((card) => card.code === code && card.zone === where);
const problems = (row: Parameters<typeof rowProblems>[1]) => rowProblems(ID, row, EFFECTS);

describe("Great Corsair Ship", () => {
  it("145030:A:2 cannot be traveled to with fewer than 3 Ship locations in the victory display, and can with 3", () => {
    for (const [victory, wanted] of [[[], false], [["145031", "145032"], false], [["145031", "145032", "145031"], true], [["145031", "145032", "145031", "145032"], true]] as const) {
      const made = at({ phase: "Travel", staging: [GREAT_SHIP, "145034"], victory });
      expect(travelTargets(made.state, made.ctx).includes(idOf(made.state, GREAT_SHIP)), `${victory.length} Ships in the victory display`).toBe(wanted);
      // The other locations are not barred.
      expect(travelTargets(made.state, made.ctx)).toContain(idOf(made.state, "145034"));
    }
    // Only Ship locations count: a City in the victory display is not one.
    const cities = at({ phase: "Travel", staging: [GREAT_SHIP], victory: ["145031", "145033", "145034"] });
    expect(travelTargets(cities.state, cities.ctx)).not.toContain(idOf(cities.state, GREAT_SHIP));
  });

  it("145030:A:3 a Corsair enemy that is not Corsair Captain is taken freely when no Captain is left in the deck or the discard pile", () => {
    const layout: Layout = { phase: "Travel", threat: [10, 10], staging: [GREAT_SHIP], victory: ["145031", "145032", "145031"], deck: ["f0", "145036"] };
    expect(problems({ line: "145030:A:3", layout, act: { act: "travel", code: GREAT_SHIP }, expect: [zone("145036", "staging")] })).toEqual([]);
  });
});

describe("the Ship locations' Travel", () => {
  it("145031:A:2 with no Corsair enemy left the discard pile is shuffled in and the whole deck is discarded, nothing is added and the travel still happens", () => {
    const layout: Layout = { phase: "Travel", threat: [10, 10], staging: ["145031"], deck: ["f0", "f3"], discard: ["f3"] };
    expect(problems({ line: "145031:A:2", layout, act: { act: "resolve", code: "145031", timing: "travel" }, expect: [deckCount(0)] })).toEqual([]);
    const done = play(ID, { line: "145031:A:2", layout, act: { act: "resolve", code: "145031", timing: "travel" }, expect: [] }, EFFECTS, false).run.state;
    expect(done.encounterDiscard).toHaveLength(3);
    expect(Object.values(done.cards).filter((card) => card.zone === "staging").map((card) => card.code)).toEqual(["145031"]);
    // The travel itself still happens.
    expect(problems({ line: "145031:A:2", layout, act: { act: "travel", code: "145031" }, expect: [zone("145031", "activeLocation")] })).toEqual([]);
  });

  it("145032:A:2 with the discard pile empty and a Corsair enemy deep in the deck, the cards above it are discarded", () => {
    const layout: Layout = { phase: "Travel", threat: [10, 10], staging: ["145032"], deck: ["f0", "f3", "f0", "145036", "f3"] };
    const state = play(ID, { line: "145032:A:2", layout, act: { act: "travel", code: "145032" }, expect: [] }, EFFECTS, false).run.state;
    expect(hasCard(state, "145036", "staging")).toBe(true);
    expect(state.encounterDiscard).toHaveLength(3);
    expect(state.encounterDeck).toHaveLength(1);
  });
});

describe("Port of Pelargir", () => {
  // A hero with 4 damage; the instruction runs as a When Revealed frame of the hero (the heal itself is the engine's `Heal`).
  function heal(layout: Layout, instruction: Parameters<typeof pushEffectFrame>[1]["instructions"][number] | readonly Parameters<typeof pushEffectFrame>[1]["instructions"][number][], state?: ScenarioState): { state: ScenarioState; hero: string; ctx: ReduceContext } {
    const made = at(layout);
    const base = state ?? syncConstants(updateCard(made.state, made.hero, { damage: 4 }), made.ctx);
    const framed = pushEffectFrame({ ...base, window: null, mode: "stopped" }, { frame: "whenRevealed", sourceId: made.hero, actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions: Array.isArray(instruction) ? instruction : [instruction], cancel: null, blockCancel: null }, []);
    return { state: settle(framed, made.ctx, []), hero: made.hero, ctx: made.ctx };
  }

  it("145033:A:1 while the Port is in the staging area no more than 1 damage is healed from a character each round, whatever heals it", () => {
    const once = heal({ staging: ["145033"] }, { verb: "Heal", amount: 2, target: "self" });
    expect(once.state.cards[once.hero]?.damage).toBe(3);
    const twice = heal({ staging: ["145033"] }, { verb: "Heal", amount: 1, target: "self" }, once.state);
    expect(twice.state.cards[twice.hero]?.damage).toBe(3);
    // Without the Port a heal of 2 removes 2.
    expect(heal({}, { verb: "Heal", amount: 2, target: "self" }).state.cards[once.hero]?.damage).toBe(2);
  });

  it("145033:A:1 is held only while the Port is in the staging area: as the active location it holds nothing back", () => {
    const active = heal({ active: "145033" }, { verb: "Heal", amount: 2, target: "self" });
    expect(active.state.cards[active.hero]?.damage).toBe(2);
  });

  it("145033:A:1 counts the other characters apart: each has its own allowance", () => {
    const made = at({ staging: ["145033"], play: ["ally"] });
    const ally = idOf(made.state, "ally");
    const hurt = syncConstants(updateCard(updateCard(made.state, made.hero, { damage: 4 }), ally, { damage: 1 }), made.ctx);
    const first = heal({ staging: ["145033"], play: ["ally"] }, { verb: "Heal", amount: 3, target: "self" }, hurt);
    expect(first.state.cards[made.hero]?.damage).toBe(3);
    const second = heal({ staging: ["145033"], play: ["ally"] }, { verb: "Heal", amount: 1, target: "self" }, { ...first.state, cards: { ...first.state.cards } });
    expect(second.state.cards[made.hero]?.damage).toBe(3);
  });
});

describe("Corsair Captain", () => {
  it("145035:A:1 cannot be optionally engaged, while a Corsair of the same cost can", () => {
    const made = at({ phase: "Encounter", threat: [50, 50], staging: [CAPTAIN, "145036"] });
    const targets = legalTargets({ ...made.state, window: { kind: "optionalEngage" } }, { type: "Engage" }, made.ctx);
    expect(targets).toContain(idOf(made.state, "145036"));
    expect(targets).not.toContain(idOf(made.state, CAPTAIN));
  });

  it("145035:A:2 makes no immediate attack when it engages you with no Ship as the active location", () => {
    const layout: Layout = { engaged: [{ code: CAPTAIN, seat: 0 }], deck: ["f0", "f0"] };
    expect(problems({ line: "145035:A:2", layout, act: [announce("engaged", CAPTAIN), endPhase], expect: attackersOf("dh1", []) })).toEqual([]);
  });
});

describe("Fell Folk of Umbar", () => {
  it("145039:A:2 does nothing with no Corsair enemy engaged with the player and none in the deck or the discard pile", () => {
    const layout: Layout = { deck: ["f0", "f3"], discard: ["f3"] };
    const state = play(ID, { line: "145039:A:2", layout, act: { act: "reveal", code: "145039" }, expect: [] }, EFFECTS, false).run.state;
    expect(state.window?.kind).not.toBe("choose");
    expect(hasCard(state, "f0", "encounterDeck")).toBe(true);
    expect(Object.values(state.cards).filter((card) => card.zone === "engaged")).toHaveLength(0);
  });

  it("145039:A:2 the discard option is offered with a Corsair enemy in the discard pile only, the deck being reshuffled to find it", () => {
    const layout: Layout = { engaged: [{ code: "145038", seat: 0 }], deck: ["f0"], discard: ["145036"] };
    const state = play(ID, { line: "145039:A:2", layout, act: [{ act: "reveal", code: "145039" }, { act: "answer", id: "discard" }], expect: [] }, EFFECTS, false).run.state;
    expect(hasCard(state, "145036", "engaged")).toBe(true);
  });
});

describe("Driven to the Brink", () => {
  // The staging step of a quest phase, the players' characters committed, with The Corsair Fleet at 1 resource and Driven to the Brink the top card: the answers in order.
  function stagingStep(answers: readonly string[], layout: Layout = {}) {
    const made = at({ staging: [{ code: FLEET, resources: 1 }], deck: ["145042", "f0", "f0"], committed: ["dh1", "dh2"], ...layout });
    let run = start(made.state);
    run = send(run, { type: "Pass" }, made.ctx);
    const queue = [...answers];
    for (let guard = 0; guard < 12 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: queue.shift() ?? run.state.window.options[0] ?? "" }, made.ctx);
    return { run, made };
  }

  it("145042:A:2 ends the quest phase at once without resolving the quest: no progress is made and the staging area's Threat is not compared", () => {
    const { run } = stagingStep(["reveal", "end"]);
    const stage = run.state.questStage ?? "";
    expect(run.state.cards[stage]?.progress).toBe(0);
    expect(run.state.phase).toBe("Travel");
    expect(run.steps.some((step) => step.kind === "quest")).toBe(false);
    expect(run.state.seats[0]?.threat).toBe(28);
    expect(hasCard(run.state, "145042", "encounterDiscard")).toBe(true);
  });

  it("145042:A:2 offers the damage only to a player with a questing character and a Fleet with resources: with none committed the quest phase ends", () => {
    const made = at({ staging: [{ code: FLEET, resources: 1 }], deck: ["145042", "f0"] });
    let run = start(made.state);
    run = send(run, { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 12 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: "reveal" }, made.ctx);
    expect(run.state.phase).toBe("Travel");
    expect(run.state.cards[run.state.questStage ?? ""]?.progress).toBe(0);
  });
});

describe("The Corsair Fleet", () => {
  it("145071:A:1 each player in turn chooses, so the second player's option is offered after the first has resolved", () => {
    const made = at({ seats: 2, staging: [FLEET], deck: ["f3", "f0"], committed: ["dh1", "dh2", "dh3"] });
    let run = start(made.state);
    for (let guard = 0; guard < 4 && run.state.window?.kind !== "choose"; guard += 1) run = send(run, { type: "Pass" }, made.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(run.state.window?.kind === "choose" ? run.state.window.options : []).toEqual(["reveal", "damage"]);
    run = send(run, { type: "Choose", optionId: "reveal" }, made.ctx);
    expect(hasCard(run.state, "f3", "staging")).toBe(true);
    // The second seat's choice is now open, with the Fleet at 1 resource.
    expect(run.state.window?.kind === "choose" ? run.state.window.options : []).toEqual(["reveal", "damage"]);
    expect(run.state.cards[idOf(run.state, FLEET)]?.resources).toBe(1);
  });
});

describe("Attack on Pelargir", () => {
  it("145069:B:2 holds the stage back while Great Corsair Ship is in play, whatever the progress, and not when it has left", () => {
    const held = at({ staging: [GREAT_SHIP], progress: 25 });
    expect(restricted(held.state, held.ctx, "advance").length).toBeGreaterThan(0);
    const gone = at({ progress: 25 });
    expect(restricted(gone.state, gone.ctx, "advance")).toHaveLength(0);
    const active = at({ active: GREAT_SHIP, progress: 25 });
    expect(restricted(active.state, active.ctx, "advance").length).toBeGreaterThan(0);
  });

  it("145069:B:2 the players win the moment the Ship leaves play explored with 20 or more progress on the stage, and not with less", () => {
    for (const [progress, wins] of [[23, true], [20, true], [19, false]] as const) {
      const made = at({ active: GREAT_SHIP, progress, phase: "Travel" });
      const ship = idOf(made.state, GREAT_SHIP);
      const state = settle(syncConstants({ ...moveCard(made.state, ship, { zone: "victory" }), window: null, mode: "stopped" }, made.ctx), made.ctx, []);
      expect(state.stageCleared, `${progress} progress`).toBe(wins);
    }
  });
});

describe("Army of the Dead", () => {
  it("145068:A:1 is controlled by the first player, and by the other player when the first player token passes", () => {
    for (const first of [0, 1] as const) {
      const made = at({ seats: 2, firstPlayer: first, play: [{ code: "145068", seat: 0 }] });
      expect(settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []).cards[idOf(made.state, "145068")]?.controller, `first player ${first}`).toBe(first);
    }
  });
});
