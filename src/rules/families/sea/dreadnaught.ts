// Rules: rr.player-elimination, rr.first-player, rr.engaged, rr.ownership-and-control, dcce.ship-objectives (data/rules/entries.json); docs/scenarios/standalone-scenarios/the-hunt-for-the-dreadnaught.md, The Hunt for the Dreadnaught, readings 12, 13, 14, 19, 25 and 7. The pieces of the box that
// no earlier sea card needed: the ship-objective that is flipped to its Upgraded side, the elimination of a player with no ship-objective, the Corsair that comes into play at random, the Ship with the fewest hit points left and the hero that
// gains the Traits of another.
import type { Instruction } from "../../../catalog/boundary.ts";

import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { nextUint } from "../../core/seed.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { lastPicked, pickedList } from "../../interpret/player-verbs.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { gameReads } from "../../core/game-reads.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { announceEnteredHand } from "../island/hand.ts";
import { markPicked } from "../play/refs.ts";
import type { Focus } from "../index.ts";

/** FlipShip: the last picked Ship objective flips to its Upgraded side, side B, once (a Basic ship that has an Upgraded side; a ship dealt Upgraded by a campaign, or one with no Upgraded side, stays), keeping its damage and tokens, and hears `flipped` (readings 12 and 13). */
export function flipShip(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const id = lastPicked(state);
  const ship = id ? state.cards[id] : undefined;
  if (!ship || !inPlay(ship.zone) || ship.face === "B") return state;
  const printed = printedOf(ctx.cards, ship.code);
  if (printed.ship !== "objective" || printed.upgraded == null) return state;
  return queueEvent(updateCard(state, ship.id, { face: "B" }), { trigger: "flipped", seat: ship.controller, cardId: ship.id });
}

/** The constant "If a player controls no ship-objective, that player is eliminated from the game" (40001:B:3, 40002:B:2): checked at each settle once the box's fleet is prepared and nothing is resolving (reading 14). A Gondorian Warship or a Skirmisher a player took counts. */
export function eliminateWithoutShip(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.sea?.fleet !== true || state.lost || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || !gameReads(state, ctx, '"EliminateWithoutShip"')) return state;
  const modeCard = Object.values(state.cards).some((card) => card.zone === "modeCard" && card.face === "B");
  if (!modeCard) return state;
  let next = state;
  for (const seat of livingSeats(state)) {
    const ships = Object.values(next.cards).some((card) => card.controller === seat && inPlay(card.zone) && printedOf(ctx.cards, card.code).ship === "objective");
    if (!ships) next = eliminateSeat(next, seat, steps);
  }
  return next;
}

