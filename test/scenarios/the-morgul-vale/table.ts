// Test helpers for the Morgul Vale tests (src/rules/families/pelargir/vale/verbs.test.ts, vale/combat.test.ts): a table of the scenario, an instruction run on it, the quest and attack windows answered.
import type { Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import type { PlayerIntent } from "../../../src/rules/engine/reduce.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";
import { playCost } from "../../../src/rules/player/attach.ts";
import { paymentsFor } from "../../harness/auto-player.ts";
import { sendUnledgered } from "../../harness/player-table.ts";

import { idOf, legalIntents, send, start as begin, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../harness/scene-kit.ts";

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

/** The run of a table's state, constants synced. */
export const opened = (made: LayoutTable, state: ScenarioState = made.state): Run => begin(syncConstants(state, made.ctx));

/** The state after one instruction ran for a seat and the table settled (the round is stopped while it runs, so only what it does is read). */
export function run(made: LayoutTable, state: ScenarioState, instruction: Instruction, options: { seat?: number; sourceId?: string | null; steps?: EngineStep[] } = {}): ScenarioState {
  const steps = options.steps ?? [];
  const done = settle(runInstruction({ ...state, window: null, mode: "stopped" }, instruction, { seat: options.seat ?? 0, sourceId: options.sourceId ?? null }, made.ctx, steps), made.ctx, steps);
  return done.window != null || done.stack.length > 0 ? done : { ...done, mode: state.mode, window: state.window, activeSeat: state.activeSeat };
}

/** The zone of the first card with this code. */
export const where = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;

/** The progress tokens on the card with this code. */
export const tokens = (state: ScenarioState, code: string = CODES.tower): number => state.cards[idOf(state, code)]?.progress ?? 0;

/** The codes of the cards engaged with a seat, in engagement order. */
export const engagedCodes = (state: ScenarioState, seat = 0): string[] => (state.seats[seat]?.engaged ?? []).map((id) => state.cards[id]?.code ?? "");

// The intents that let a window go by without a decision.
const PASSING: readonly PlayerIntent["type"][] = ["Pass", "DeclineTravel", "DeclineEngage", "DeclineAttack"];

/**
 * An attack is fought out: a defense window names the hero `heroCode` (the first hero of the player attacked by default) as the one that takes an undefended attack, or declares `defender` when given; a choice takes the option `choose` names (the first by default); every
 * other window is passed. Stops once `stop` holds.
 */
export function fight(made: LayoutTable, from: Run, stop: (state: ScenarioState) => boolean, options: { defender?: string; heroCode?: string; choose?: (state: ScenarioState) => string } = {}): Run {
  let current = from;
  const answer = (intent: PlayerIntent): void => {
    current = send(current, intent, made.ctx);
  };
  for (let guard = 0; guard < 120 && !stop(current.state) && !current.state.lost && !current.state.stageCleared; guard += 1) {
    const state = current.state;
    const intents = legalIntents(state, made.ctx);
    if (state.window?.kind === "choose") answer({ type: "Choose", optionId: options.choose ? options.choose(state) : (state.window.options[0] ?? "") });
    else if (state.window?.kind === "chooseEnemy") answer({ type: "ChooseEnemy", enemyId: state.window.options[0] ?? "" });
    else if (options.defender && intents.some((intent) => intent.type === "DeclareDefender")) answer({ type: "DeclareDefender", defenderId: idOf(state, options.defender) });
    else if (intents.some((intent) => intent.type === "Undefended")) answer({ type: "Undefended", heroId: options.heroCode ? idOf(state, options.heroCode) : (state.seats[state.window?.kind === "defense" ? state.window.seat : 0]?.heroes[0] ?? "") });
    else {
      const pass = PASSING.map((type) => intents.find((intent) => intent.type === type)).find((intent) => intent != null);
      if (!pass) break;
      answer(pass as PlayerIntent);
    }
  }
  return current;
}

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
