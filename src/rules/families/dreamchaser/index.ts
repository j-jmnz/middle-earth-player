// Rules: dcce.gaining-xp, dcce.hard-expert (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import type { XpCount } from "../../../catalog/families/dreamchaser.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { tokensOn } from "../campaign/index.ts";
import { flippedCount } from "../island/pick.ts";

// The verbs src/catalog/families/dreamchaser.ts adds. GainXp is a Resolution verb: rules/setup/resolution.ts runs it (xpOf below), so it changes
// nothing here.
export function run(state: ScenarioState, instruction: Instruction): ScenarioState | null {
  return instruction.verb === "GainXp" ? state : null;
}

function countOf(state: ScenarioState, each: XpCount): number {
  if (each.kind === "survivingPlayer") return livingSeats(state).length;
  if (each.kind === "tokens") return tokensOn(state, each.code);
  if (each.kind === "islandFaceup") return flippedCount(state, each.code);
  return state.victory.filter((id) => each.codes.includes(state.cards[id]?.code ?? "")).length;
}

// The XP one GainXp line is worth in this game: its amount once, or for each of what it counts, never past `max` (a line that takes XP away,
// "-1 XP", has a negative amount; `max` caps what it can give).
export function xpOf(state: ScenarioState, instruction: Extract<Instruction, { verb: "GainXp" }>): number {
  const total = instruction.amount * (instruction.each ? countOf(state, instruction.each) : 1);
  return instruction.max != null ? Math.min(total, instruction.max) : total;
}

// "After a player draws any number of cards" (dcce.hard-expert, 143048:A:1, 143059:A:1): the draw from `before` to `after` is announced with the number of cards drawn as its amount, only while a mode card is in the
// game or a card in the game has a record that hears it (no other game announces it). The event is stamped with the clock, so a card that enters play after the draw does not hear it (a Forced effect must be in
// play and active when its trigger occurs, rr.forced), and with whether a player card's effect drew them.
export function announceDraw(before: ScenarioState, after: ScenarioState, seat: number, ctx: ReduceContext, byPlayerCard: boolean): ScenarioState {
  if (!Object.values(after.cards).some((card) => card.zone === "modeCard") && !gameReads(after, ctx, '"trigger":"cardsDrawn"')) return after;
  const got = (after.seats[seat]?.hand.length ?? 0) - (before.seats[seat]?.hand.length ?? 0);
  return got > 0 ? queueEvent(after, { trigger: "cardsDrawn", seat, amount: got, at: after.clock, ...(byPlayerCard ? { byPlayerCard: true as const } : {}) }) : after;
}

// What a card was dealt and a seat was relieved of this round (the flags damageCap, threatReductionCap and playerThreatReductionCap) lasts one round: the new round clears it.
export function pruneRoundCaps(state: ScenarioState): ScenarioState {
  if (state.roundDamage == null && state.threatLoweredBy == null && state.playerThreatLoweredBy == null) return state;
  const { roundDamage: _damage, threatLoweredBy: _lowered, playerThreatLoweredBy: _player, ...rest } = state;
  return rest;
}

export const manifest: RulesFamily = { name: "dreamchaser", verbs: ["GainXp"], run };
