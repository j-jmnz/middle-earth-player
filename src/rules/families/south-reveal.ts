// Rules: rr.active-location, rr.reveal, rr.staging, rr.first-player, rr.attachment-cards (data/rules/entries.json).
//
// The quest cards' and treacheries' placing verbs of The Ring Goes South: a set-aside location made active, the encounter deck
// revealed until the staging area holds enough Threat, a treachery attached to an active location, and the enemy in the staging
// area with the highest engagement cost.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../amounts.ts";
import { askTarget } from "../choices.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import { startReveal } from "../frames.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { modifiedStat } from "../keywords.ts";
import { hasTrait } from "../conditions.ts";
import { stagingThreat } from "../quest.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { fireForced } from "../triggers.ts";
import { patchTop, topFrame } from "../windows.ts";
import { attachTo, moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";
import { announceEntered } from "./encounter-reveal.ts";
import { markPicked, queueFront } from "./play-refs.ts";
import { activeLocations, makeActiveIn } from "./south-locations.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// MakeSetAsideActive: the card with the code, set aside, becomes an active location. It enters play (rr.in-play-and-out-of-play).
export function makeSetAsideActive(state: ScenarioState, instruction: Verb<"MakeSetAsideActive">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.setAside.find((entry) => state.cards[entry]?.code === instruction.code);
  if (!id) return state;
  const placed = updateCard(makeActiveIn(state, id), id, { face: "up", controller: null });
  return fireForced(announceEntered(placed, id, focus.seat, ctx), { trigger: "becameActive", seat: null, cardId: id }, ctx, steps);
}

// RevealUntilThreat: the first player reveals the top card of the encounter deck, and the instruction runs again once that card is
// resolved, until the staging area holds the Threat or the deck and its discard pile are empty. The reveal is a frame, so a
// card that asks a player can wait.
export function revealUntilThreat(state: ScenarioState, instruction: Verb<"RevealUntilThreat">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const target = resolveAmount(state, instruction.threat, frameScope(state, focus.seat, focus.sourceId), ctx);
  if (stagingThreat(state, ctx.cards) >= target || state.encounterDeck.length + state.encounterDiscard.length === 0) return state;
  const queued = queueFront(state, [{ instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }]);
  return startReveal(queued, state.firstPlayer, ctx, steps);
}

// AttachToActiveLocation: the source treachery attaches to an active location that has no copy of it. The effect's X is 1 when it
// attached, else 0. The first player chooses among several (rr.first-player).
export function attachToActiveLocation(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!source || !focus.sourceId) return state;
  const free = activeLocations(state).filter((id) => !(state.cards[id]?.attachments ?? []).some((attached) => state.cards[attached]?.code === source.code));
  const chosen = focus.chosen && free.includes(focus.chosen) ? focus.chosen : free.length === 1 ? free[0] : undefined;
  if (free.length > 1 && !chosen) return askTarget(state, { instruction: { verb: "AttachToActiveLocation" }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, free);
  const data = topFrame(state)?.data;
  const marked = (attached: boolean): ScenarioState => (data?.kind === "effect" ? patchTop(state, { data: { ...data, x: attached ? 1 : 0 } }) : state);
  if (!chosen) return marked(false);
  const attached = updateCard(attachTo(moveCard(marked(true), focus.sourceId, { zone: "attached" }), focus.sourceId, chosen), focus.sourceId, { face: "up" });
  return attached;
}

// PickHighestEngagement: the enemy in the staging area with the trait and the highest engagement cost becomes the picked card; the
// first player chooses among a tie. Nothing is picked (an empty pick) when there is none.
export function pickHighestEngagement(state: ScenarioState, instruction: Verb<"PickHighestEngagement">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemies = state.staging.filter((id) => state.cards[id] != null && hasTrait(state, id, instruction.trait, ctx) && ctx.cards.get(state.cards[id]?.code ?? "")?.type === "enemy");
  const cost = (id: string): number => modifiedStat(state, state.cards[id]!, "engagementCost", ctx.cards);
  const top = Math.max(...enemies.map(cost), Number.NEGATIVE_INFINITY);
  const tied = enemies.filter((id) => cost(id) === top);
  const chosen = focus.chosen && tied.includes(focus.chosen) ? focus.chosen : tied.length === 1 ? tied[0] : undefined;
  if (tied.length > 1 && !chosen) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied);
  return markPicked(state, chosen ?? "");
}
