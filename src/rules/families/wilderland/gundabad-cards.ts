// Rules: emce.caves-deck, emce.treasure, rr.search, rr.guarded, rr.restricted, rr.attachment-cards (data/rules/entries.json); ledger lines 19137:B:2, 19138:B:1, 12194:A:2.
// The verbs of Mount Gundabad's encounter and quest cards that move cards about: the location searched out of the Caves deck, the enemy chosen at random among those just discarded, and the treasures Dragon-sickness gathers on one character.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { pileOf } from "../../core/piles.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { enforceRestricted } from "../../player/attach.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { freeOfEncounters } from "../objectives/free.ts";
import { stage } from "../uncharted/deck.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** ActivateFromCaves: the actor chooses a location of the Caves deck, which becomes the active location (the one active now returns to the staging area). With nobody to ask, the top location is taken. */
export function activateFromCaves(state: ScenarioState, instruction: Verb<"ActivateFromCaves">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const options = pileOf(state, "cavesDeck").filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "location");
  if (options.length === 0) return state;
  const chosen = focus.chosen != null && options.includes(focus.chosen) ? focus.chosen : options.length === 1 || !effectData(state) ? options[0] : undefined;
  if (chosen == null) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  return moveEncounter(state, chosen, "activeLocation", focus.seat, ctx, steps);
}

/** StageRandomDiscarded: one of the cards the effect's DiscardEncounterTop discarded, of the type and still in the discard pile, is chosen with the game's seed and added to the staging area. */
export function stageRandomDiscarded(state: ScenarioState, instruction: Verb<"StageRandomDiscarded">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const options = (effectData(state)?.looked ?? []).filter((id) => state.cards[id]?.zone === "encounterDiscard" && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === instruction.type);
  if (options.length === 0) return state;
  const rolled = shuffleIds(options, state.seed, state.seedCursor);
  const chosen = rolled.ids[0];
  return chosen == null ? state : stage(updateCard({ ...state, seedCursor: rolled.cursor }, chosen, { face: "up" }), chosen, focus.seat, ctx);
}

/**
 * AttachTreasuresToHost: each treasure in play with no encounter card guarding it (attached to a character, or lying free in the staging area) is attached to the character the source is attached to, and leaves the card it was on. The character's controller discards
 * Restricted attachments past the limit (rr.restricted).
 */
export function attachTreasuresToHost(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const hostId = source?.host ?? undefined;
  const host = hostId ? state.cards[hostId] : undefined;
  if (!hostId || !host || host.controller == null || !inPlay(host.zone)) return state;
  const treasures = Object.values(state.cards).filter((card) => inPlay(card.zone) && card.host !== hostId && printedOf(ctx.cards, card.code).type === "treasure" && freeOfEncounters(state, card.id));
  let next = state;
  for (const treasure of treasures) {
    const old = treasure.host ? next.cards[treasure.host] : undefined;
    if (old) next = updateCard(next, old.id, { attachments: old.attachments.filter((id) => id !== treasure.id) });
    next = attachTo(moveCard(next, treasure.id, { zone: "play", seat: host.controller }), treasure.id, hostId);
  }
  return treasures.length === 0 ? state : enforceRestricted(next, hostId, ctx, steps);
}
