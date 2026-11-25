// Test helpers for the Blood of Gondor tests (src/rules/families/pelargir/hidden.test.ts, src/campaign/scenarios/the-blood-of-gondor/): a table of the scenario, the hidden cards taken by the engine's own verb, a game driven through its windows.
import type { Effect } from "../../../src/catalog/boundary.ts";
import { UNATTRIBUTED } from "../../../src/rules/core/cause.ts";
import { placeDamage } from "../../../src/rules/core/keywords.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import type { PlayerIntent } from "../../../src/rules/engine/reduce.ts";
import { hiddenIds } from "../../../src/rules/families/pelargir/hidden.ts";

import { engagedCodes, idOf, legalIntents, opened, PASSING, run, send, tableFromLayout, where, type Layout, type LayoutTable, type Run } from "../../harness/scene-kit.ts";

export const SCENARIO = "the-blood-of-gondor";
export const CODES = {
  ambush: "06117",
  captured: "06118",
  numenorean: "06119",
  ambusher: "06120",
  uruk: "06121",
  crow: "06122",
  crossroads: "06123",
  southern: "06124",
  western: "06125",
  northern: "06126",
  eastern: "06127",
  darkWoods: "06128",
  lyingInWait: "06129",
  looms: "06130",
  conflict: "06131",
  faramir: "06132",
  alcaron: "06133",
  rabble: "05062",
  arsonist: "05063",
  scourge: "05064",
} as const;

/** A real hero with Willpower 1, Attack 3, Defense 2 (the stand-in heroes count 2 of each), so the stat a quest counts shows in the total. */
export const BOROMIR = "05002";

/** A table of the scenario on stage 1 unless the layout names a stage; `effects` are the records it runs (every authored one by default). */
export const table = (layout: Layout, effects?: readonly Effect[], extra?: readonly string[]): LayoutTable =>
  tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? CODES.ambush }, { ...(effects ? { effects } : {}), ...(extra ? { extra } : {}) });

export { engagedCodes, opened, run, where };

/** The seat takes `amount` hidden cards, by the family's own verb: the top cards of the encounter deck. */
export const takes = (made: LayoutTable, state: ScenarioState, seat: number, amount = 1): ScenarioState => run(made, state, { verb: "TakeHiddenCard", amount }, { seat });

/** The codes of a seat's hidden cards, the card taken first first (every seat with none named). */
export const hiddenCodes = (state: ScenarioState, seat?: number): string[] => hiddenIds(state, seat).map((id) => state.cards[id]?.code ?? "");

/** The id of the first card with this code, whatever its zone. */
export const idByCode = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";

/** The game goes on until `stop` holds: every window is passed, a choice takes its first option (or the one `choose` names), an enemy to attack is the first offered. */
export function drive(made: LayoutTable, from: Run, stop: (state: ScenarioState) => boolean, choose: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Run {
  let current = from;
  for (let guard = 0; guard < 400 && !stop(current.state) && !current.state.lost && !current.state.stageCleared; guard += 1) {
    const state = current.state;
    if (state.window?.kind === "choose") {
      current = send(current, { type: "Choose", optionId: choose(state) }, made.ctx);
      continue;
    }
    if (state.window?.kind === "chooseEnemy") {
      current = send(current, { type: "ChooseEnemy", enemyId: state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    const intents = legalIntents(state, made.ctx);
    const pass = PASSING.map((type) => intents.find((intent) => intent.type === type)).find((intent) => intent != null);
    if (!pass) break;
    current = send(current, pass as PlayerIntent, made.ctx);
  }
  return current;
}

/** The hero (or any card) of this code takes `amount` damage from the framework, as a heavy attack of an earlier round left it. */
export const hurt = (made: LayoutTable, state: ScenarioState, code: string, amount: number): ScenarioState => ({ ...placeDamage({ ...state, window: null }, idOf(state, code), amount, made.ctx.cards, [], "framework", UNATTRIBUTED), window: state.window });

/** The Trigger effect ids the engine offers the active seat now. */
export const offeredActions = (made: LayoutTable, state: ScenarioState): string[] => legalIntents(state, made.ctx).filter((intent) => intent.type === "Trigger").map((intent) => (intent as { effectId: string }).effectId);
