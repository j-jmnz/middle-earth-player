// Test helpers for the Blood of Gondor tests (src/rules/families/pelargir/hidden.test.ts, src/campaign/scenarios/the-blood-of-gondor/): a table of the scenario, the hidden cards taken by the engine's own verb, a game driven through its windows.
import type { Effect } from "../../../src/catalog/boundary.ts";
import { UNATTRIBUTED } from "../../../src/rules/core/cause.ts";
import { placeDamage } from "../../../src/rules/core/keywords.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { hiddenIds } from "../../../src/rules/families/pelargir/hidden.ts";

import { drive, engagedCodes, idOf, legalIntents, opened, run, tableFromLayout, where, type Layout, type LayoutTable } from "../../harness/scene-kit.ts";

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

export { drive, engagedCodes, opened, run, where };

/** The seat takes `amount` hidden cards, by the family's own verb: the top cards of the encounter deck. */
export const takes = (made: LayoutTable, state: ScenarioState, seat: number, amount = 1): ScenarioState => run(made, state, { verb: "TakeHiddenCard", amount }, { seat });

/** The codes of a seat's hidden cards, the card taken first first (every seat with none named). */
export const hiddenCodes = (state: ScenarioState, seat?: number): string[] => hiddenIds(state, seat).map((id) => state.cards[id]?.code ?? "");

/** The id of the first card with this code, whatever its zone. */
export const idByCode = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";

/** The hero (or any card) of this code takes `amount` damage from the framework, as a heavy attack of an earlier round left it. */
export const hurt = (made: LayoutTable, state: ScenarioState, code: string, amount: number): ScenarioState => ({ ...placeDamage({ ...state, window: null }, idOf(state, code), amount, made.ctx.cards, [], "framework", UNATTRIBUTED), window: state.window });

/** The Trigger effect ids the engine offers the active seat now. */
export const offeredActions = (made: LayoutTable, state: ScenarioState): string[] => legalIntents(state, made.ctx).filter((intent) => intent.type === "Trigger").map((intent) => (intent as { effectId: string }).effectId);
