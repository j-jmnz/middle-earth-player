// Rules: ats.controlling-locations, ats.losing-control-of-locations, rr.explored, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.travel, rr.active-location, rr.player-elimination (data/rules/entries.json); ledger lines 06091:B:2, 06093:A:1, 06103:A:1, 06103:A:2, 06105:A:1
// (docs/scenarios/against-the-shadow/assault-on-osgiliath.md, Engine notes).
// A location a player controls lies in his play area (a seat's `play` list), faceup, with its text working. TakeControlOfLocation puts it there and notes the seat on the card (the flag `controlSeat`, the seat plus 1); the control is lost when the location is
// in no play area any more. Every way to lose it is seen in one place, the settle sweep: a record that returns the location (LoseControlOfLocation, ReturnToStaging on the card itself), a travel to it or a card that makes it the active location (West Gate), and
// the cards of an eliminated player, which the core sends to the encounter discard pile. A loss removes the progress, leaves the location in the staging area and announces `controlLost` for the seat that held it.
import type { Instruction } from "../../../catalog/boundary.ts";
import type { TravelCharge } from "../../interpret/family-manifest.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { heldAmount, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { TOWER } from "./ruined-tower.ts";
import { queueEvent } from "../../windows/queue.ts";
import { patchTop } from "../../windows/windows.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

const CONTROLLED_BY = "controlSeat" as const;

function isLocation(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  return card != null && printedOf(ctx.cards, card.code).type === "location";
}

/** The seat that controls the location, noted when it took control, or null when no player does. */
export function controllerOf(state: ScenarioState, id: string): number | null {
  const held = heldAmount(state, id, CONTROLLED_BY);
  return held > 0 ? held - 1 : null;
}

/** The locations a player controls now: in the play area of the seat that took control. */
export function controlledLocations(state: ScenarioState): string[] {
  return state.modifiers.flatMap((modifier) => {
    if (modifier.stat !== CONTROLLED_BY) return [];
    const card = state.cards[modifier.instanceId];
    return card?.zone === "play" && card.controller === modifier.amount - 1 ? [card.id] : [];
  });
}

function noted(state: ScenarioState, id: string, seat: number | null): ScenarioState {
  const rest = state.modifiers.filter((modifier) => !(modifier.stat === CONTROLLED_BY && modifier.instanceId === id));
  const modifiers = seat == null ? rest : [...rest, { instanceId: id, sourceId: id, stat: CONTROLLED_BY, amount: seat + 1, until: "endOfGame" as const }];
  return rest.length === state.modifiers.length && seat == null ? state : { ...state, modifiers };
}

/** TakeControlOfLocation: the named location enters the first player's play area, faceup, ready and with no progress; nothing happens for a card in a play area already or one that is no location. */
export function takeControlOfLocation(state: ScenarioState, instruction: Verb<"TakeControlOfLocation">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const id = refCard(state, instruction.card ?? "subject", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.zone === "play" || !isLocation(state, id, ctx)) return state;
  const seat = state.firstPlayer;
  const moved = updateCard(moveCard(state, id, { zone: "play", seat }), id, { face: "up", exhausted: false, progress: 0 });
  return noted(moved, id, seat);
}

/** The control of the location is lost: no progress, in the staging area, nobody controls it, and `controlLost` is announced for the seat that held it. */
function lose(state: ScenarioState, id: string, seat: number): ScenarioState {
  const card = state.cards[id];
  if (!card) return noted(state, id, null);
  const staged = card.zone === "staging" ? state : moveCard(state, id, { zone: "staging" });
  const cleared = updateCard(staged, id, { progress: 0, controller: null });
  return queueEvent(noted(cleared, id, null), { trigger: "controlLost", seat, subject: id });
}

