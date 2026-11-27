// Rules: rr.action, rr.guarded, rr.objective-cards, rr.forced, rr.cancel, hrd.stage-number, mec108.side-quests-in-play, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 17091:A:3, 17092:A:3, 17093:A:2, 17093:A:3, 17094:A:2, 17096:A:1, 17097:A:1, 17100:A:2, 17102:A:2, 17103:A:1, 17104:A:1, 17106:B:2, 17107:B:3, 17108:B:3.
// The Black Serpent's lines that a card-spec row cannot say (spec.test.ts): who may use an objective's Action, the stage's gate with an objective an encounter card guards, the caps and bars on quest cards with a side quest current, a card really played from a hand.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { addModifier } from "../../../rules/core/modified-stat.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { guardWith } from "../../../rules/families/objectives/guard.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { placeOnMainQuest, placeQuestProgress } from "../../../rules/quest/quest.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { finish, idOf, legalIntents, opened, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const BANNER = "17091";
const GARB = "17092";
const SUMMONS = "17093";
const SERPENT = "17094";
const GUARD = "17095";
const REDOUBT = "17096";
const TOWER = "17097";
const COURTYARD = "17100";
const SIDE_QUEST = "17104";
const STAGE_1 = "17106";
const STAGE_2 = "17107";
const STAGE_3 = "17108";

const table = (layout: Layout = {}, extra: readonly string[] = []) => tableFromLayout("the-black-serpent", { seats: 1, ...layout }, { effects: EFFECTS, extra });

/** The objective lies attached to the hero, claimed, as the stage's claim line leaves it. */
function held(state: ScenarioState, code: string, heroId: string): ScenarioState {
  const id = idOf(state, code);
  return updateCard(attachTo(moveCard(state, id, { zone: "attached" }), id, heroId), id, { face: "up", controller: state.cards[heroId]?.controller ?? 0, claimed: true });
}

/** The side quest in the staging area is the current quest until the end of the phase. */
const sideQuestCurrent = (state: ScenarioState): ScenarioState => addModifier(state, idOf(state, SIDE_QUEST), idOf(state, SIDE_QUEST), "currentQuest", 1, "endOfPhase");

const triggersOf = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], code: string, seat = 0) => legalIntents({ ...state, activeSeat: seat }, ctx).filter((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, code));

