// Rules: rr.reveal, rr.staging (data/rules/entries.json); ledger lines 132053:A:4, 132077:B:3.
// The first Goblin revealed each round gains surge (Bolg), and the topmost enemy of the encounter discard pile added to the staging area (stage 3).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { gameReads } from "../../core/game-reads.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** A card was revealed: while a card with FirstRevealedSurges is in play, the first card of its trait and type revealed in a round (the Setup's reveals count for round 1) is marked as such until the round ends, and gains Surge as it is revealed. */
export function noteFirstRevealed(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  if (!card || !gameReads(state, ctx, '"FirstRevealedSurges"')) return state;
  const printed = printedOf(ctx.cards, card.code);
  const rule = constantInstructions(state, ctx).find(({ instruction }) => instruction.verb === "FirstRevealedSurges" && instruction.type === printed.type && hasTrait(state, cardId, instruction.trait, ctx));
  if (!rule || flagged(state, "table", "firstRevealedSeen")) return state;
  const marked = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat: "firstRevealedSeen" as const, amount: 1, until: "endOfRound" as const }] };
  return markSurge(marked, cardId);
}

/** StageTopmostFromDiscard: the last card of the encounter discard pile of this type is added to the staging area, put there and not revealed. */
export function stageTopmostFromDiscard(state: ScenarioState, instruction: Verb<"StageTopmostFromDiscard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = [...state.encounterDiscard].reverse().find((candidate) => state.cards[candidate] != null && printedOf(ctx.cards, state.cards[candidate]!.code).type === instruction.type);
  return id ? moveEncounter(state, id, "staging", focus.seat, ctx, steps) : state;
}
