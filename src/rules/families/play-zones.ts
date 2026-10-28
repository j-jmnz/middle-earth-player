// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.ownership-and-control (data/rules/entries.json).
//
// A card leaving play by any path takes what is attached to it: destroyCard (keywords.ts) discards the attachments first and
// names them; a card returned to the hand, put on a deck or moved elsewhere still holds them here, and each is discarded now.
import { queueEvent } from "../queue.ts";
import type { CardInstance, ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { cardsUnder, moveCard } from "../zones.ts";

// `card` is the card as it was before it left play; `released` are the attachments destroyCard already discarded. Each card
// still attached goes to its owner's discard pile (an encounter card to the encounter discard pile), and so does a player card
// attached facedown under it (AttachFacedown). A player card that took attachments with it is announced with them
// (leftPlayWithAttachments: "When a character leaves play, return each attachment attached to that character").
export function leaveWith(state: ScenarioState, card: CardInstance, released: readonly string[]): ScenarioState {
  let next = state;
  const gone = [...released];
  for (const id of card.attachments) {
    const attachment = next.cards[id];
    if (!attachment || attachment.host !== card.id) continue;
    const owner = attachment.owner ?? attachment.controller;
    // A claimed objective returns to the staging area (families/objectives.ts).
    next = moveCard(next, id, attachment.claimed ? { zone: "staging" } : owner != null ? { zone: "discard", seat: owner } : { zone: "encounterDiscard" });
    gone.push(id);
  }
  // Facedown player cards under a player card (an encounter card under one, like Saruman's, has its own rule).
  if (card.controller != null) {
    for (const id of cardsUnder(next, card.id)) {
      const owner = next.cards[id]?.owner;
      if (owner == null) continue;
      next = updateCard(moveCard(next, id, { zone: "discard", seat: owner }), id, { face: "up", owner: undefined });
    }
  }
  // A lost game is over: nothing answers any more (rr.player-elimination).
  if (gone.length === 0 || next.lost || card.controller == null || (card.zone !== "play" && card.zone !== "heroes")) return next;
  return queueEvent(next, { trigger: "leftPlayWithAttachments", seat: card.controller, subject: card.id, attachments: gone });
}