describe("17091:A:3 17092:A:3 17093:A:3 the Action of a Harad objective is used only by the player whose hero holds it", () => {
  const holders = [
    { code: BANNER, layout: { engaged: [GUARD] }, why: "a Harad enemy is engaged with the player" },
    { code: GARB, layout: { staging: [GUARD] }, why: "a Harad enemy is in the staging area" },
    { code: SUMMONS, layout: {}, why: "the objective lies on the hero" },
  ] as const;

  for (const { code, layout, why } of holders) {
    it(`${code}:A:3 is offered to the controller of the hero that holds it while ${why}`, () => {
      const made = table({ ...layout, staging: [code, ...(("staging" in layout ? layout.staging : []) as readonly string[])] });
      const state = opened(made, held(made.state, code, made.hero)).state;
      expect(triggersOf(state, made.ctx, code)).toHaveLength(1);
    });

    it(`${code}:A:3 is not offered while the objective lies in the staging area, is guarded or hangs on an encounter card`, () => {
      const made = table({ ...layout, staging: [code, GUARD, ...(("staging" in layout ? layout.staging : []) as readonly string[])] });
      const free = opened(made).state;
      expect(triggersOf(free, made.ctx, code)).toHaveLength(0);
      const guarded = opened(made, guardWith(made.state, idOf(made.state, GUARD), idOf(made.state, code))).state;
      expect(triggersOf(guarded, made.ctx, code)).toHaveLength(0);
    });

    it(`${code}:A:3 is not offered to the other player while a hero of the first player holds it`, () => {
      const made = table({ ...layout, seats: 2, staging: [code, ...(("staging" in layout ? layout.staging : []) as readonly string[])] });
      const state = opened(made, held(made.state, code, made.hero)).state;
      expect(triggersOf(state, made.ctx, code, 0)).toHaveLength(1);
      expect(triggersOf(state, made.ctx, code, 1)).toHaveLength(0);
    });
  }

  it("17091:A:3 is not offered while no Harad enemy is engaged with the player, and an enemy engaged with the other player does not count", () => {
    const made = table({ seats: 2, staging: [BANNER], engaged: [{ code: GUARD, seat: 1 }] });
    const state = opened(made, held(made.state, BANNER, made.hero)).state;
    expect(triggersOf(state, made.ctx, BANNER, 0)).toHaveLength(0);
    expect(triggersOf(state, made.ctx, BANNER, 1)).toHaveLength(0);
  });

  it("17092:A:3 is not offered while no Harad enemy is in the staging area (an engaged one is not there)", () => {
    const made = table({ staging: [GARB], engaged: [GUARD] });
    const state = opened(made, held(made.state, GARB, made.hero)).state;
    expect(triggersOf(state, made.ctx, GARB)).toHaveLength(0);
  });

  it("17091:A:3 the Trigger exhausts the objective, raises the player's threat by 1 and takes 1 Attack from each Harad enemy engaged with him", () => {
    const made = table({ staging: [BANNER], engaged: [GUARD] });
    const state = opened(made, held(made.state, BANNER, made.hero)).state;
    const [intent] = triggersOf(state, made.ctx, BANNER);
    const run = finish(send(opened(made, state), { ...intent!, payments: [] } as never, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, BANNER)]?.exhausted).toBe(true);
    expect(run.state.seats[0]?.threat).toBe(29);
    expect(modifiedStat(run.state, run.state.cards[idOf(run.state, GUARD)]!, "attack", made.ctx.cards)).toBe(2);
  });
});

describe("17093:A:2 while attached to an encounter card no player's threat can be reduced", () => {
  it("holds while an encounter card guards the objective in the staging area, and stops when a hero holds it", () => {
    const made = table({ staging: [SUMMONS, "place"] });
    const guarded = opened(made, guardWith(made.state, idOf(made.state, "place"), idOf(made.state, SUMMONS))).state;
    expect(flagged(guarded, "seat:0", "threatReductionBarred")).toBe(true);
    const claimedState = opened(made, held(made.state, SUMMONS, made.hero)).state;
    expect(flagged(claimedState, "seat:0", "threatReductionBarred")).toBe(false);
  });
});

describe("17106:B:2 17107:B:3 17108:B:3 the stage cannot be defeated while a Harad objective in play is not on a hero", () => {
  for (const stage of [STAGE_1, STAGE_2, STAGE_3]) {
    it(`${stage} #in-play: an objective guarded in the staging area bars the stage, one on a hero does not`, () => {
      const made = table({ stage, staging: [SUMMONS, "place"] });
      const guarded = opened(made, guardWith(made.state, idOf(made.state, "place"), idOf(made.state, SUMMONS)));
      expect(restricted(guarded.state, made.ctx, "advance")).not.toHaveLength(0);
      const claimedRun = opened(made, held(made.state, SUMMONS, made.hero));
      expect(restricted(claimedRun.state, made.ctx, "advance")).toHaveLength(0);
    });
  }

  it("17108:B:3 an objective hanging on The Black Serpent in the staging area bars the stage", () => {
    const made = table({ stage: STAGE_3, staging: [SERPENT], attached: [{ code: SUMMONS, to: SERPENT, encounter: true }] });
    expect(restricted(opened(made).state, made.ctx, "advance")).not.toHaveLength(0);
  });
});

