// Rules: rr.hero-cards, rr.unique-cards, rr.attachment-cards, rr.the-word-choose (data/rules/entries.json).
//
// Cards from the player's collection: a hero swapped for another (Helm of Secrecy) and another version of a hero attached to
// Thorongil. The app tracks no collection (docs/brief.md), so the collection is every hero card the game's card table holds
// (src/campaign/world.ts loads them all when a deck has a card that names the collection). The candidates are made as cards set
// aside, the actor chooses one, and the others are dropped again.
import type { Instruction } from "../../catalog/boundary.ts";

import { attachmentHostIds } from "../attach.ts";
import { askTarget } from "../choices.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { releaseAttachments } from "../keywords.ts";
import { printedOf, type PrintedCard } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard, withSeat } from "../state.ts";
import { attachTo, moveCard, spawn } from "../zones.ts";
import type { Focus } from "./index.ts";
import { lastPickedCard } from "./play-refs.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// A hero card of a sphere of influence (the Fellowship and Baggins cards of the sagas are not in the collection a card names).
function plainHero(printed: PrintedCard): boolean {
  return printed.type === "hero" && printed.sphere != null && printed.sphere !== "fellowship" && printed.sphere !== "baggins";
}

// The hero card codes of the card table that fit, in code order.
function collectionCodes(ctx: ReduceContext, fits: (printed: PrintedCard) => boolean): string[] {
  return [...ctx.cards.values()].filter((printed) => plainHero(printed) && fits(printed)).map((printed) => printed.code).sort();
}

// The cards made as candidates for `sourceId`'s choice, still set aside.
function candidatesOf(state: ScenarioState, sourceId: string): string[] {
  return Object.values(state.cards).filter((card) => card.collection === sourceId && card.zone === "setAside").map((card) => card.id);
}

// Drops the candidates of the choice but the one kept: they never existed as far as the game goes.
function dropCandidates(state: ScenarioState, sourceId: string, keep: string | null): ScenarioState {
  const dropped = candidatesOf(state, sourceId).filter((id) => id !== keep);
  if (dropped.length === 0) return state;
  const cards = Object.fromEntries(Object.entries(state.cards).filter(([id]) => !dropped.includes(id)));
  return { ...state, cards, setAside: state.setAside.filter((id) => !dropped.includes(id)) };
}

// Makes a candidate card of each code, set aside and marked as the source's. One candidate is taken without asking; several are
// offered to the actor. Returns the state and the chosen card, or null when the actor was asked (the instruction runs again with
// the answer) or none fits.
function choose(state: ScenarioState, codes: readonly string[], instruction: Instruction, focus: Focus): { state: ScenarioState; chosen: string | null; asked: boolean } {
  const sourceId = focus.sourceId;
  if (!sourceId) return { state, chosen: null, asked: false };
  if (focus.chosen && candidatesOf(state, sourceId).includes(focus.chosen)) return { state: dropCandidates(state, sourceId, focus.chosen), chosen: focus.chosen, asked: false };
  if (codes.length === 0) return { state, chosen: null, asked: false };
  let next = dropCandidates(state, sourceId, null);
  const ids: string[] = [];
  for (const code of codes) {
    const made = spawn(next, code, { zone: "setAside" });
    next = updateCard(made.state, made.id, { collection: sourceId });
    ids.push(made.id);
  }
  const only = ids[0];
  if (ids.length === 1 && only) return { state: next, chosen: only, asked: false };
  return { state: askTarget(next, { instruction, seat: focus.seat, chosen: null }, ids), chosen: null, asked: true };
}

// SwapHero (Helm of Secrecy): the picked hero goes back to the collection, a hero from it takes its place.
export function swapHero(state: ScenarioState, instruction: Verb<"SwapHero">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const hero = lastPickedCard(state);
  const old = hero ? state.cards[hero] : undefined;
  if (!hero || !old || old.zone !== "heroes" || old.controller == null) return state;
  const seat = old.controller;
  const threat = printedOf(ctx.cards, old.code).threat ?? 0;
  // A title already in play (any player's hero or ally) cannot be brought in a second time (rr.unique-cards).
  const inGame = new Set(Object.values(state.cards).filter((card) => card.zone === "heroes" || card.zone === "play").map((card) => printedOf(ctx.cards, card.code).name));
  const codes = collectionCodes(ctx, (printed) => (printed.threat ?? 0) <= threat && !inGame.has(printed.name));
  // The tokens are discarded first, as the card says, whether or not a hero can be swapped in.
  const cleared = old.damage || old.resources || old.progress ? updateCard(state, hero, { damage: 0, resources: 0, progress: 0 }) : state;
  const picked = choose(cleared, codes, instruction, focus);
  if (picked.asked || !picked.chosen) return picked.state;
  return swap(picked.state, hero, picked.chosen, seat, ctx, steps);
}

function swap(state: ScenarioState, oldId: string, newId: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const old = state.cards[oldId];
  const entering = state.cards[newId];
  const pile = state.seats[seat];
  if (!old || !entering || !pile) return state;
  // The new hero enters play at the old one's place among the player's heroes.
  let next = moveCard(state, newId, { zone: "heroes", seat });
  const heroes = next.seats[seat];
  if (heroes) next = withSeat(next, seat, { ...heroes, heroes: [...heroes.heroes.filter((id) => id !== newId).map((id) => (id === oldId ? newId : id))] });
  // Each attachment it may have moves to it; the others are discarded with the old hero.
  for (const attachmentId of [...old.attachments]) {
    const attachment = next.cards[attachmentId];
    if (!attachment) continue;
    const owner = attachment.owner ?? attachment.controller ?? seat;
    if (!attachmentHostIds(next, owner, attachment.code, ctx).includes(newId)) continue;
    next = attachTo(updateCard(next, oldId, { attachments: (next.cards[oldId]?.attachments ?? []).filter((id) => id !== attachmentId) }), attachmentId, newId);
  }
  next = releaseAttachments(next, oldId, ctx.cards, steps);
  next = moveCard(next, oldId, { zone: "removed" });
  steps.push({ kind: "destroy", targetId: oldId });
  return queueEvent(next, { trigger: "enteredPlay", seat, cardId: newId });
}

// AttachCollectionHero (Thorongil): another version of the host, attached to the source.
export function attachCollectionHero(state: ScenarioState, instruction: Verb<"AttachCollectionHero">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const host = source?.host ? state.cards[source.host] : undefined;
  if (!source || !host) return state;
  const printedHost = printedOf(ctx.cards, host.code);
  const codes = collectionCodes(ctx, (printed) => printed.name === printedHost.name && printed.code !== printedHost.code);
  const picked = choose(state, codes, instruction, focus);
  if (picked.asked || !picked.chosen) return picked.state;
  return updateCard(picked.state, source.id, { lends: picked.chosen });
}
