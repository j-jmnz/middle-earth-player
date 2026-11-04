// Rules: rr.quest-advancement, rr.quest-cards-quest-deck, rr.winning-the-game, rr.search, rr.first-player, rr.campaign-cards
// (data/rules/entries.json). The Passage Through Mirkwood quest: the branching stage 3, the two stage 3B cards, and Mendor.
import { beforeAll, describe, expect, it } from "vitest";

import { pushCardEffects, pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { CAMPAIGN_CARD, HERO, loadMirkwoodWorld, MENDOR, mirkwoodTable, passage, type MirkwoodLayout, type MirkwoodWorld, SPAWN, SUPPORT } from "../../../../test/scenarios/passage-through-mirkwood/scene.ts";
import { codesOf } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { first, send, start } from "../../../../test/harness/scene-kit.ts";

let world: MirkwoodWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
});

function make(layout: MirkwoodLayout = {}) {
  return mirkwoodTable(world, layout);
}

// Runs an instruction as `sourceId` and lets what it started resolve; an open choice is answered with its first option.
function run(state: ScenarioState, instruction: Instruction, sourceId: string, ctx: ReduceContext, steps: EngineStep[] = []): ScenarioState {
  let next = settle({ ...runInstruction(state, instruction, { seat: 0, sourceId }, ctx, steps), window: null }, ctx, steps);
  for (let guard = 0; guard < 10 && next.window?.kind === "choose"; guard += 1) {
    const result = send({ state: next, steps }, { type: "Choose", optionId: next.window.options[0] ?? "" }, ctx);
    next = result.state;
  }
  return next;
}

// Runs instructions as an effect frame of `sourceId` (so a container verb works), and answers the choices with the first option.
function frame(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, ctx: ReduceContext, steps: EngineStep[] = []): ScenarioState {
  const pushed = pushEffectFrame(state, { frame: "ResolveEffect", sourceId, actor: 0, peril: false, effectId: "test", instructions, cancel: null, blockCancel: null }, steps);
  let next = settle({ ...pushed, window: null }, ctx, steps);
  for (let guard = 0; guard < 10 && next.window?.kind === "choose"; guard += 1) next = send({ state: next, steps }, { type: "Choose", optionId: next.window.options[0] ?? "" }, ctx).state;
  return next;
}

const KILL_SPAWN: Instruction = { verb: "Each", pick: { type: "enemy", control: "any", names: ["Ungoliant's Spawn"], staging: true }, instructions: [{ verb: "DamageCard", amount: 99, target: "picked" }] };
const KILL_MENDOR: Instruction = { verb: "Each", pick: { type: "character", control: "any", names: ["Mendor"] }, instructions: [{ verb: "DamageCard", amount: 99, target: "picked" }] };

function codeAt(state: ScenarioState): string {
  return state.cards[state.questStage ?? ""]?.code ?? "";
}

