// Rules: rr.attachment-cards, rr.forced, dcce.ship-objectives (data/rules/entries.json); ledger lines 12132:A:1, 12132:A:2. Taking on Water: "When Revealed: Attach to a Ship objective. (Counts as a Condition attachment with
// the text: Forced: When attached objective exhausts, deal 2 damage to it. Action: Exhaust 3 characters you control to discard Taking on Water.)" and "Shadow: If defending character is a Ship, attach Taking on Water to it."
// AttachSelf to a ship (`kind: "ship"`) attaches the treachery (the Shadow card too, which leaves the enemy's shadow cards as it attaches). Its Forced effect hears `shipExhausted`: the engine exhausts a Ship objective in many places (defending,
// attacking, questing, Sailing, an effect): the exhaust event announces it as it exhausts (`shipExhaustedNow`), and a settle sweep notices the Ship objectives that became exhausted since it last looked, in a game whose cards hear the trigger, and announces each one once. Its Action
// is the Ship's controller's, as the Action of an encounter card attached to a card is (player/actions.ts).
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";

// A host exhausted before the card attached did not exhaust "while attached": the sweep is told it is already exhausted. The `attached` hook of the family, called for every AttachSelf.
export function noteAttachedToShip(state: ScenarioState, _id: string, host: string, ctx: ReduceContext): ScenarioState {
  if (printedOf(ctx.cards, state.cards[host]?.code ?? "").ship !== "objective") return state;
  const sea = state.sea ?? { heading: null, headingCard: null, routes: {} };
  const seen = sea.exhausted ?? [];
  return state.cards[host]?.exhausted && !seen.includes(host) ? { ...state, sea: { ...sea, exhausted: [...seen, host] } } : state;
}

/** The settle sweep: each Ship objective that is exhausted now and was not when the sweep last looked is announced as `shipExhausted`. */
export function announceShipsExhausted(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"shipExhausted"')) return state;
  const sea = state.sea ?? { heading: null, headingCard: null, routes: {} };
  const now = Object.values(state.cards)
    .filter((card) => card.exhausted && inPlay(card.zone) && printedOf(ctx.cards, card.code).ship === "objective")
    .map((card) => card.id);
  const before = sea.exhausted ?? [];
  const fresh = now.filter((id) => !before.includes(id));
  if (fresh.length === 0 && now.length === before.length) return state;
  let next: ScenarioState = { ...state, sea: { ...sea, exhausted: now } };
  for (const id of fresh) next = queueEvent(next, { trigger: "shipExhausted", seat: next.cards[id]?.controller ?? null, cardId: id });
  return next;
}

/**
 * A Ship objective exhausts through the exhaust event (`exhaustAnnounced`): `shipExhausted` is announced at once and the sweep is told, so an exhaust that is readied again
 * before the sweep looks is heard too, and the sweep does not announce it a second time. Only in a game whose cards hear the trigger.
 */
export function shipExhaustedNow(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone) || printedOf(ctx.cards, card.code).ship !== "objective" || !gameReads(state, ctx, '"trigger":"shipExhausted"')) return state;
  const sea = state.sea ?? { heading: null, headingCard: null, routes: {} };
  const seen = sea.exhausted ?? [];
  const noted = seen.includes(id) ? state : { ...state, sea: { ...sea, exhausted: [...seen, id] } };
  return queueEvent(noted, { trigger: "shipExhausted", seat: card.controller ?? null, cardId: id });
}
