// Rules: dcce.prepare-your-fleet, dcce.heading (data/rules/entries.json). "Players prepare their fleet": each player chooses and takes control of
// one of the six ship-objectives of The Dream-chaser's Fleet (set aside by the scenario's piles), one of the players must choose the Dream-chaser,
// and in a game with one player that player takes the Dream-chaser and one other. Each ship not used is removed from the game. Then the player who
// controls the Dream-chaser attaches the Heading card to it and sets it on-course.
//
// The verb makes one choice and queues itself for the next: a seat with a choice is asked through a choice of cards (askTarget), one with a single
// legal ship takes it. The choice is the seat's own, in player order from the first player.
import type { Instruction } from "../../catalog/boundary.ts";

import { askTarget } from "../choices.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import { dealtFace } from "./dreamchaser-facts.ts";
import { recordsOfFace } from "./dreamchaser-faces.ts";
import { pushCardEffects } from "../effect-frames.ts";
import { effectsOf } from "../listen.ts";
import type { ScenarioState } from "../state.ts";
import { inPlay, livingSeats, updateCard } from "../state.ts";
import { attachTo, moveCard } from "../zones.ts";
import { effectData } from "./encounter-moves.ts";
import type { Focus } from "./index.ts";
import { FLEET_SET } from "./sea-routes.ts";
import { type SeaState } from "./sea-types.ts";

/** The Dream-chaser, by title: the one ship the rules name as the ship one player must take (dcce.prepare-your-fleet). */
export const DREAM_CHASER = "Dream-chaser";

type Ships = { free: string[]; taken: string[] };

// The fleet's ship-objectives: those still set aside, and those a player already controls.
function ships(state: ScenarioState, ctx: ReduceContext): Ships {
  const found: Ships = { free: [], taken: [] };
  for (const card of Object.values(state.cards)) {
    const printed = printedOf(ctx.cards, card.code);
    if (printed.ship !== "objective" || printed.encounterSet !== FLEET_SET) continue;
    if (card.zone === "setAside") found.free.push(card.id);
    else if (card.controller != null && inPlay(card.zone)) found.taken.push(card.id);
  }
  found.free.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return found;
}

const isDreamChaser = (state: ScenarioState, ctx: ReduceContext, id: string): boolean => printedOf(ctx.cards, state.cards[id]?.code ?? "").name === DREAM_CHASER;

// The seats that take a ship, in the order they choose: each living seat from the first player, and a lone player twice.
function slots(state: ScenarioState): number[] {
  const seats = livingSeats(state);
  return seats.length === 1 ? [seats[0] ?? 0, seats[0] ?? 0] : seats;
}

/** The fleet of this game, ready to be prepared: the ships a seat could still choose and the seat that chooses next (null when every seat has its
 * ship). Exported for the table's choice and the tests. */
export function fleetChoice(state: ScenarioState, ctx: ReduceContext): { seat: number; options: string[] } | null {
  const order = slots(state);
  const { free, taken } = ships(state, ctx);
  const seat = order[taken.length];
  if (seat == null) return null;
  const dreamChaserTaken = taken.some((id) => isDreamChaser(state, ctx, id));
  // The Dream-chaser is forced on the choice that would otherwise leave nobody with it: the last of several players, a lone player's first.
  const last = livingSeats(state).length === 1 ? taken.length === 0 : taken.length === order.length - 1;
  const forced = !dreamChaserTaken && last;
  const options = free.filter((id) => !forced || isDreamChaser(state, ctx, id));
  return { seat, options };
}

function attachHeading(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const { taken } = ships(state, ctx);
  const dreamChaser = taken.find((id) => isDreamChaser(state, ctx, id));
  const card = dreamChaser ? state.cards[dreamChaser] : undefined;
  if (!dreamChaser || card?.controller == null) return state;
  // The Heading card of the fleet's set: an objective that is not a ship, wherever the scenario put it (set aside or in the staging area).
  const heading = Object.values(state.cards).find((candidate) => {
    const printed = printedOf(ctx.cards, candidate.code);
    return printed.type === "objective" && printed.ship == null && printed.encounterSet === FLEET_SET && (candidate.zone === "staging" || candidate.zone === "setAside");
  });
  const sea: SeaState = state.sea ?? { heading: null, headingCard: null, routes: {} };
  if (!heading) return { ...state, sea: { ...sea, heading: "Sun" } };
  const moved = attachTo(moveCard(state, heading.id, { zone: "play", seat: card.controller }), heading.id, dreamChaser);
  return { ...updateCard(moved, heading.id, { face: "up" }), sea: { ...sea, heading: "Sun", headingCard: heading.id } };
}

// A ship's Setup lines ("Raise your starting threat by 3", "Reduce your starting threat by 6") resolve for the player who took it, on the side it shows, once the
// whole fleet is prepared.
function fleetSetups(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of ships(state, ctx).taken) {
    const ship = next.cards[id];
    if (!ship || ship.controller == null) continue;
    const records = recordsOfFace(ship, effectsOf(ctx, ship.code)).filter((effect) => effect.timing === "setup");
    if (records.length > 0) next = pushCardEffects(next, "setup", id, ship.controller, false, records, ctx, steps);
  }
  return next;
}

/** PrepareFleet (dcce.prepare-your-fleet): each seat takes its ship in turn (a seat with a choice is asked, one with a single legal ship takes it);
 * then the unused ships leave the game and the Heading card goes on the Dream-chaser, on-course. */
export function prepareFleet(state: ScenarioState, instruction: Extract<Instruction, { verb: "PrepareFleet" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  let next = state;
  let answer = focus.chosen;
  for (;;) {
    const choice = fleetChoice(next, ctx);
    if (!choice) {
      for (const id of ships(next, ctx).free) next = moveCard(next, id, { zone: "removed" });
      return fleetSetups(attachHeading(next, ctx), ctx, steps);
    }
    const { seat, options } = choice;
    if (options.length === 0) return { ...next, failure: "The fleet has no ship left to take" };
    const picked = answer && options.includes(answer) ? answer : options.length === 1 ? options[0] : undefined;
    answer = undefined;
    if (!picked) return effectData(next) ? askTarget(next, { instruction, seat, chosen: null, cause }, options) : { ...next, failure: "Preparing the fleet needs a choice, and no effect is asking" };
    next = updateCard(moveCard(next, picked, { zone: "play", seat }), picked, { face: dealtFace(next, next.cards[picked]?.code ?? "", "up") });
  }
}
