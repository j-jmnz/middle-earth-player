// Rules: emce.treasure, rr.guarded (data/rules/entries.json); ledger lines 12168:A:2, 12189:B:2. The treasures of the Ered Mithrin campaign in a game: the draw of 3 random
// undiscovered treasures, the choice of one, and its attachment to an encounter card as a guarded objective.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { guardWith } from "../objectives/guard.ts";
import { markPicked } from "../play/refs.ts";
import type { Focus } from "../index.ts";

type Verb = Extract<Instruction, { verb: "AttachRandomTreasure" }>;

/** The treasures the log has not recorded and the game has not dealt, by code: the pool the random draw is made from. */
export function undiscoveredTreasures(state: ScenarioState, ctx: ReduceContext): string[] {
  const discovered = new Set(state.campaignFacts?.treasures ?? []);
  const dealt = new Set(Object.values(state.cards).map((card) => card.code));
  return [...ctx.cards.values()].filter((printed) => printed.campaignKind === "treasure" && !discovered.has(printed.code) && !dealt.has(printed.code)).map((printed) => printed.code).sort();
}

/** The `count` treasures a Resolution offers (ChooseRandomTreasure): drawn from the undiscovered ones, none the log or this Resolution has written, with the game's seed; the cursor is the seed's place afterwards. */
export function drawTreasures(state: ScenarioState, count: number, ctx: ReduceContext): { candidates: string[]; cursor: number } {
  const written = new Set(state.resolutionLog.treasures ?? []);
  const pool = undiscoveredTreasures(state, ctx).filter((code) => !written.has(code));
  const drawn = shuffleIds(pool, state.seed, state.seedCursor);
  return { candidates: drawn.ids.slice(0, count), cursor: drawn.cursor };
}

/**
 * AttachRandomTreasure: `count` (3) undiscovered treasures are drawn with the game's seed, which moves the seed once; the first player chooses one, and it enters the staging area guarded by
 * `to`. The choice is the verb run again with `focus.chosen`, which draws nothing: the candidates are the options of the window. Run outside an effect frame, which cannot ask, it takes the first drawn.
 */
export function attachRandomTreasure(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const guardId = refCard(state, instruction.to ?? "self", frameScope(state, focus.seat, focus.sourceId));
  const guard = guardId ? state.cards[guardId] : undefined;
  if (!guardId || !guard || (guard.zone !== "staging" && guard.zone !== "engaged" && guard.zone !== "activeLocation")) return state;
  const pool = undiscoveredTreasures(state, ctx);
  if (focus.chosen != null) return pool.includes(focus.chosen) ? attach(state, focus.chosen, guardId, steps) : state;
  const drawn = shuffleIds(pool, state.seed, state.seedCursor);
  const candidates = drawn.ids.slice(0, instruction.count ?? 3);
  const moved = { ...state, seedCursor: drawn.cursor };
  const first = candidates[0];
  if (first == null) return state;
  if (candidates.length === 1 || !effectData(state)) return attach(moved, first, guardId, steps);
  return askTarget(moved, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, candidates);
}

function attach(state: ScenarioState, code: string, guardId: string, steps: EngineStep[]): ScenarioState {
  const spawned = spawn(state, code, { zone: "staging" });
  const cause = currentCause(steps, UNATTRIBUTED);
  // The record that ran this is remembered on the treasure, so the claim of the freed treasure is credited to it.
  const guarded = "effect" in cause ? updateCard(spawned.state, spawned.id, { setUpBy: cause.effect }) : spawned.state;
  // An engaged guard stays engaged: the treasure is attached to it where it is (12189:B:2), and freed when it leaves play.
  return guardWith(guarded, guardId, spawned.id, true);
}

/**
 * ClaimRandomTreasure (120165:A:3, emce.treasure): `count` (3) undiscovered treasures are drawn with the game's seed, which moves the seed once, and the first player chooses one. It is set aside, faceup, and is the picked card of the
 * running effect: the Pick of a character it may attach to (`hostForPicked`) and AttachPicked that follow put it on that character, which the players then control. Run outside an effect frame, which cannot ask, it takes the first drawn.
 */
export function claimRandomTreasure(state: ScenarioState, instruction: Extract<Instruction, { verb: "ClaimRandomTreasure" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const pool = undiscoveredTreasures(state, ctx);
  if (focus.chosen != null) return pool.includes(focus.chosen) ? take(state, focus.chosen) : state;
  const drawn = shuffleIds(pool, state.seed, state.seedCursor);
  const candidates = drawn.ids.slice(0, instruction.count ?? 3);
  const moved = { ...state, seedCursor: drawn.cursor };
  const first = candidates[0];
  if (first == null) return state;
  if (candidates.length === 1 || !effectData(state)) return take(moved, first);
  return askTarget(moved, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, candidates);
}

function take(state: ScenarioState, code: string): ScenarioState {
  const spawned = spawn(state, code, { zone: "setAside" }, "up");
  return markPicked(spawned.state, spawned.id);
}

/** The treasures a player controls: claimed and attached to a character, not still in the staging area under a guard. */
export function controlledTreasures(state: ScenarioState, ctx: ReduceContext): string[] {
  const codes = Object.values(state.cards).filter((card) => {
    const printed = ctx.cards.get(card.code);
    return printed?.campaignKind === "treasure" && inPlay(card.zone) && card.zone !== "staging" && card.zone !== "seatStaging" && card.controller != null;
  });
  return [...new Set(codes.map((card) => card.code))];
}
