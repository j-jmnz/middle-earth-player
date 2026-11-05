// Rules: emce.treasure, rr.guarded (data/rules/entries.json); ledger lines 12168:A:1, 12189:B:2. The treasures of the Ered Mithrin campaign in a game: the draw of 3 random
// undiscovered treasures, the choice of one, and its attachment to an encounter card as a guarded objective.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { guardWith } from "../objectives/guard.ts";
import type { Focus } from "../index.ts";

type Verb = Extract<Instruction, { verb: "AttachRandomTreasure" }>;

/** The treasures the log has not recorded and the game has not dealt, by code: the pool the random draw is made from. */
export function undiscoveredTreasures(state: ScenarioState, ctx: ReduceContext): string[] {
  const discovered = new Set(state.campaignFacts?.treasures ?? []);
  const dealt = new Set(Object.values(state.cards).map((card) => card.code));
  return [...ctx.cards.values()].filter((printed) => printed.campaignKind === "treasure" && !discovered.has(printed.code) && !dealt.has(printed.code)).map((printed) => printed.code).sort();
}

/**
 * AttachRandomTreasure: `count` (3) undiscovered treasures are drawn with the game's seed, which moves the seed once; the first player chooses one, and it enters the staging area guarded by
 * `to`. The choice is the verb run again with `focus.chosen`, which draws nothing: the candidates are the options of the window. Run outside an effect frame, which cannot ask, it takes the first drawn.
 */
export function attachRandomTreasure(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const guardId = refCard(state, instruction.to ?? "self", frameScope(state, focus.seat, focus.sourceId));
  const guard = guardId ? state.cards[guardId] : undefined;
  if (!guardId || !guard || (guard.zone !== "staging" && guard.zone !== "engaged")) return state;
  const pool = undiscoveredTreasures(state, ctx);
  if (focus.chosen != null) return pool.includes(focus.chosen) ? attach(state, focus.chosen, guardId) : state;
  const drawn = shuffleIds(pool, state.seed, state.seedCursor);
  const candidates = drawn.ids.slice(0, instruction.count ?? 3);
  const moved = { ...state, seedCursor: drawn.cursor };
  const first = candidates[0];
  if (first == null) return state;
  if (candidates.length === 1 || !effectData(state)) return attach(moved, first, guardId);
  return askTarget(moved, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, candidates);
}

function attach(state: ScenarioState, code: string, guardId: string): ScenarioState {
  const spawned = spawn(state, code, { zone: "staging" });
  return guardWith(spawned.state, guardId, spawned.id);
}

/** The treasures a player controls: claimed and attached to a character, not still in the staging area under a guard. */
export function controlledTreasures(state: ScenarioState, ctx: ReduceContext): string[] {
  const codes = Object.values(state.cards).filter((card) => {
    const printed = ctx.cards.get(card.code);
    return printed?.campaignKind === "treasure" && inPlay(card.zone) && card.zone !== "staging" && card.zone !== "seatStaging" && card.controller != null;
  });
  return [...new Set(codes.map((card) => card.code))];
}
