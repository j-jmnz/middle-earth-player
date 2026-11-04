// Rules: rr.in-play-and-out-of-play, dcce.ship-enemies (data/rules/entries.json); ledger line 12129:A:2. "Choose a Ship enemy that is not guarding an objective. While Belfalas Islet is the active location,
// the chosen enemy is considered to be out of play": the enemy goes facedown under the location, out of play as any card under a location is (the Weather Hills, The Havens Burn), so no ability reads it,
// counts it, engages it or is made by it. It is not discarded: the location holds where it stood (SeaState.held), and a settle sweep puts it back there, in the staging area or engaged with its player, the
// moment the location is no longer the active location (the players traveled elsewhere, it was explored or it left play). The tokens it had are gone, as for a card that comes back into play (rr.in-play-and-out-of-play).
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard, unhost } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import type { HeldEnemy } from "./types.ts";

const isActive = (state: ScenarioState, id: string): boolean => state.activeLocation === id || state.secondActiveLocation === id;

/** ConsiderOutOfPlay: the last picked enemy, in the staging area or engaged, goes under the source location while it is the active location. Nothing happens for another card or location. */
export function considerOutOfPlay(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const enemy = state.cards[lastPicked(state)];
  const location = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!enemy || !location || !isActive(state, location.id) || printedOf(ctx.cards, enemy.code).type !== "enemy") return state;
  if (enemy.zone !== "staging" && enemy.zone !== "engaged") return state;
  const origin: HeldEnemy = { zone: enemy.zone, seat: enemy.zone === "engaged" ? enemy.controller : null };
  const held = moveCard(state, enemy.id, { zone: "under", locationId: location.id });
  const sea = held.sea ?? { heading: null, headingCard: null, routes: {} };
  return { ...held, sea: { ...sea, held: { ...sea.held, [enemy.id]: origin } } };
}

/** The settle sweep: each enemy a location holds out of play whose location is no longer active goes back where it stood (the staging area when the player it was engaged with is gone). */
export function releaseHeld(state: ScenarioState): ScenarioState {
  const held = state.sea?.held;
  if (!held || !state.sea) return state;
  let next = state;
  const kept: Record<string, HeldEnemy> = {};
  let changed = false;
  for (const [id, origin] of Object.entries(held)) {
    const card = next.cards[id];
    // An enemy that is no longer under a location (it left by another card) is not the sea family's any more.
    if (!card || card.zone !== "under") {
      changed = true;
      continue;
    }
    if (card.host != null && isActive(next, card.host)) {
      kept[id] = origin;
      continue;
    }
    const seat = origin.seat != null && origin.zone === "engaged" && next.seats[origin.seat]?.eliminated !== true ? origin.seat : null;
    changed = true;
    next = updateCard(unhost(moveCard(next, id, seat != null ? { zone: "engaged", seat } : { zone: "staging" }), id), id, { face: "up" });
  }
  if (!changed) return state;
  const remaining = Object.keys(kept).length;
  const { held: _held, ...sea } = next.sea ?? state.sea;
  return { ...next, sea: remaining > 0 ? { ...sea, held: kept } : sea };
}
