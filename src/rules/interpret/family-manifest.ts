// What a mechanic family adds to the rules: the runner of its verbs (docs/architecture.md, Mechanic families). Each
// src/rules/families/<family>/index.ts exports one `manifest`; src/rules/families/index.ts lists them in play order.
import type { Amount, Condition, Instruction, PickSpec } from "../../catalog/boundary.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ScenarioState } from "../core/state.ts";
import type { AmountScope } from "./amounts.ts";
import type { Scope } from "./conditions.ts";
import type { ReduceContext } from "./interpret.ts";
import type { PickContext } from "./pick.ts";

/** The seat an instruction resolves for and the card whose effect it is. `chosen`: the target a player chose when the verb
 * asked for one (askTarget in choices.ts puts the instruction back with it). */
export type Focus = { seat: number; sourceId: string | null; chosen?: string };

/** Runs one instruction of its family's verbs, or returns null when the verb is not one of them. */
export type Runner = (state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]) => ScenarioState | null;

/** One step of the settle loop (src/rules/engine/machine.ts): returns a new state, or the same object when nothing changes. */
export type SettleHook = (state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]) => ScenarioState;

/** Where a family joins the settle loop. `before` and `after` run once per pass, around the core's own encounter deck refill (`before` first,
 * after the constant win check); `sweep` runs on the result of the core's sweeps while the game is neither lost nor failed. The order among
 * families is SETTLE_ORDER in src/rules/families/index.ts. */
export type SettleHooks = { readonly before?: SettleHook; readonly after?: SettleHook; readonly sweep?: SettleHook };

/** Traveling the families change: `may` lets the players travel although the active location stays; `reach` lists locations beyond staging
 * they may travel to (appended after the staged ones, when `may` holds or not: a family returns [] when it does not apply). */
export type TravelHooks = {
  readonly may?: (state: ScenarioState, ctx: ReduceContext) => boolean;
  readonly reach?: (state: ScenarioState, ctx: ReduceContext) => readonly string[];
};

/** A filter predicate of a family: false takes the card out of the pick, true leaves the other predicates to decide. Runs after the core's. */
export type PickHook = (state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext) => boolean;

/** A condition kind of a family: true or false, or null when the condition is not the family's. Asked before the core's switch. */
export type ConditionHook = (state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext) => boolean | null;

/** An amount of a family, before the amount's `times`, `plus` and `limit`: a number, or null when the amount is not the family's. Asked before the core's reads. */
export type AmountHook = (state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext) => number | null;

export type RulesFamily = {
  /** The folder name, which is also the catalog file name in src/catalog/families. */
  readonly name: string;
  /** Every verb `run` answers, so a test can check them against the verbs the catalog side declares. */
  readonly verbs: readonly Instruction["verb"][];
  readonly run: Runner;
  /** Optional hooks into the core; each is called through RULES_FAMILIES (src/rules/interpret/family-hooks.ts), in list order unless the hook says otherwise. */
  readonly settle?: SettleHooks;
  readonly travel?: TravelHooks;
  readonly pick?: PickHook;
  readonly condition?: ConditionHook;
  readonly amount?: AmountHook;
};
