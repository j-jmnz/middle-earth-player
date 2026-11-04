// Rules: dcce.ship-objectives, dcce.encounter-cards, dcce.scalable-upgradable, rr.campaign-setup-checklist (data/rules/entries.json); ledger lines 11171:A:2,
// 11055:A:2. What a Dream-chaser campaign card's Setup does to the ships the quest card's Setup prepared: each player fits a Modification boon to each of
// their ship-objectives, and may trade 2 damage on a ship for a resource. Both resolve in a frame after the quest card's Setup (ScenarioDefinition.afterSetup),
// ask the ship's controller through a choice of cards, and are finished by the answers, one decision at a time as PrepareFleet is.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { placeDamage } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { dealtFace } from "../dreamchaser/facts.ts";
import { effectData } from "../encounter/moves.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";

/** The ship-objectives the players control, in the order their seats choose: each living seat in player order, a seat's ships in the order they were taken. */
export function controlledShips(state: ScenarioState, ctx: ReduceContext): string[] {
  const ships = Object.values(state.cards).filter((card) => card.controller != null && inPlay(card.zone) && printedOf(ctx.cards, card.code).ship === "objective");
  const seats = livingSeats(state);
  return ships
    .filter((card) => seats.includes(card.controller ?? -1))
    .sort((left, right) => seats.indexOf(left.controller ?? 0) - seats.indexOf(right.controller ?? 0) || left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }))
    .map((card) => card.id);
}

type Fit = Extract<Instruction, { verb: "FitShips" }>;

/** FitShips: each ship-objective without one of these boons takes one of those still set aside, chosen by its controller, in the order the seats choose. */
export function fitShips(state: ScenarioState, instruction: Fit, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  let next = state;
  let answer = focus.chosen;
  for (;;) {
    const ship = controlledShips(next, ctx).find((id) => !(next.cards[id]?.attachments ?? []).some((attached) => instruction.codes.includes(next.cards[attached]?.code ?? "")));
    const options = Object.values(next.cards)
      .filter((card) => card.zone === "setAside" && instruction.codes.includes(card.code))
      .map((card) => card.id);
    if (!ship || options.length === 0) return next;
    const seat = next.cards[ship]?.controller ?? focus.seat;
    const picked = answer && options.includes(answer) ? answer : options.length === 1 ? options[0] : undefined;
    answer = undefined;
    if (!picked) return effectData(next) ? askTarget(next, { instruction, seat, chosen: null, cause }, options) : { ...next, failure: "Fitting the ships needs a choice, and no effect is asking" };
    const code = next.cards[picked]?.code ?? "";
    next = updateCard(moveCard(next, picked, { zone: "play", seat }), picked, { face: dealtFace(next, code, "up") });
    next = attachTo(next, picked, ship);
  }
}

type Trade = Extract<Instruction, { verb: "TradeShipDamage" }>;

// The hero "a hero's resource pool" names: a seat with one hero takes it, with several chooses.
function heroesOf(state: ScenarioState, seat: number): string[] {
  return (state.seats[seat]?.heroes ?? []).filter((id) => state.cards[id] != null);
}

/** TradeShipDamage: in the order of the fleet, the controller of each ship chooses to trade or keep; a trade deals `damage` to the ship and adds `resources`
 * to a hero's pool. `ship` is the ship being decided (absent: the first), and `hero` "?" while the hero is being chosen. */
export function tradeShipDamage(state: ScenarioState, instruction: Trade, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  const fleet = controlledShips(state, ctx);
  const ship = instruction.ship ?? fleet[0];
  if (!ship || !state.cards[ship]) return state;
  const seat = state.cards[ship]?.controller ?? focus.seat;
  const nextShip = fleet[fleet.indexOf(ship) + 1];
  const goOn = (current: ScenarioState): ScenarioState =>
    nextShip ? queueFront(current, [{ instruction: { verb: "TradeShipDamage", damage: instruction.damage, resources: instruction.resources, ship: nextShip }, seat, chosen: null, cause }]) : current;
  const ask = (current: ScenarioState, options: readonly string[], carry: Trade): ScenarioState => (effectData(current) ? askTarget(current, { instruction: carry, seat, chosen: null, cause }, options) : { ...current, failure: "Trading damage needs a choice, and no effect is asking" });
  // Deciding whether to trade.
  if (instruction.hero == null) {
    if (focus.chosen == null) return ask(state, ["trade", "keep"], { ...instruction, ship });
    if (focus.chosen !== "trade") return goOn(state);
    const heroes = heroesOf(state, seat);
    if (heroes.length === 0) return goOn(state);
    if (heroes.length > 1) return ask(state, heroes, { ...instruction, ship, hero: "?" });
    return goOn(trade(state, ship, heroes[0] ?? "", instruction, ctx, steps, cause));
  }
  // Choosing the hero.
  const heroes = heroesOf(state, seat);
  if (focus.chosen == null || !heroes.includes(focus.chosen)) return ask(state, heroes, { ...instruction, ship, hero: "?" });
  return goOn(trade(state, ship, focus.chosen, instruction, ctx, steps, cause));
}

function trade(state: ScenarioState, ship: string, heroId: string, instruction: Trade, ctx: ReduceContext, steps: EngineStep[], cause: ReturnType<typeof currentCause>): ScenarioState {
  const damaged = placeDamage(state, ship, instruction.damage, ctx.cards, steps, "framework", cause);
  const hero = damaged.cards[heroId];
  if (!hero) return damaged;
  return queueEvent(updateCard(damaged, heroId, { resources: hero.resources + instruction.resources }), { trigger: "resourcesAdded", seat: hero.controller, cardId: heroId });
}

/** DamageShip: framework damage to the last picked card (a Ship objective): an effect of an encounter or campaign card, which the ship's immunity to player card
 * effects does not stop. */
export function damageShip(state: ScenarioState, instruction: Extract<Instruction, { verb: "DamageShip" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  if (!state.cards[id] || printedOf(ctx.cards, state.cards[id]?.code ?? "").ship !== "objective") return state;
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  return amount > 0 ? placeDamage(state, id, amount, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED)) : state;
}

