// Rules: rr.guarded, ltp.guarded, emce.guarded-x, wor.guarded-x, rr.objective-cards, ltp.objective-cards, rr.attachment-cards, rr.restricted (data/rules/entries.json);
// ledger lines 01108:A:1-2, 01109:A:1-2, 01110:A:1-2, 01123:A:1, 12121:A:1, 12126:A:3, 12127:A:3, 12133:A:1 (AttachGuard, guard.ts), 12134:A:2 to 12137:A:2 (ControlWhenFree, control.ts).
//
// The guarded objectives of Escape from Dol Guldur. An objective with the Guarded keyword is guarded when it is revealed (even in
// Setup): the next card of the encounter deck that is not itself an objective is revealed and attached to it, and both stay in the
// staging area; a next card that also has the Guarded keyword is revealed after it, and guarded in turn. While an encounter card is attached the objective cannot be claimed. Claiming attaches the objective to a hero its
// claimer controls; it counts as an attachment, and when it is detached (its hero leaves play, a card discards it, a Restricted slot
// is over) it returns to the staging area.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { enforceRestricted } from "../../player/attach.ts";
import { startReveal } from "../../windows/frames.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, updateCard } from "../../core/state.ts";
import { resetEncounterDeck } from "../../interpret/verbs.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { discardUntilType } from "../encounter/discard-until.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { queueFront } from "../play/refs.ts";
import { effectsOf } from "../../windows/listen.ts";
import type { Focus } from "../index.ts";
import { controlSweep } from "./control.ts";
import { freeOfEncounters } from "./free.ts";
import { claimUnattached, revealDetached } from "./stage-claim.ts";
import { attachGuard, guardWith } from "./guard.ts";
import { objectivesPickMatches } from "./pick.ts";

export { freeOfEncounters };

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "GuardObjective":
      return guardObjective(state, instruction, focus, ctx, steps);
    case "ClaimObjective":
      return claimObjective(state, instruction, focus, ctx, steps);
    case "AttachGuard":
      return attachGuard(state, instruction, focus, ctx);
    // A constant kept by the settle sweep (control.ts): it does nothing when run.
    case "ControlWhenFree":
    case "ClaimUnattached":
      return state;
    case "RevealDetached":
      return revealDetached(state, focus, ctx, steps);
    default:
      return null;
  }
}

// GuardObjective: reveals the first card of the encounter deck that is not an objective for the actor and attaches it to the objective.
// An objective with the Guarded keyword that would be the next card is revealed after that card has been used to guard the first (rr.guarded): the card after it guards the first objective, then the second
// objective is revealed and its own Guarded keyword takes the card after that. An objective without the keyword stays on the deck.
function guardObjective(state: ScenarioState, instruction: Extract<Instruction, { verb: "GuardObjective" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "self", frameScope(state, focus.seat, focus.sourceId));
  const objective = id ? state.cards[id] : undefined;
  if (!id || !objective || objective.zone !== "staging" || printedOf(ctx.cards, objective.code).type !== "objective") return state;
  // Guarded (enemy) / Guarded (location): the card found is added to the staging area and guards the objective, not revealed (emce.guarded-x).
  if (instruction.types) return guardedByType(state, id, instruction.types, focus, ctx, steps);
  const ready = resetEncounterDeck(state, steps, ctx);
  const at = ready.encounterDeck.findIndex((cardId) => printedOf(ctx.cards, ready.cards[cardId]?.code ?? "").type !== "objective");
  if (at < 0) return ready;
  // The guard comes to the top of the deck, the objectives above it keep their order below it.
  const deck = [ready.encounterDeck[at] ?? "", ...ready.encounterDeck.slice(0, at), ...ready.encounterDeck.slice(at + 1)];
  // The second Guarded card is the first card of the deck behind the guard: the next reveal of this effect is its own.
  const second = at > 0 ? ready.encounterDeck[0] : undefined;
  const queued = second && isGuardedObjective(ready, second, ctx) && effectData(ready) ? queueFront(ready, [{ instruction: { verb: "RevealEncounter" }, seat: focus.seat, chosen: null }]) : ready;
  return startReveal({ ...queued, encounterDeck: deck }, focus.seat, ctx, steps, undefined, id);
}

// Whether the card is an objective whose When Revealed record guards it (the Guarded keyword).
function isGuardedObjective(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  return card != null && printedOf(ctx.cards, card.code).type === "objective" && effectsOf(ctx, card.code).some((effect) => effect.timing === "whenRevealed" && effect.instructions.some((instruction) => instruction.verb === "GuardObjective"));
}

// Guarded (X) on an objective (emce.guarded-x, wor.guarded-x): cards are discarded from the encounter deck until one of the types is discarded (the discard pile is shuffled into an empty deck), and that card is added to the staging area
// and attached to the objective as a guarded objective. With no card of the types in the deck or the discard pile the objective stays unguarded.
export function guardedByType(state: ScenarioState, objectiveId: string, types: readonly string[], focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const { state: searched, found } = discardUntilType(state, types, ctx);
  if (found == null) return state;
  return guardWith(moveEncounter(searched, found, "staging", focus.seat, ctx, steps), found, objectiveId);
}

// ClaimObjective: the source objective leaves the staging area (or the hero it is attached to) for the last picked hero, controlled by that hero's controller; an objective ally a player controls (Amarthiúl, 10110:A:1) may be the host as well.
function claimObjective(state: ScenarioState, instruction: Extract<Instruction, { verb: "ClaimObjective" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = instruction.card ? refCard(state, instruction.card, frameScope(state, focus.seat, focus.sourceId)) : focus.sourceId;
  const objective = id ? state.cards[id] : undefined;
  const heroId = lastPicked(state);
  const hero = heroId ? state.cards[heroId] : undefined;
  // A claimed objective attached to another hero is claimed from there as well: "A hero can also exhaust to claim Book of Mazarbul even if it is attached to another hero" (dwd.book-of-mazarbul); the claim moves it.
  const claimable = objective?.zone === "staging" || (objective?.zone === "attached" && (objective.claimed === true || instruction.fromHost === true)) || (instruction.fromHost === true && objective?.zone === "encounterDiscard");
  if (!id || !objective || !claimable || !freeOfEncounters(state, id) || !hero || (hero.zone !== "heroes" && hero.zone !== "play") || hero.controller == null) return state;
  const attached = attachTo(moveCard(state, id, { zone: "attached" }), id, heroId);
  const claimed = updateCard(attached, id, { face: "up", controller: hero.controller, claimed: true });
  if (flagged(state, id, "announcesClaim")) steps.push({ kind: "claim", cardId: id, heroId, seat: hero.controller });
  return queueEvent(enforceRestricted(claimed, heroId, ctx, steps), { trigger: "claimed", seat: hero.controller, cardId: id });
}

export const manifest: RulesFamily = {
  name: "objectives",
  settle: { sweep: (state, ctx, steps) => claimUnattached(controlSweep(state, ctx), ctx, steps) },
  pick: (state, id, spec, at, ctx) => objectivesPickMatches(state, id, spec, ctx, at),
  verbs: ["GuardObjective", "ClaimObjective", "AttachGuard", "ControlWhenFree", "ClaimUnattached", "RevealDetached"],
  run,
};