describe("17100:A:2 the main quest holds no more progress than its printed quest points while Broken Courtyard is in the staging area", () => {
  const withSideQuest = () => {
    const made = table({ progress: 5, staging: [COURTYARD, SIDE_QUEST] });
    const stage = idOf(made.state, STAGE_1);
    const state = opened(made, sideQuestCurrent(made.state)).state;
    return { made, state, stage };
  };

  it("17100:A:2 #printed: stops at 6 with a side quest the current quest, though an effect gave the stage quest points", () => {
    const { made, state, stage } = withSideQuest();
    const gave = addModifier(state, stage, stage, "questPoints", 3, "endOfGame");
    expect(modifiedStat(gave, gave.cards[stage]!, "questPoints", made.ctx.cards)).toBe(9);
    const placed = placeOnMainQuest(gave, 4, made.ctx.cards, [] as EngineStep[], () => false);
    expect(placed.cards[stage]?.progress).toBe(6);
  });

  it("17100:A:2 puts all the progress on without the card in the staging area", () => {
    const made = table({ progress: 5, staging: [SIDE_QUEST] });
    const stage = idOf(made.state, STAGE_1);
    const state = opened(made, sideQuestCurrent(made.state)).state;
    expect(placeOnMainQuest(state, 4, made.ctx.cards, [] as EngineStep[], () => false).cards[stage]?.progress).toBe(9);
  });
});

describe("17103:A:1 progress cannot be placed on quest cards until the end of the round", () => {
  it("bars the main quest and a side quest that is the current quest, and the main quest while a side quest is current", () => {
    const made = table({ progress: 2, staging: [SIDE_QUEST, "place"] });
    const stage = idOf(made.state, STAGE_1);
    const side = idOf(made.state, SIDE_QUEST);
    const barred = resolveRecords(made.state, made.ctx, "17103", "whenRevealed", undefined, () => "noProgress");
    const none = (state: ScenarioState) => placeQuestProgress(state, 3, made.ctx.cards, [] as EngineStep[], () => false);
    expect(none(barred.state).cards[stage]?.progress).toBe(2);
    const sideCurrent = sideQuestCurrent(barred.state);
    const onSide = none(sideCurrent);
    expect(onSide.cards[side]?.progress).toBe(0);
    expect(onSide.cards[stage]?.progress).toBe(2);
    expect(placeOnMainQuest(sideCurrent, 3, made.ctx.cards, [] as EngineStep[], () => false).cards[stage]?.progress).toBe(2);
    const open = sideQuestCurrent(made.state);
    expect(none(open).cards[side]?.progress).toBe(3);
  });
});

