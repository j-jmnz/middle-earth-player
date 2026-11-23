import { EFFECTS } from "../../src/effects/index.ts";

import { formatIdle, type IdleHit } from "./idle.ts";

// The abilities the idle check (scripts/card-smoke/idle.ts) finds offered with nothing to change that are not a fault the engine can still fix, or not yet: each with its record id (an event
// played from the hand is `<code>:play`) and why. The check fails on any other. The list may not grow: a record that is a real fault is fixed through `potential.ts`, a family `idle` hook or a
// `canPick` condition on the record (docs/agents/card-audit.md, Fix and review), and an entry whose fix has landed is removed (`KNOWN_IDLE_MOST` goes down with it).
export const KNOWN_IDLE: Readonly<Record<string, string>> = {
  "08003:play": "Swift and Silent: with every hero ready, the return to hand holds `copiesPlayedThisRound`, which the idle check cannot read before the card is played, so the event is offered; a real fault to fix there.",
  "10172:action:1": "Determination used from the host it is attached to attaches it again to a unique character that already carries it; the Action is offered, and the attach changes nothing. A real fault to fix there.",
  "19062:response:1": "Outmatched readies the event's other card (the defending character); the idle check reads no `other` target of a Ready, so the Response is offered when the defender is ready. A real fault; its test needs a combat table.",
  "22146:response:1": "Thorongil searches the collection for another version of its hero: the smoke world has no such card in its catalog, so the record has nothing to attach. Not a fault of the card.",
};
export const KNOWN_IDLE_MOST = 4;

/** The hits that are not in the known list: what fails the smoke. */
export function unknownIdle(hits: readonly IdleHit[]): IdleHit[] {
  return hits.filter((hit) => !(hit.recordId in KNOWN_IDLE));
}

/** The known record ids that are no record any more (and no `:play` of a card that has an Action): a stale entry. */
export function staleKnownIdle(): string[] {
  const ids = new Set(EFFECTS.map((effect) => effect.id));
  const actionCards = new Set(EFFECTS.filter((effect) => effect.timing === "action").map((effect) => effect.cardCode));
  return Object.keys(KNOWN_IDLE).filter((id) => !(ids.has(id) || (id.endsWith(":play") && actionCards.has(id.slice(0, -":play".length)))));
}

export { formatIdle };
