// Rules: ats.hidden-cards, rr.running-out-of-cards, rr.travel, rr.shadow-effects, rr.defending-player, rr.forced, rr.engaged, faq.blood-of-gondor-hidden-cards (data/rules/entries.json); ledger lines 06117:B:1, 06117:B:2, 06118:B:2, 06122:A:1, 06122:A:2, 06123:A:3, 06124:A:1, 06125:A:2, 06126:A:1, 06127:A:2, 06130:A:2, 06131:A:2.
// Every way a hidden card is taken, each with the encounter deck full, with the deck empty (the discard pile is shuffled into it first) and with both piles empty (no card is taken, and a Travel cost that needs one is not offered): the beginning of the quest phase, the combat choice, a Travel cost, a Shadow
// card, a Forced effect and a When Revealed. Each moment is the real one: the phase starts, the player travels, the enemy attacks, the enemy engages, the card is revealed.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { idOf, legalTargets, resolveRecords, send } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, drive, hiddenCodes, opened, table } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { crow, rabble, looms, captured, southern, western, northern, eastern, crossroads, conflict } = CODES;
const ARAGORN = "01001";

/** The three states of the encounter piles: cards to take, an empty deck with the discard pile full, and both empty. */
type Piles = { deck: string[]; discard: string[] };
const FULL: Piles = { deck: ["f0", "f0", "f0", "f0", "f0", "f0"], discard: [] };
const REFILLED: Piles = { deck: [], discard: ["f0", "f0", "f0", "f0"] };
const EMPTY: Piles = { deck: [], discard: [] };
const count = (state: ScenarioState, seat?: number): number => hiddenCodes(state, seat).length;

/** The beginning of the quest phase of `stage`: each seat takes a card (stage 1 and stage 2 print the same line). */
function atQuest(effects: readonly Effect[], piles: Piles, stage: string = CODES.ambush): ScenarioState {
  const made = table({ seats: 2, phase: "Planning", stage, ...piles }, effects);
  return drive(made, opened(made), (state) => state.phase === "Quest" && state.mode !== "planning").state;
}

const QUEST_TAKES = "each player takes 1 hidden card at the beginning of the quest phase; with an empty deck the discard pile is shuffled in first, and with both piles empty none is taken";
const questTakes = (stage: string) =>
  (effects: readonly Effect[]): void => {
    const full = atQuest(effects, FULL, stage);
    expect([count(full, 0), count(full, 1)]).toEqual([1, 1]);
    const refilled = atQuest(effects, REFILLED, stage);
    expect([count(refilled, 0), count(refilled, 1)]).toEqual([1, 1]);
    expect(refilled.encounterDiscard).toHaveLength(0);
    expect(refilled.encounterDeck).toHaveLength(2);
    expect(count(atQuest(effects, EMPTY, stage))).toBe(0);
  };
lineSpec("06117:B:1", QUEST_TAKES, questTakes(CODES.ambush));
lineSpec("06118:B:2", QUEST_TAKES, questTakes(captured));

lineSpec("06117:B:2", "a player who chooses to take instead of turning takes 1 hidden card, from the discard pile when the deck is empty, and none with both piles empty", (effects) => {
  const choose = (piles: Piles): ScenarioState => {
    const made = table({ phase: "Encounter", ...piles }, effects);
    const at = drive(made, opened(made), (state) => state.window?.kind === "choose");
    expect(at.state.window).toMatchObject({ kind: "choose", options: ["turn", "take"] });
    return send(at, { type: "Choose", optionId: "take" }, made.ctx).state;
  };
  expect(count(choose(FULL))).toBe(1);
  const refilled = choose(REFILLED);
  expect(count(refilled)).toBe(1);
  expect(refilled.encounterDiscard).toHaveLength(0);
  expect(count(choose(EMPTY))).toBe(0);
});

