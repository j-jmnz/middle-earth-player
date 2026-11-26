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

/**
 * AttackNalir (08067:B:2, 08083:A:1): the last picked enemy, staged or engaged with any player, makes an immediate attack against the player who controls Nalir; the attack is made against Nalir, so what no defender takes goes to him (`onlyHeroes`, read by the undefended step).
 * The attack is counted by the running effect, so its frames wait for it.
 */
export function attackNalir(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemy = lastPicked(state);
  const nalir = nalirIn(state, ctx);
  if (!enemy || !state.cards[enemy] || !nalir || state.pendingAttack != null) return state;
  const begun = attackWith(state, enemy, ctx, steps, nalir.seat, 0, true);
  const attack = begun.pendingAttack;
  return attack && attack !== state.pendingAttack ? { ...begun, pendingAttack: { ...attack, onlyHeroes: [nalir.id] } } : begun;
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
