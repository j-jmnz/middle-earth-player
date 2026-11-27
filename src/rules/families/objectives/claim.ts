// Rules: rr.guarded, rr.objective-cards, rr.reveal, hrd.guarded-x (data/rules/entries.json); ledger lines 17106:B:1, 17107:B:1, 17108:B:1, 17102:A:1.
//
// The Black Serpent's objectives. The stages claim a Harad objective that nothing holds (ClaimUnattached, a settle sweep): the first player chooses a hero and it is attached there, unless an encounter card guards it or it hangs on one. A Harad objective a hero holds can be
// detached, revealed and added to the staging area again (RevealDetached, 17102:A:1); revealing it resolves its Guarded (X).
import type { Instruction } from "../../../catalog/boundary.ts";

import { effectCause } from "../../core/cause.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { startReveal } from "../../windows/frames.ts";
import type { Focus } from "../index.ts";
import { freeOfEncounters } from "./free.ts";

/**
 * The settle sweep: while the main quest stage names ClaimUnattached, the first free objective with the trait in the staging area is claimed by the first player, who chooses the hero in a frame (the claim is announced as `claimed`). The next one follows once that frame is done.
 * Only a game whose records name the verb looks.
 */
export function claimUnattached(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure || state.stageCleared || state.staging.length === 0 || !gameReads(state, ctx, '"ClaimUnattached"')) return state;
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  const record = stage ? ctx.effects.find((effect) => effect.cardCode === stage.code && effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "ClaimUnattached")) : undefined;
  const verb = record?.instructions.find((instruction): instruction is Extract<Instruction, { verb: "ClaimUnattached" }> => instruction.verb === "ClaimUnattached");
  if (!record || !verb || state.seats[state.firstPlayer]?.eliminated) return state;
  const id = state.staging.find((candidate) => printedOf(ctx.cards, state.cards[candidate]?.code ?? "").type === "objective" && state.cards[candidate]?.claimed !== true && hasTrait(state, candidate, verb.trait, ctx) && freeOfEncounters(state, candidate));
  if (!id) return state;
  const instructions: Instruction[] = [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "ClaimObjective" }];
  return pushEffectFrame(state, { frame: "ResolveEffect", sourceId: id, actor: state.firstPlayer, peril: false, effectId: record.id, instructions, picked: [], cancel: null, blockCancel: null, cause: effectCause(record) }, steps);
}

/** RevealDetached: the last picked objective, claimed and attached to a hero, is detached and revealed by the actor. Nothing happens with another card picked. */
export function revealDetached(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.claimed !== true || card.host == null || printedOf(ctx.cards, card.code).type !== "objective") return state;
  const detached = updateCard(moveCard(state, id, { zone: "staging" }), id, { face: "up", claimed: undefined, controller: null });
  return startReveal(detached, focus.seat, ctx, steps, id);
}
