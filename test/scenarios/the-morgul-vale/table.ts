// Test helpers for the Morgul Vale tests (src/rules/families/pelargir/vale/, src/campaign/scenarios/the-morgul-vale/, src/play/scenarios/the-morgul-vale-table.test.ts): a table of the scenario, an instruction run on it, the quest and attack windows answered. The run, the lookups and the passing intents are the scene kit's (test/harness/scene-kit.ts).
import type { Effect } from "../../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { playCost } from "../../../src/rules/player/attach.ts";
import { paymentsFor } from "../../harness/auto-player.ts";
import { sendUnledgered } from "../../harness/player-table.ts";

import { engagedCodes, fight, idOf, legalIntents, opened, run, tableFromLayout, where, type Layout, type LayoutTable, type Run } from "../../harness/scene-kit.ts";

export const SCENARIO = "the-morgul-vale";
export const CODES = {
  rearguard: "06144",
  betrayal: "06145",
  rider: "06146",
  tower: "06147",
  bodyguard: "06148",
  sorcerer: "06149",
  tracker: "06150",
  murzag: "06151",
  alcaron: "06152",
  nazgul: "06153",
  road: "06154",
  vale: "06155",
  bridge: "06156",
  fog: "06157",
  malice: "06158",
  terror: "06159",
  deadCity: "06160",
  powerOfMordor: "05061",
} as const;

/** A table of the scenario on stage 1 (side B) unless the layout names a stage; `effects` are the records it runs (every authored one by default). */
export const table = (layout: Layout, effects?: readonly Effect[], extra?: readonly string[]): LayoutTable =>
  tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? CODES.rearguard }, { ...(effects ? { effects } : {}), ...(extra ? { extra } : {}) });

export { engagedCodes, fight, opened, run, where };

/** The progress tokens on the card with this code. */
export const tokens = (state: ScenarioState, code: string = CODES.tower): number => state.cards[idOf(state, code)]?.progress ?? 0;

/** The card `code` of the hand is played now (the intent the engine offers for it; the player card has no line in this scenario's ledger, so its steps are not checked against one), and every choice it opens is answered by `choose` (the first option by default); a window of the enemy picker takes its first enemy. */
export function playCard(made: LayoutTable, from: Run, code: string, choose?: (state: ScenarioState) => string): Run {
  const cardId = idOf(from.state, code);
  if (!legalIntents(from.state, made.ctx).some((offered) => offered.type === "PlayCard" && offered.cardId === cardId)) throw new Error(`no play of ${code} is offered`);
  const cost = playCost(from.state, cardId, 0, made.ctx) ?? 0;
  let current = sendUnledgered(from, { type: "PlayCard", cardId, payments: paymentsFor(from.state, made.ctx, 0, cardId, cost) ?? (() => { throw new Error(`seat 0 cannot pay ${String(cost)} for ${code}`); })() }, made.ctx);
  for (let guard = 0; guard < 30 && (current.state.window?.kind === "choose" || current.state.window?.kind === "chooseEnemy"); guard += 1) {
    const window = current.state.window;
    current = window.kind === "choose" ? sendUnledgered(current, { type: "Choose", optionId: choose ? choose(current.state) : (window.options[0] ?? "") }, made.ctx) : sendUnledgered(current, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, made.ctx);
  }
  return current;
}
