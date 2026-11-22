// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.attachment-cards, rr.cannot (data/rules/entries.json); ledger lines 51004:B:1, 51004:B:2, 51013:A:1 (docs/scenarios/standalone-scenarios.md, The Wizard's Quest, readings 3 and 9).
// A player card an encounter card holds faceup under it as a guarded objective: an ally under the stage Carried Away, a card of the first player's hand under Necromancer's Pass. It stays its owner's, out of play, and no copy of its title can be played while it lies there (an effect may still put one into play).
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { releaseAttachments } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import type { Focus } from "../index.ts";

/** HoldPickedUnder: the last picked card lies faceup under the source, its owner's still. A card in play (an ally, an attachment taken from its host) loses its tokens and its attachments are discarded as it leaves play; with `barsPutting` no copy of its title can be put into play either. */
export function holdPickedUnder(state: ScenarioState, instruction: Extract<Instruction, { verb: "HoldPickedUnder" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  const card = state.cards[id];
  const host = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!card || !host || id === host.id || card.zone === "under") return state;
  const owner = card.owner ?? card.controller ?? focus.seat;
  const bare = inPlay(card.zone) ? releaseAttachments(state, id, ctx.cards, steps) : state;
  return updateCard(moveCard({ ...bare, heldCards: true }, id, { zone: "under", locationId: host.id }), id, { face: "up", owner, controller: null, heldTitle: true, heldPutting: instruction.barsPutting === true ? true : undefined, heldExhausted: instruction.returnsExhausted === true ? true : undefined, committed: false, damage: 0, resources: 0, progress: 0 });
}

/** Whether a card shares its title with one that lies held under an encounter card: it cannot be played ("copies of that card cannot be played", 51013:A:1; an effect may still put it into play). */
export function titleHeld(state: ScenarioState, cardId: string, ctx: ReduceContext, putting = false): boolean {
  const instance = state.cards[cardId];
  // A card put into play is barred only by the cards that say so (`heldPutting`, 51205:B:1).
  const held = instance ? Object.values(state.cards).filter((card) => card.heldTitle === true && card.zone === "under" && (!putting || card.heldPutting === true)) : [];
  if (!instance || held.length === 0) return false;
  const name = printedOf(ctx.cards, instance.code).name;
  return held.some((card) => printedOf(ctx.cards, card.code).name === name);
}

/**
 * The card a held player card lies under has left play (Necromancer's Pass explored or discarded, the stage Carried Away defeated): each card it held returns to its owner's hand and its title is free again. A seat that left the game gets the card in its discard pile.
 * Runs in the settle loop, so the cards come back as soon as the host is gone, whatever took it.
 */
export function releaseHeld(state: ScenarioState): ScenarioState {
  if (state.heldCards !== true) return state;
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.heldTitle !== true || card.zone !== "under") continue;
    const host = card.host ? state.cards[card.host] : undefined;
    if (host && (inPlay(host.zone) || host.zone === "questStage")) continue;
    const seat = card.owner;
    if (seat == null) continue;
    const gone = state.seats[seat]?.eliminated === true;
    const back = card.heldExhausted === true && !gone;
    const released = updateCard(moveCard(next, card.id, { zone: gone ? "discard" : back ? "play" : "hand", seat }), card.id, { face: "up", owner: undefined, heldTitle: undefined, heldPutting: undefined, heldExhausted: undefined, host: null, ...(back ? { controller: seat, exhausted: true } : {}) });
    // An ally back in play enters play for its owner (rr.in-play-and-out-of-play).
    next = back ? queueEvent(released, { trigger: "enteredPlay", seat, cardId: card.id }) : released;
  }
  return next;
}