describe("the quest stages", () => {
  it("stage 1 holds a Forest Spider and an Old Forest Road for the staging area, and the stage 2 branch names both stage 3 cards (01119:A:1, 01120:B:1)", () => {
    expect(passage.stages).toEqual(["01119", "01120", "01121", "01122"]);
    const stages = world.definition.stages;
    expect(stages.map((stage) => stage.branch)).toEqual([undefined, ["01121", "01122"], undefined, undefined]);
    expect(passage.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual(["01096", "01099"]);
  });

  it("defeating stage 2 proceeds to one of the two stage 3 cards at random and removes the other from the game (01120:B:1)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const { state, ctx, hero } = make({ stage: "01120", progress: 1, seed });
      const steps: EngineStep[] = [];
      const after = run(state, { verb: "PlaceQuestProgress", perPlayer: 1 }, hero, ctx, steps);
      const chosen = codeAt(after);
      expect(["01121", "01122"]).toContain(chosen);
      seen.add(chosen);
      const other = chosen === "01121" ? "01122" : "01121";
      expect(after.cards[first(after, other)]?.zone).toBe("removed");
      expect(after.questDeck.map((id) => after.cards[id]?.code)).toEqual([]);
      expect(after.stagesReached).toEqual([chosen]);
      expect(after.cards[first(after, "01120")]?.zone).toBe("setAside");
      expect(causeProblems(steps)).toEqual([]);
      // The same seed chooses the same stage again.
      expect(codeAt(run(state, { verb: "PlaceQuestProgress", perPlayer: 1 }, hero, ctx))).toBe(chosen);
    }
    expect([...seen].sort()).toEqual(["01121", "01122"]);
  });

  it("records every stage the quest reaches, and a quest that does not branch records none", () => {
    const { state, ctx, hero } = make({ stage: "01119", progress: 7, seed: 1 });
    const second = run(state, { verb: "PlaceQuestProgress", perPlayer: 1 }, hero, ctx);
    expect(codeAt(second)).toBe("01120");
    expect(second.stagesReached).toEqual(["01120"]);
    const third = run(updateCard(second, first(second, "01120"), { progress: 1 }), { verb: "PlaceQuestProgress", perPlayer: 1 }, hero, ctx);
    expect(third.stagesReached).toHaveLength(2);
    expect(third.stagesReached?.[0]).toBe("01120");
  });

  it("stage 3B 'Don't Leave the Path!' has each player add a Spider from the encounter deck or discard pile to the staging area (01121:B:1)", () => {
    const { state, ctx } = make({ seats: 2, stage: "01121", deck: ["f0", "01096", "f0"], discard: ["01074", "01074"] });
    const effects = ctx.effects.filter((effect) => effect.cardCode === "01121" && effect.timing === "whenRevealed");
    const steps: EngineStep[] = [];
    const pushed = pushCardEffects(state, "whenRevealed", first(state, "01121"), 0, false, effects, ctx, steps);
    let next = settle({ ...pushed, window: null }, ctx, steps);
    for (let guard = 0; guard < 6 && next.window?.kind === "choose"; guard += 1) next = send({ state: next, steps }, { type: "Choose", optionId: next.window.options[0] ?? "" }, ctx).state;
    expect(codesOf(next, next.staging).sort()).toEqual(["01074", "01096"]);
  });

  it("stage 3B 'Don't Leave the Path!' prints 0 quest points and cannot be advanced, and defeating Ungoliant's Spawn wins the game (01121:B:2)", () => {
    const { state, ctx, hero } = make({ stage: "01121", staging: [SPAWN, "f0"] });
    const progressed = run(state, { verb: "PlaceQuestProgress", perPlayer: 3 }, hero, ctx);
    expect(codeAt(progressed)).toBe("01121");
    expect(progressed.stageCleared).toBe(false);
    expect(progressed.cards[progressed.questStage ?? ""]?.progress).toBe(3);
    // Another enemy's defeat is nothing; the Spawn's wins.
    const other = frame(progressed, [{ verb: "Each", pick: { type: "enemy", control: "any", names: ["f0"], staging: true }, instructions: [{ verb: "DamageCard", amount: 99, target: "picked" }] }], hero, ctx);
    expect(other.stageCleared).toBe(false);
    const won = frame(progressed, [KILL_SPAWN], hero, ctx);
    expect(won.cards[first(progressed, SPAWN)]?.zone).not.toBe("staging");
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBe(false);
  });

  it("stage 3B 'Beorn's Path' cannot be defeated while Ungoliant's Spawn is in play, and defeating it wins the game (01122:B:1)", () => {
    const blocked = make({ stage: "01122", progress: 9, staging: [SPAWN] });
    const stuck = run(blocked.state, { verb: "PlaceQuestProgress", perPlayer: 1 }, blocked.hero, blocked.ctx);
    expect(stuck.stageCleared).toBe(false);
    expect(codeAt(stuck)).toBe("01122");
    // Engaged is in play as well.
    const engaged = make({ stage: "01122", progress: 9, engaged: [{ code: SPAWN, seat: 0 }] });
    expect(run(engaged.state, { verb: "PlaceQuestProgress", perPlayer: 1 }, engaged.hero, engaged.ctx).stageCleared).toBe(false);
    const free = make({ stage: "01122", progress: 9, deck: [SPAWN] });
    const won = run(free.state, { verb: "PlaceQuestProgress", perPlayer: 1 }, free.hero, free.ctx);
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBe(false);
    expect(won.stagesReached).toBeUndefined();
  });
});

