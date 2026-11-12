// Rules: mec108.captured-cards, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 10039:B:1, 10041:A:1, 10044:A:2, 10174:B:2.
//
// Rescue. The cards captured under a host are rescued together when it leaves play, and `RescueRandom` rescues some of them at random (the stage 2B's progress): each card goes to its owner's hand, a hero straight into play under its
// owner, ready and with no tokens; the permanent boons it held when it was put into the captured deck wait set aside until it is back (`heroBoons`). One "captured cards rescued" occurrence announces every card one effect rescued, whatever
// the number (the host is its subject), so Jailor Gornákh and Dungeon Guard answer once. A rescue changes no threat.
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { nextUint } from "../../core/seed.ts";
import { areaHeadOf, firstOfArea } from "../breaking/areas.ts";
import { capturedUnder } from "./pile.ts";

// The permanent boons set aside for the hero come back attached to it, in the order they were set aside (10174:B:2): the Campaign Log's boons of that character.
export function attachHeroBoons(state: ScenarioState, heroId: string): ScenarioState {
  const hero = state.cards[heroId];
  const boons = (state.heroBoons ?? []).filter(([, hero_]) => hero_ === heroId).map(([boon]) => boon);
  if (!hero || boons.length === 0) return state;
  let next: ScenarioState = { ...state, heroBoons: (state.heroBoons ?? []).filter(([, hero_]) => hero_ !== heroId) };
  for (const boon of boons) {
    if (next.cards[boon]?.zone !== "setAside") continue;
    next = attachTo(updateCard(moveCard(next, boon, { zone: "attached" }), boon, { face: "up", controller: hero.controller }), boon, heroId);
  }
  return next;
}

// One captured card goes back: a hero into play under its owner, anything else into its owner's hand. A card whose owner has left the game goes to that owner's discard pile; an encounter card (the scenario owns it: rr.ownership-and-control, an encounter attachment
// Tunnels of Mount Gram captured) goes to the encounter discard pile, the scenario's equivalent out of play area.
function release(state: ScenarioState, id: string): { state: ScenarioState; toHand: boolean } {
  const card = state.cards[id];
  const owner = card?.owner;
  if (!card) return { state, toHand: false };
  if (owner == null) return { state: updateCard(moveCard(state, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null }), toHand: false };
  if (!state.seats[owner]) return { state: moveCard(state, id, { zone: "removed" }), toHand: false };
  if (state.seats[owner]?.eliminated) return { state: updateCard(moveCard(state, id, { zone: "discard", seat: owner }), id, { face: "up" }), toHand: false };
  if (card.heroSlot != null) {
    const entered = updateCard(moveCard(state, id, { zone: "heroes", seat: owner }), id, { face: "up", heroSlot: undefined });
    return { state: queueEvent(attachHeroBoons(entered, id), { trigger: "heroEnteredPlay", seat: owner, cardId: id }), toHand: false };
  }
  return { state: updateCard(moveCard(state, id, { zone: "hand", seat: owner }), id, { face: "up" }), toHand: true };
}

// Rescues the cards (all at once): a rescue of none changes nothing and announces nothing. `host` is the card they were under (the subject of the announcement).
export function rescueCards(state: ScenarioState, host: string, ids: readonly string[], area: number | null = areaHeadOf(state, host)): ScenarioState {
  if (ids.length === 0) return state;
  let next = state;
  const toHand: string[] = [];
  for (const id of ids) {
    const released = release(next, id);
    next = released.state;
    if (released.toHand) toHand.push(id);
  }
  // The event is about the first player of the area the host was in (mec108.create-staging-area): that player answers its Response.
  return queueEvent({ ...next, rescued: toHand }, { trigger: "capturedRescued", seat: area == null ? null : firstOfArea(next, area), cardId: host, subject: host });
}

// A host that leaves play: every card captured underneath it is rescued (moveCard).
export function rescueUnder(state: ScenarioState, host: string, area: number | null): ScenarioState {
  return rescueCards(state, host, capturedUnder(state, host), area);
}

// `amount` of the cards under the host, chosen at random with the game's seed, are rescued; what lies under it when there are fewer is all rescued and the rest of the amount is lost (10039:B:1).
export function rescueRandom(state: ScenarioState, host: string, amount: number): ScenarioState {
  const under = [...capturedUnder(state, host)];
  const chosen: string[] = [];
  let cursor = state.seedCursor;
  while (chosen.length < amount && under.length > 0) {
    const at = nextUint(state.seed, cursor) % under.length;
    cursor += 1;
    chosen.push(...under.splice(at, 1));
  }
  return rescueCards({ ...state, seedCursor: cursor }, host, chosen);
}
