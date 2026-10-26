// Rules: rr.attachment-cards, rr.destroy, rr.quest-advancement, rr.blank, rr.in-play-and-out-of-play (data/rules/entries.json).
//
// The attachments family's hooks in the engine's lowest layers (keywords.ts, quest.ts, listen.ts, constant-records.ts): what
// happens to the cards attached to a host that is destroyed or defeated, a Guarded attachment whose guard leaves play, and a
// card whose text box is blank. Kept free of engine imports beyond the state, so those modules can call it.
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, heldAmount, inPlay, updateCard } from "../state.ts";

// The cards attached to a host that an enemy's destruction or a quest card's defeat is announced to: those in play (a
// Guarded attachment it guarded hears `unguarded` instead).
function heldAttachments(state: ScenarioState, hostId: string): string[] {
  return (state.cards[hostId]?.attachments ?? []).filter((id) => {
    const card = state.cards[id];
    return card != null && inPlay(card.zone);
  });
}

// "When attached enemy is destroyed", "After attached quest card is defeated": each card attached to the host hears it from
// wherever it goes, so this is queued before the host's attachments are released.
export function noteHostDefeated(state: ScenarioState, hostId: string): ScenarioState {
  let next = state;
  for (const id of heldAttachments(state, hostId)) next = queueEvent(next, { trigger: "hostDefeated", seat: next.cards[id]?.controller ?? null, cardId: id, subject: hostId });
  return next;
}

// A Guarded attachment waits out of play (set aside, under its player's control) on the encounter card that guards it.
export function isGuarded(state: ScenarioState, id: string): boolean {
  const card = state.cards[id];
  return card != null && card.zone === "setAside" && card.host != null;
}

// The guard left play: the attachment is no longer guarded, and its player puts it into play (its `unguarded` record).
export function releaseGuarded(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  const host = card?.host ? state.cards[card.host] : undefined;
  if (!card) return state;
  const unlinked = host ? updateCard(state, host.id, { attachments: host.attachments.filter((other) => other !== id) }) : state;
  return queueEvent(updateCard(unlinked, id, { host: null }), { trigger: "unguarded", seat: card.controller, cardId: id });
}

// A card whose printed text box is blank (rr.blank): its own records do not apply while it holds the flag.
export function textBlank(state: ScenarioState, id: string): boolean {
  return flagged(state, id, "blankText");
}

// The total Threat in the staging area less the table's lessStagingThreat modifiers ("reduce the total Threat in the staging
// area by X"), not below 0.
export function withStagingThreat(state: ScenarioState, total: number): number {
  const less = heldAmount(state, "table", "lessStagingThreat");
  return less === 0 ? total : Math.max(0, total - less);
}
