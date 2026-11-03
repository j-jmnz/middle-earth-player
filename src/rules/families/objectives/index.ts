// Rules: rr.guarded, ltp.guarded, rr.objective-cards, ltp.objective-cards, rr.attachment-cards, rr.restricted (data/rules/entries.json);
// ledger lines 01108:A:1-2, 01109:A:1-2, 01110:A:1-2, 01123:A:1.
//
// The guarded objectives of Escape from Dol Guldur. An objective with the Guarded keyword is guarded when it is revealed (even in
// Setup): the next card of the encounter deck that is not itself an objective is revealed and attached to it, and both stay in the
// staging area. While an encounter card is attached the objective cannot be claimed. Claiming attaches the objective to a hero its
// claimer controls; it counts as an attachment, and when it is detached (its hero leaves play, a card discards it, a Restricted slot
// is over) it returns to the staging area.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../amounts.ts";
import type { EngineStep } from "../../intents.ts";
import type { ReduceContext } from "../../interpret.ts";
import { enforceRestricted } from "../../attach.ts";
import { startReveal } from "../../frames.ts";
import { lastPicked } from "../../player-verbs.ts";
import { printedOf } from "../../printed.ts";
import { queueEvent } from "../../queue.ts";
import type { ScenarioState } from "../../state.ts";
import { inPlay, updateCard } from "../../state.ts";
import { resetEncounterDeck } from "../../verbs.ts";
import { attachTo, moveCard } from "../../zones.ts";
import type { Focus } from "../index.ts";

// An objective in the staging area with no encounter card attached to it is free of encounters, so it can be claimed (rr.guarded).
export function freeOfEncounters(state: ScenarioState, sourceId: string | null): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  // Only an encounter card still hosted by the objective and in play guards it (Iron Shackles sent to a deck is not).
  return source != null && !source.attachments.some((id) => state.cards[id]?.host === source.id && inPlay(state.cards[id]?.zone ?? "removed"));
}

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "GuardObjective":
      return guardObjective(state, instruction, focus, ctx, steps);
    case "ClaimObjective":
      return claimObjective(state, focus, ctx, steps);
    default:
      return null;
  }
}

// GuardObjective: reveals the first card of the encounter deck that is not an objective for the actor and attaches it to the objective.
// An objective that would be the next card stays on the deck: it is revealed, and guarded, in its own turn (rr.guarded).
function guardObjective(state: ScenarioState, instruction: Extract<Instruction, { verb: "GuardObjective" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "self", frameScope(state, focus.seat, focus.sourceId));
  const objective = id ? state.cards[id] : undefined;
  if (!id || !objective || objective.zone !== "staging" || printedOf(ctx.cards, objective.code).type !== "objective") return state;
  const ready = resetEncounterDeck(state, steps);
  const at = ready.encounterDeck.findIndex((cardId) => printedOf(ctx.cards, ready.cards[cardId]?.code ?? "").type !== "objective");
  if (at < 0) return ready;
  // The guard comes to the top of the deck, the objectives above it keep their order below it.
  const deck = [ready.encounterDeck[at] ?? "", ...ready.encounterDeck.slice(0, at), ...ready.encounterDeck.slice(at + 1)];
  return startReveal({ ...ready, encounterDeck: deck }, focus.seat, ctx, steps, undefined, id);
}

// ClaimObjective: the source objective leaves the staging area for the last picked hero, controlled by that hero's controller.
function claimObjective(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const objective = id ? state.cards[id] : undefined;
  const heroId = lastPicked(state);
  const hero = heroId ? state.cards[heroId] : undefined;
  if (!id || !objective || objective.zone !== "staging" || !freeOfEncounters(state, id) || !hero || hero.zone !== "heroes" || hero.controller == null) return state;
  const attached = attachTo(moveCard(state, id, { zone: "attached" }), id, heroId);
  const claimed = updateCard(attached, id, { face: "up", controller: hero.controller, claimed: true });
  return queueEvent(enforceRestricted(claimed, heroId, ctx, steps), { trigger: "claimed", seat: hero.controller, cardId: id });
}
