// Test helpers for the Encounter at Amon Dîn tests (src/rules/families/pelargir/amon-din.test.ts, src/campaign/scenarios/encounter-at-amon-din/): a table of the scenario, an instruction run, a card's id and tokens.
import type { Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import type { PlayerIntent } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { updateCard } from "../../../src/rules/core/state.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";

import { idOf, legalIntents, send, start as begin, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../harness/scene-kit.ts";

export const SCENARIO = "encounter-at-amon-din";
export const CODES = {
  savagery: "06066",
  protect: "06067",
  rescued: "06068",
  dead: "06069",
  alcaron: "06070",
  ghulat: "06071",
  marauding: "06072",
  ravager: "06073",
  eagle: "06074",
  farmhouse: "06075",
  hamlet: "06076",
  secluded: "06077",
  homestead: "06078",
  trapped: "06079",
  panicked: "06080",
} as const;

/** A table of the scenario on stage 1 unless the layout names a stage; `effects` are the records it runs (every authored one by default). */
export const table = (layout: Layout, effects?: readonly Effect[], extra?: readonly string[]): LayoutTable =>
  tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? CODES.savagery }, { ...(effects ? { effects } : {}), ...(extra ? { extra } : {}) });

/** The state after one instruction ran for the first seat (the window cleared first). */
export const run = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId }, made.ctx, []);

/** The state after the instruction ran and the frames it opened were settled. */
export const runSettled = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => settle(run(made, state, instruction, sourceId), made.ctx, []);

/** The villager tokens on the first card with this code (the card's resource tokens). */
export const villagers = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;

/** The damage tokens on the first card with this code. */
export const damageOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;

/** The state with this many villager tokens on the card with this code. */
export const withVillagers = (state: ScenarioState, code: string, amount: number): ScenarioState => updateCard(state, idOf(state, code), { resources: amount });

/**
 * An enemy engaged with the first seat attacks in the combat phase, undefended, and the attack lands on Rescued Villagers (stage 2B). The attack runs until `stop` holds for the state (a Response window of Lord Alcaron) or the attack is over.
 * The attack's damage must be dealt by the enemy's own number: the deck holds no Shadow card (`f0` only).
 */
export function undefendedAtRescued(made: LayoutTable, stop: (state: ScenarioState) => boolean = () => false): Run {
  let run: Run = send(begin(syncConstants(made.state, made.ctx)), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    if (run.state.window?.kind === "chooseEnemy") run = send(run, { type: "ChooseEnemy", enemyId: run.state.window.options[0] ?? "" }, made.ctx);
    else if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
    else {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
  }
  run = send(run, { type: "Undefended", heroId: idOf(run.state, CODES.rescued) }, made.ctx);
  for (let guard = 0; guard < 40 && !stop(run.state) && (run.state.pendingAttack != null || run.state.window?.kind === "response" || run.state.window?.kind === "choose"); guard += 1) {
    if (run.state.window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return run;
}

/** The two heroes commit (4 Willpower in all) and the quest phase is played to its end, on a table that opens on the quest phase. */
export function quested(made: LayoutTable, state: ScenarioState): Run {
  let run = send(begin(state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
  run = send(run, { type: "Pass" }, made.ctx);
  for (let guard = 0; guard < 16 && run.state.phase === "Quest" && !run.state.lost; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass || run.state.mode === "travel") break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return run;
}