describe("17104:A:1 Forced: at the end of the round all progress comes off the main quest, current quest or not", () => {
  it("the side quest in the staging area, also while it is the current quest, discards the main quest's progress", () => {
    for (const current of [false, true]) {
      const made = table({ progress: 4, staging: [SIDE_QUEST] });
      const base = current ? sideQuestCurrent(made.state) : made.state;
      const steps: EngineStep[] = [];
      const state = finish({ state: settle(fireForced({ ...opened(made, base).state, window: null }, { trigger: "endOfRound", seat: 0 }, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
      expect(state.cards[idOf(state, STAGE_1)]?.progress).toBe(0);
    }
  });
});

describe("17094:A:2 X is the stage number of the main quest, also while a side quest is the current quest", () => {
  it("at stage 2 the Black Serpent gets +2 Attack with the side quest current", () => {
    const made = table({ stage: STAGE_2, staging: [SERPENT, SIDE_QUEST] });
    const state = opened(made, sideQuestCurrent(made.state)).state;
    expect(modifiedStat(state, state.cards[idOf(state, SERPENT)]!, "attack", made.ctx.cards)).toBe(2 + 2);
  });
});

describe("17096:A:1 17097:A:1 the Forced effects a location in the staging area gains hear a card played from a hand", () => {
  const playFromHand = (made: ReturnType<typeof table>, code: string, answerWith: string, cost = 1) => {
    const hand = made.state.seats[0]?.hand.find((id) => made.state.cards[id]?.code === code) ?? "";
    const intent = legalIntents(opened(made).state, made.ctx).find((offered) => offered.type === "PlayCard" && offered.cardId === hand);
    expect(intent, `${code} can be played`).toBeDefined();
    const sent = send(opened(made), { ...intent!, payments: cost > 0 ? [{ heroId: made.hero, amount: cost }] : [] } as never, made.ctx);
    return finish(sent, made.ctx, () => answerWith);
  };

  it("17096:A:1 an ally played from hand: the player removes 1 progress or exhausts it", () => {
    const options = ["progress", "exhaust"] as const;
    const results = options.map((option) => {
      const made = table({ phase: "Planning", progress: 3, staging: [REDOUBT], hand: ["ally"], heroResources: 1 });
      const run = playFromHand(made, "ally", option);
      return { progress: run.state.cards[idOf(run.state, STAGE_1)]?.progress, exhausted: run.state.cards[idOf(run.state, "ally")]?.exhausted === true };
    });
    expect(results).toEqual([{ progress: 2, exhausted: false }, { progress: 3, exhausted: true }]);
  });

  it("17096:A:1 an ally that enters play by another effect is not played: nothing is asked", () => {
    const made = table({ progress: 3, staging: [REDOUBT], play: ["ally"] });
    const steps: EngineStep[] = [];
    const state = settle(fireForced({ ...opened(made).state, window: null }, { trigger: "enteredPlay", seat: 0, cardId: idOf(made.state, "ally") }, made.ctx, steps), made.ctx, steps);
    expect(state.window?.kind).not.toBe("choose");
    expect(state.cards[idOf(state, STAGE_1)]?.progress).toBe(3);
  });

  // Deep Knowledge (07012, a lore event of cost 0, so Beravor 01012 is in play): "Action: Each player draws 2 cards."
  it("17097:A:1 an event played: the player cancels its effects (the event is still played) or removes 1 progress and its effects resolve", () => {
    const results = ["cancel", "progress"].map((option) => {
      const made = table({ phase: "Planning", progress: 3, staging: [TOWER], hand: ["07012"], heroes: ["01012"], deckOf: ["filler", "filler", "filler"] }, ["07012", "01012"]);
      const run = playFromHand(made, "07012", option, 0);
      return { hand: run.state.seats[0]?.hand.length, progress: run.state.cards[idOf(run.state, STAGE_1)]?.progress, zone: run.state.cards[idOf(run.state, "07012")]?.zone };
    });
    expect(results).toEqual([{ hand: 0, progress: 3, zone: "discard" }, { hand: 2, progress: 2, zone: "discard" }]);
  });
});

describe("17095:A:2 the shadow's second option: the attacking enemy cannot take damage this round", () => {
  it("sets the flag on the attacker the shadow's effect names (the attack that runs it)", () => {
    const made = table({ progress: 4, engaged: ["f0"], staging: [GUARD] });
    const attacker = idOf(made.state, "f0");
    const run = resolveRecords({ ...made.state, pendingAttack: { enemyId: attacker, seat: 0 } }, made.ctx, "17095", "shadow", undefined, () => "noDamage");
    expect(flagged(run.state, attacker, "cannotTakeDamage")).toBe(true);
    expect(run.state.cards[idOf(run.state, STAGE_1)]?.progress).toBe(4);
  });
});

describe("17092:A:1 17093:A:1 a Harad objective a hero holds that leaves play returns to the staging area", () => {
  it("the Garb goes back to the staging area, faceup, when its hero is discarded", () => {
    const made = table({ staging: [GARB] });
    const state = held(made.state, GARB, made.hero);
    const gone = moveCard(state, made.hero, { zone: "discard", seat: 0 });
    expect(gone.cards[idOf(gone, GARB)]).toMatchObject({ zone: "staging", face: "up" });
  });
});

describe("17096:A:2 Travel: the first player searches, whoever travels", () => {
  it("the choice of the enemy is the first player's when the other player's travel resolves it", () => {
    const made = table({ seats: 2, staging: [REDOUBT], deck: ["f0", "f3"] });
    const askedOf: unknown[] = [];
    resolveRecords(made.state, made.ctx, REDOUBT, "travel", undefined, (state) => {
      askedOf.push(state.window && "seat" in state.window ? state.window.seat : null);
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    }, true, 1);
    expect(askedOf).toEqual([0]);
  });
});