/** LoseControlOfLocation: the named location, if a player controls it, goes to the staging area as a loss of control says. */
export function loseControlOfLocation(state: ScenarioState, instruction: Verb<"LoseControlOfLocation">, focus: Focus): ScenarioState {
  const id = refCard(state, instruction.card ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  const seat = id ? controllerOf(state, id) : null;
  const card = id ? state.cards[id] : undefined;
  return id && seat != null && card?.zone === "play" ? lose(state, id, seat) : state;
}

/** A controlled location explored again is taken by the first player as he is now (06091:B:2 "the first player takes control"): when that is another seat than the one that held it, that seat loses control of it, which `controlLost` announces (06103:A:2 hears every loss of control). */
function takenAgain(state: ScenarioState, id: string, held: number): ScenarioState {
  const seat = state.seats[state.firstPlayer]?.eliminated === true ? held : state.firstPlayer;
  const taken = noted(updateCard(moveCard(state, id, { zone: "play", seat }), id, { face: "up", exhausted: false, progress: 0 }), id, seat);
  return seat === held ? taken : queueEvent(taken, { trigger: "controlLost", seat: held, subject: id });
}

/** The settle sweep: a location with a noted controller that lies in no play area has been lost. A location that was explored while controlled (progress full: it went to the discard pile or the victory display of a living player) is taken again at once, with no loss
 * (06091:B:2 hears it too, and finds it in play). A location in the discard pile of an eliminated player (core clearEliminated) or anywhere else is lost. Inert unless the game has a record that takes control. */
export function controlSweep(state: ScenarioState, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || !gameReads(state, ctx, '"TakeControlOfLocation"')) return state;
  let next = state;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== CONTROLLED_BY) continue;
    const id = modifier.instanceId;
    const seat = modifier.amount - 1;
    const card = next.cards[id];
    if (!card || (card.zone === "play" && card.controller === seat)) continue;
    const living = next.seats[seat]?.eliminated !== true;
    const explored = living && (card.zone === "encounterDiscard" || card.zone === "victory");
    next = explored ? takenAgain(next, id, seat) : lose(next, id, seat);
  }
  return next;
}

/** The locations a player controls are places the players may travel to (Caleb, FFG: "the rules for the scenario do allow it"; the control is lost as the location leaves the play area). */
export function controlledTravelReach(state: ScenarioState, ctx: ReduceContext): readonly string[] {
  return state.modifiers.length === 0 || !gameReads(state, ctx, '"TakeControlOfLocation"') ? [] : controlledLocations(state);
}

/** Traveling to a location a player controls first takes it out of his play area: the control is lost (progress removed, in the staging area), then the location's own Travel line and the travel itself follow as for any location in the staging area (Caleb: "You would lose control of the location when it leaves your play area"). */
export function controlledTravelCost(state: ScenarioState, ctx: ReduceContext, locationId: string | null): TravelCharge | null {
  if (locationId == null || state.modifiers.length === 0 || state.cards[locationId]?.zone !== "play" || !controlledTravelReach(state, ctx).includes(locationId)) return null;
  return { source: locationId, instructions: [{ verb: "LoseControlOfLocation", card: "self" }] };
}

/** Ruined Tower may be traveled to as a second active location: exactly 1 active location is there and the second slot is free ("If there is 1 active location, exhaust a character to travel here. (There are now 2 active locations.)", 06103:A:1, faq.two-active-locations). */
export function towerSecond(state: ScenarioState, locationId: string): boolean {
  return state.cards[locationId]?.code === TOWER && state.activeLocation != null && state.secondActiveLocation == null;
}

/** AnnounceAddedToStaging: the named card, if it lies in the staging area, is announced as added there (`addedToStaging`), so its own Forced effect hears it. Opt-in: SearchMove announces only an ambush enemy, so no other record changes. */
export function announceAddedToStaging(state: ScenarioState, instruction: Verb<"AnnounceAddedToStaging">, focus: Focus): ScenarioState {
  const id = refCard(state, instruction.card ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  if (!id || state.cards[id]?.zone !== "staging") return state;
  // The card is announced once: the pick is cleared, so a later player's search that finds no enemy does not announce it again.
  const announced = queueEvent(state, { trigger: "addedToStaging", seat: focus.seat, cardId: id });
  const data = effectData(announced);
  return data && (instruction.card ?? "picked") === "picked" ? patchTop(announced, { data: { ...data, picked: (data.picked ?? []).filter((picked) => picked !== id) } }) : announced;
}

/** ActForDestroyedController: the player who controlled the character the attack destroyed (the effect's `destroyedCharacter`, which a shadow effect with this verb is given) acts for the instructions that follow, as for a Pick of "his" locations. With no destroyed character the actor stays. */
export function actForDestroyedController(state: ScenarioState): ScenarioState {
  const data = effectData(state);
  const seat = data?.destroyedCharacter ? state.cards[data.destroyedCharacter]?.controller : null;
  return seat == null || !data ? state : patchTop(state, { data: { ...data, queue: data.queue.map((item) => ({ ...item, seat })) } });
}