/** PickFewestHitPoints: of the Ship enemies and the Ship objectives in play (any player's), the one with the fewest hit points left is picked, the first player choosing among those tied; nothing is picked when none is in play (reading 25). */
export function pickFewestHitPoints(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const ships = pickCandidates(state, { type: "character", control: "any", trait: "Ship" }, focus.seat, [], focus.sourceId, ctx);
  const enemies = pickCandidates(state, { type: "enemy", control: "any", trait: "Ship", staging: true }, focus.seat, [], focus.sourceId, ctx);
  const candidates = [...new Set([...ships, ...enemies])];
  if (candidates.length === 0) return state;
  const left = (id: string): number => {
    const card = state.cards[id];
    return card ? Math.max(0, modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage) : Number.POSITIVE_INFINITY;
  };
  const fewest = Math.min(...candidates.map(left));
  const tied = candidates.filter((id) => left(id) === fewest);
  const chosen = focus.chosen && tied.includes(focus.chosen) ? focus.chosen : tied.length === 1 ? tied[0] : undefined;
  if (!chosen) return askTarget(state, { instruction: { verb: "PickFewestHitPoints" }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied);
  return markPicked(state, chosen);
}

/** EngageRandomSetAside: of the unique enemies with the Trait that are set aside, one chosen with the game's seed (in id order, so a seed always picks the same) is put into play engaged with the actor: not revealed (no When Revealed, no Boarding), dealt no shadow card, but an engagement for the Forced effects that hear it (reading 19). */
export function engageRandomSetAside(state: ScenarioState, instruction: Extract<Instruction, { verb: "EngageRandomSetAside" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.seats[focus.seat]?.eliminated) return state;
  const set = state.setAside
    .filter((id) => {
      const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
      return printed.type === "enemy" && printed.isUnique && printed.traits.includes(instruction.trait);
    })
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const id = set[nextUint(state.seed, state.seedCursor) % Math.max(set.length, 1)];
  if (!id) return state;
  return moveEncounter(updateCard({ ...state, seedCursor: state.seedCursor + 1 }, id, { face: "up" }), id, "engaged", focus.seat, ctx, steps);
}

/** GainHeroTraits: the hero picked first gains the printed Traits of the hero picked last until the end of the game (Eithiliant's Setup); with one hero picked (a lone hero), nothing happens. */
export function gainHeroTraits(state: ScenarioState, ctx: ReduceContext, focus: Focus): ScenarioState {
  const picked = pickedList(state);
  const to = picked.at(-2);
  const from = picked.at(-1);
  if (!to || !from || to === from || !state.cards[to] || !state.cards[from]) return state;
  const traits = printedOf(ctx.cards, state.cards[from]?.code ?? "").traits;
  return { ...state, modifiers: [...state.modifiers, ...traits.map((trait) => ({ instanceId: to, sourceId: focus.sourceId ?? to, stat: "traitGained" as const, amount: 1, until: "endOfGame" as const, trait }))] };
}

/** The attacker may not be declared against the Dreadnaught while the flag holds on it (a character "engaged player cannot attack the Dreadnaught" bars, 40014:A:2). */
export function barredFromDreadnaught(state: ScenarioState, attackerId: string, enemyId: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  return state.modifiers.length > 0 && flagged(state, attackerId, "cannotAttackDreadnaught") && printedOf(cards, state.cards[enemyId]?.code ?? "").name === "Dreadnaught";
}

const DONE = "done";
const MOST_COPIES = 3;
const COLLECTION = "collection:";

/** AddEventsToHand (40009:B:2): the actor chooses up to `upTo` events, one at a time, from their discard pile and from the collection, and adds them to their hand; they may stop. A title already held in 3 copies, or in its own deck limit when the card has a lower one (deck, hand, discard pile, play and the cards added), is not offered
 * again (rr.deckbuilding). An event of the collection is made in the hand: the game did not hold it. */
export function addEventsToHand(state: ScenarioState, instruction: Extract<Instruction, { verb: "AddEventsToHand" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const taken = [...(instruction.taken ?? [])];
  let next = state;
  const answer = focus.chosen;
  const seat = focus.seat;
  const pile = next.seats[seat];
  if (!pile || next.seats[seat]?.eliminated) return state;
  if (answer === DONE) return state;
  if (answer) {
    if (answer.startsWith(COLLECTION)) next = spawn(next, answer.slice(COLLECTION.length), { zone: "hand", seat }).state;
    else next = announceEnteredHand(next, moveCard(next, answer, { zone: "hand", seat }), seat, ctx);
    taken.push(answer);
  }
  if (taken.length >= instruction.upTo) return next;
  const held = (title: string): number => {
    const mine = next.seats[seat];
    const ids = [...(mine?.deck ?? []), ...(mine?.hand ?? []), ...(mine?.discard ?? []), ...(mine?.play ?? [])];
    return ids.filter((id) => printedOf(ctx.cards, next.cards[id]?.code ?? "").name === title).length;
  };
  const events = (ids: readonly string[]): string[] => ids.filter((id) => printedOf(ctx.cards, next.cards[id]?.code ?? "").type === "event" && held(printedOf(ctx.cards, next.cards[id]?.code ?? "").name) <= MOST_COPIES);
  const fromDiscard = events(next.seats[seat]?.discard ?? []).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const fromCollection = [...ctx.cards.values()]
    .filter((printed) => printed.type === "event" && printed.sphere != null && held(printed.name) < Math.min(MOST_COPIES, printed.deckLimit ?? MOST_COPIES))
    .map((printed) => `${COLLECTION}${printed.code}`)
    .sort();
  const options = [...fromDiscard, ...fromCollection];
  if (options.length === 0) return next;
  return effectData(next) ? askTarget(next, { instruction: { ...instruction, taken }, seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, [...options, DONE]) : next;
}
