// Rules: rm.attacks-against-nalir, rm.threat-elimination-level, rr.attacks-outside-the-combat-phase, rr.player-elimination, rr.step-6-4-3 (data/rules/entries.json); ledger lines 08067:B:2, 08083:A:1, 08066:B:2, 08066:B:4.
// What Trouble in Tharbad adds around Nalir and the threat dial: an attack made against Nalir, the check after the threat elimination level moves and the settle sweep that announces every player at 0 threat.
import { attackWith } from "../attack/immediate.ts";
import { eliminateEmpties } from "../../core/eliminate.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, livingSeats, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import { seatThreat } from "../play/hooks.ts";
import { effectsOfCard } from "../misc/text.ts";

/** The objective ally Nalir in play and the seat that controls him, or null when he is out of play or no player controls him. */
function nalirIn(state: ScenarioState, ctx: ReduceContext): { id: string; seat: number } | null {
  const card = Object.values(state.cards).find((candidate) => inPlay(candidate.zone) && candidate.controller != null && printedOf(ctx.cards, candidate.code).name === "Nalir");
  return card?.controller != null ? { id: card.id, seat: card.controller } : null;
}

/** The enemy `id` makes its immediate attack against the player who controls Nalir now (`onlyHeroes`: what no defender takes goes to him), or null when it cannot; the attack is counted by the running effect, so its frames wait for it. */
function beginNalirAttack(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[], enemy: string, rest: readonly string[]): ScenarioState | null {
  const nalir = nalirIn(state, ctx);
  if (!state.cards[enemy] || !nalir) return null;
  const begun = attackWith(state, enemy, ctx, steps, nalir.seat, 0, true);
  const attack = begun.pendingAttack;
  if (!attack || attack === state.pendingAttack) return null;
  return { ...begun, pendingAttack: { ...attack, onlyHeroes: [nalir.id], ...(rest.length > 0 ? { nalirAttackers: rest } : {}) } };
}

/**
 * AttackNalir (08067:B:2, 08083:A:1): the picked enemy (`enemy` names one the attack end left waiting), staged or engaged with any player, makes an immediate attack against the player who controls Nalir.
 * One attack is in progress at a time (Spy From Mordor's Forced at 6.4.1, 08072:A:1, can run this inside an attack): the enemy then waits in the attack's `nalirAttackers` and attacks once that attack has ended, as a shadow attacker does (defense/shadow-attack.ts).
 */
export function attackNalir(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[], named?: string): ScenarioState {
  const enemy = named ?? lastPicked(state);
  if (!enemy || !state.cards[enemy] || !nalirIn(state, ctx)) return state;
  const waiting = state.pendingAttack;
  if (waiting) return { ...state, pendingAttack: { ...waiting, nalirAttackers: [...(waiting.nalirAttackers ?? []), enemy] } };
  return beginNalirAttack(state, ctx, steps, enemy, []) ?? state;
}

/** The end of an attack: the first of `ids` that can attack Nalir attacks now, the ones after it wait on its attack. With none able the state stays as it is. */
export function startNalirAttacks(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[], ids: readonly string[]): ScenarioState {
  for (let at = 0; at < ids.length; at += 1) {
    const begun = beginNalirAttack(state, ctx, steps, ids[at]!, ids.slice(at + 1));
    if (begun) return begun;
  }
  return state;
}

/** EliminateAtLevel (08066:B:2): the level just went down, so each seat at or above it leaves the game now (rr.player-elimination). */
export function eliminateAtLevel(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  return eliminateEmpties(state, steps);
}

/** The settle hook of "When all players have 0 threat" (08066:B:4): `allThreatZero` is announced once nothing is resolving, every living player is at 0 and a record of the current quest stage hears it; the current stage's record advances the quest, after which no stage in play hears it. */
export function announceThreatZero(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure || state.stageCleared || !state.questStage) return state;
  const seats = livingSeats(state);
  if (seats.length === 0 || seats.some((seat) => seatThreat(state, seat) > 0)) return state;
  const stage = state.cards[state.questStage];
  if (!stage || !effectsOfCard(state, ctx, stage).some((effect) => effect.trigger === "allThreatZero") || (state.pendingEvents ?? []).some((event) => event.trigger === "allThreatZero")) return state;
  return queueEvent(state, { trigger: "allThreatZero", seat: state.firstPlayer });
}
