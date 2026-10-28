// Rules: rr.attachment-cards, rr.destroy, rr.quest-advancement, rr.blank, rr.in-play-and-out-of-play (data/rules/entries.json).
//
// The attachments family's hooks in the engine's lowest layers (keywords.ts, quest.ts, listen.ts, constant-records.ts): what
// happens to the cards attached to a host that is destroyed or defeated, a Guarded attachment whose guard leaves play, and a
// card whose text box is blank. Kept free of engine imports beyond the state, so those modules can call it.
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, heldAmount, inPlay, updateCard } from "../state.ts";

// The cards attached to a host that an enemy's destruction or a quest card's defeat is announced to: the player cards in play
// (a Guarded attachment it guarded hears `unguarded` instead; an encounter card attached to it has no such ability).
function heldAttachments(state: ScenarioState, hostId: string): string[] {
  return (state.cards[hostId]?.attachments ?? []).filter((id) => {
    const card = state.cards[id];
    return card != null && card.controller != null && inPlay(card.zone);
  });
}

// "When attached enemy is destroyed", "After attached quest card is defeated": each card attached to the host hears it from
// wherever it goes, so this is queued before the host's attachments are released.
// The codes of the cards with a `hostDefeated` record, by card map: registered by the reducer so that a hero's destruction is
// announced only to the attachments that listen for it (an enemy's and a quest card's always are).
const HOST_LISTENERS = new WeakMap<object, ReadonlySet<string>>();

export function registerHostListeners(ctx: { cards: object; effects: readonly { cardCode: string; trigger?: string }[] }): void {
  if (HOST_LISTENERS.has(ctx.cards)) return;
  HOST_LISTENERS.set(ctx.cards, new Set(ctx.effects.filter((effect) => effect.trigger === "hostDefeated").map((effect) => effect.cardCode)));
}

// `heroCards`: the host is a hero, so only the attachments with a `hostDefeated` record hear it (when the reducer registered them).
export function noteHostDefeated(state: ScenarioState, hostId: string, heroCards?: object): ScenarioState {
  let next = state;
  const listeners = heroCards ? HOST_LISTENERS.get(heroCards) : undefined;
  const heard = (id: string) => listeners == null || listeners.has(state.cards[id]?.code ?? "");
  for (const id of heldAttachments(state, hostId).filter(heard)) next = queueEvent(next, { trigger: "hostDefeated", seat: next.cards[id]?.controller ?? null, cardId: id, other: hostId });
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
  return flagged(state, id, "blankText") || state.cards[id]?.prisoner === true;
}

// The total Threat in the staging area less the table's lessStagingThreat modifiers ("reduce the total Threat in the staging
// area by X"), not below 0.
export function withStagingThreat(state: ScenarioState, total: number): number {
  const less = heldAmount(state, "table", "lessStagingThreat");
  // "Raise the total Threat in the staging area by X" (moreStagingThreat, families/dungeon.ts).
  const more = heldAmount(state, "table", "moreStagingThreat");
  return less === 0 && more === 0 ? total : Math.max(0, total + more - less);
}