/** A Travel cost of `cost` hidden cards, taken by the first player (seat 1 of two): paid in full before the travel, and not offered when the piles hold fewer. */
const travelTitle = (cost: number): string => `Travel: the first player takes ${cost} hidden card${cost > 1 ? "s" : ""} to travel here; with an empty deck the discard pile is shuffled in, and with both piles empty the players cannot travel here`;
const travels = (code: string, cost: number) =>
  (effects: readonly Effect[]): void => {
    const at = (piles: Piles) => {
      const made = table({ seats: 2, firstPlayer: 1, phase: "Travel", staging: [code], ...piles }, effects);
      return { made, can: legalTargets(opened(made).state, { type: "Travel" }, made.ctx).includes(idOf(made.state, code)) };
    };
    const go = (piles: Piles): ScenarioState => {
      const { made } = at(piles);
      return send(opened(made), { type: "Travel", locationId: idOf(made.state, code) }, made.ctx).state;
    };
    for (const piles of [FULL, REFILLED]) {
      expect(at(piles).can).toBe(true);
      const done = go(piles);
      expect([count(done, 1), count(done, 0)]).toEqual([cost, 0]);
      expect(done.activeLocation).toBe(idOf(done, code));
    }
    expect(at(EMPTY).can).toBe(false);
    expect(at({ deck: ["f0"], discard: [] }).can).toBe(cost === 1);
  };
lineSpec("06123:A:3", travelTitle(1), travels(crossroads, 1));
lineSpec("06124:A:1", travelTitle(1), travels(southern, 1));
lineSpec("06125:A:2", travelTitle(1), travels(western, 1));
lineSpec("06126:A:1", travelTitle(1), travels(northern, 1));
lineSpec("06127:A:2", travelTitle(2), travels(eastern, 2));

/** The attack of Orc Rabble on seat 0 with `shadow` dealt to it and seat 1's Sentinel hero Aragorn defending: the defending player (seat 0) takes the card. */
const SHADOW_TAKES = "Shadow: the defending player takes 1 hidden card, not the Sentinel's controller; with an empty deck the discard pile is shuffled in, and with both piles empty none is taken";
const shadowTakes = (shadow: string) =>
  (effects: readonly Effect[]): void => {
    const fight = (rest: Piles): ScenarioState => {
      const made = table({ seats: 2, phase: "Encounter", heroes: [{ code: ARAGORN, seat: 1 }], engaged: [{ code: rabble, seat: 0 }], deck: [shadow, ...rest.deck], discard: rest.discard }, effects, [ARAGORN]);
      const hit = drive(made, opened(made), (state) => state.window?.kind === "defense");
      return drive(made, send(hit, { type: "DeclareDefender", defenderId: idOf(hit.state, ARAGORN) }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat").state;
    };
    const full = fight({ deck: ["f0", "f0", "f0"], discard: [] });
    expect([count(full, 0), count(full, 1)]).toEqual([1, 0]);
    const refilled = fight(REFILLED);
    expect([count(refilled, 0), count(refilled, 1)]).toEqual([1, 0]);
    expect(refilled.encounterDeck).toHaveLength(3);
    expect(count(fight(EMPTY))).toBe(0);
  };
lineSpec("06122:A:2", SHADOW_TAKES, shadowTakes(crow));
lineSpec("06131:A:2", SHADOW_TAKES, shadowTakes(conflict));

lineSpec("06122:A:1", "Forced: when Evil Crow engages a player that player takes 1 hidden card; with an empty deck the discard pile is shuffled in, and with both piles empty none is taken", (effects) => {
  const engage = (piles: Piles): ScenarioState => {
    const made = table({ seats: 2, phase: "Encounter", staging: [crow], ...piles }, effects);
    return send(opened(made), { type: "Engage", enemyId: idOf(made.state, crow) }, made.ctx).state;
  };
  const full = engage(FULL);
  expect(full.seats[0]?.engaged).toContain(idOf(full, crow));
  expect([count(full, 0), count(full, 1)]).toEqual([1, 0]);
  expect(count(engage(REFILLED), 0)).toBe(1);
  expect(count(engage(EMPTY))).toBe(0);
});

lineSpec("06130:A:2", "When Revealed: each player takes 1 hidden card; with an empty deck the discard pile is shuffled in, and with both piles empty none is taken", (effects) => {
  const reveal = (piles: Piles): ScenarioState => {
    const made = table({ seats: 2, phase: "Quest", ...piles }, effects);
    return resolveRecords(made.state, made.ctx, looms, "whenRevealed").state;
  };
  const full = reveal({ deck: ["f0", "f0", "f0", "f0", "f0", "f0"], discard: [] });
  expect([count(full, 0), count(full, 1)]).toEqual([1, 1]);
  const refilled = reveal(REFILLED);
  expect([count(refilled, 0), count(refilled, 1)]).toEqual([1, 1]);
  expect(count(reveal(EMPTY))).toBe(0);
});
