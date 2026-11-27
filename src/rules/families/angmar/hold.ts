// Rules: rr.in-play-and-out-of-play, rr.ownership-and-control, mec108.objective-allies, rr.attachment-cards (data/rules/entries.json); ledger lines 09024:A:2, 09024:A:3, 09051:A:1.
// A card held under a side quest. Rescue Iârion holds Iârion facedown underneath it: he is still in play (the captive zone, families/south/captive.ts), controlled by nobody, and keeps his attachments, so he has not left play until the card says discard him. Lost in the Wilderness
// holds each player's hand facedown underneath it: the cards are out of play (the under zone) and stay their player's.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { destroyCard } from "../../core/keywords.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { inPlay, type ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Focus } from "../index.ts";
import { captiveUnder, captureHero, releaseHero } from "../south/captive.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** HoldUnder: the card in play with the code that a player controls goes facedown underneath the source, still in play, controlled by nobody, with its attachments and tokens (they lie where they were, faceup). */
export function holdUnder(state: ScenarioState, instruction: Verb<"HoldUnder">, focus: Focus): ScenarioState {
  const hostId = focus.sourceId;
  const held = Object.values(state.cards).find((card) => card.code === instruction.code && inPlay(card.zone) && card.controller != null && card.zone !== "captive");
  if (!hostId || !state.cards[hostId] || !held) return state;
  return captureHero(state, held.id, hostId, { attachmentsDown: false, keepTokens: true });
}

/**
 * The side quest is defeated (families/sidequests/quest.ts defeatSideQuest): the card held under it returns to play under the first player, exhausted, faceup, and its attachments with it (a card a player played goes to the first player's play area; one nobody owns stays
 * controlled by nobody): "When this stage is defeated, the first player takes control of Iârion and exhausts him" (09024:A:2).
 */
export function releaseHeldOnDefeat(state: ScenarioState, questId: string): ScenarioState {
  const heldId = captiveUnder(state, questId);
  const held = heldId ? state.cards[heldId] : undefined;
  // A Captive of Cirith Gurat is its owner's and is rescued by the side quest's own record (families/haradrim/captured.ts).
  if (!heldId || !held || held.captive === true) return state;
  const seat = state.firstPlayer;
  const next = releaseHero(state, heldId, seat, { face: "up", exhausted: true }, {}, false, "play");
  return queueEvent(next, { trigger: "changedControl", seat, cardId: heldId });
}

/**
 * DiscardHeld: the card held under the source is discarded from where it lies, with its attachments, and is announced as leaving play (`leftPlay`): the card that says "if this leaves play, the players lose the game" hears it (09016:A:4; mec108.objective-allies), though no
 * zone change out of the captive zone raises the event by itself.
 */
export function discardHeld(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const heldId = focus.sourceId ? captiveUnder(state, focus.sourceId) : null;
  if (!heldId) return state;
  return queueEvent(destroyCard(state, heldId, ctx.cards, steps), { trigger: "leftPlay", seat: null, cardId: heldId });
}