describe("Mendor (01135) in Campaign Mode", () => {
  it("is put into play under the first player by 01129's Setup, and the first player controls him (01129:A:2, 01135:A:2)", () => {
    const { state, ctx } = make({ seats: 2, campaign: true });
    const mendor = first(state, MENDOR);
    expect(state.cards[mendor]?.zone).toBe("play");
    expect(state.cards[mendor]?.controller).toBe(0);
    // The token passes: the new first player gains control of Mendor.
    const passed = settle({ ...state, firstPlayer: 1 }, ctx, []);
    expect(passed.cards[mendor]?.controller).toBe(1);
  });

  it("losing Mendor loses the game (01129:A:3), and in the standalone game there is nothing to lose", () => {
    const { state, ctx, hero } = make({ campaign: true });
    const mendor = first(state, MENDOR);
    const killed = frame(state, [KILL_MENDOR], hero, ctx);
    expect(killed.cards[mendor]?.zone).not.toBe("play");
    expect(killed.lost).toBe(true);
    const standalone = mirkwoodTable(world, {});
    expect(Object.values(standalone.state.cards).some((card) => card.code === MENDOR || card.code === CAMPAIGN_CARD)).toBe(false);
  });

  it("readies and draws a card for each player after a quest card is defeated (01135:A:3)", () => {
    const made = make({ seats: 2, stage: "01119", progress: 7, campaign: true, playerDeck: ["filler", "filler"] });
    const mendor = first(made.state, MENDOR);
    const tired = updateCard(made.state, mendor, { exhausted: true });
    const seat2 = updateCard(tired, first(tired, "filler"), {});
    const steps: EngineStep[] = [];
    let state = settle({ ...runInstruction(seat2, { verb: "PlaceQuestProgress", perPlayer: 1 }, { seat: 0, sourceId: made.hero }, made.ctx, steps), window: null }, made.ctx, steps);
    expect(codeAt(state)).toBe("01120");
    // The Response is the first player's to use.
    const offer = legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === mendor);
    expect(offer).toBeDefined();
    const before = state.seats[0].hand.length;
    state = send({ state, steps }, offer as Parameters<typeof send>[1], made.ctx).state;
    expect(state.cards[mendor]?.exhausted).toBe(false);
    expect(state.seats[0].hand.length).toBe(before + 1);
  });

  it("is removed from the game when he leaves play (01135:A:4)", () => {
    const made = make({ campaign: true });
    const mendor = first(made.state, MENDOR);
    // Lose the campaign card's loss to see the card's own line: without 01129 in the game he leaves play and is removed.
    const without = { ...made.state, cards: { ...made.state.cards } };
    delete (without.cards as Record<string, unknown>)[first(made.state, CAMPAIGN_CARD)];
    const killed = frame(without, [KILL_MENDOR], made.hero, made.ctx);
    expect(killed.lost).toBe(false);
    expect(killed.cards[mendor]?.zone).toBe("removed");
  });
});

describe("Mendor's Support (01132)", () => {
  it("gives Mendor +2 Willpower, Attack and Defense until the end of the round (01132:A:2), one copy a round (01132:A:1)", () => {
    const made = make({ campaign: true, hand: [SUPPORT, SUPPORT] });
    const mendor = first(made.state, MENDOR);
    const base = ["willpower", "attack", "defense"].map((stat) => modifiedStat(made.state, made.state.cards[mendor]!, stat as "willpower", made.ctx.cards));
    const plays = legalIntents(made.state, made.ctx).filter((intent) => intent.type === "PlayCard");
    expect(plays.length).toBeGreaterThan(0);
    const played = send(start(made.state), { ...(plays[0] as { type: "PlayCard"; cardId: string }), payments: [] }, made.ctx);
    const boosted = ["willpower", "attack", "defense"].map((stat) => modifiedStat(played.state, played.state.cards[mendor]!, stat as "willpower", made.ctx.cards));
    expect(boosted).toEqual(base.map((value) => value + 2));
    // The second copy cannot be played this round.
    expect(legalIntents(played.state, made.ctx).some((intent) => intent.type === "PlayCard" && played.state.cards[intent.cardId]?.code === SUPPORT)).toBe(false);
  });

  it("has no Mendor to choose in a game without him", () => {
    const made = make({ hand: [SUPPORT], allies: ["ally"] });
    const hero = first(made.state, HERO);
    expect(hero).toBeTruthy();
    const run1 = legalIntents(made.state, made.ctx).filter((intent) => intent.type === "PlayCard");
    // The event may be played (it is free), but no character gains anything.
    if (run1[0]) {
      const played = send(start(made.state), { ...(run1[0] as { type: "PlayCard"; cardId: string }), payments: [] }, made.ctx);
      expect(modifiedStat(played.state, played.state.cards[first(played.state, "ally")]!, "willpower", made.ctx.cards)).toBe(1);
    }
  });
});

