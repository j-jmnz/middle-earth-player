// Rules: dwd.ambush, rr.surge, rr.reveal (data/rules/entries.json); ledger lines 04043:A:1, 901408:A:1. "The first enemy revealed from the encounter deck each round gains ambush" (Goblin Gate) and "the first enemy with the ambush keyword revealed from the encounter deck each round gains surge"
// (Concealed Woods): the location's constant record FirstEnemyGains is the marker, as FirstTraitSurge is for a Trait (families/angmar/weather.ts). The engine notes the reveal as the card is revealed, before its When Revealed effects and before the surge check;
// the table remembers one was revealed until the round ends, and a game that deals a holder keeps that tally from the round's start whether or not the holder is in play or its condition holds (Reading 11 of The Weather Hills). Only a card the encounter deck itself
// revealed counts: not one found by a search, returned from the discard pile or revealed by an effect that names it.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { constantInstructions, constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { hasKeyword } from "../../core/keywords.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, modifierActive, type ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

const MARKER = "FirstEnemyGains" as const satisfies Instruction["verb"];

type Marker = Extract<Instruction, { verb: "FirstEnemyGains" }>;

// The tally a marker keeps: the round's first enemy of any kind, or its first with the ambush keyword.
const tallyOf = (marker: Marker): "enemyRevealed" | "ambushEnemyRevealed" => (marker.withKeyword === "ambush" ? "ambushEnemyRevealed" : "enemyRevealed");

const MARKERS = new WeakMap<readonly Effect[], readonly (Marker & { code: string })[]>();

function markersOf(ctx: Pick<ReduceContext, "effects">): readonly (Marker & { code: string })[] {
  let found = MARKERS.get(ctx.effects);
  if (!found) {
    found = ctx.effects.filter((effect) => effect.timing === "constant").flatMap((effect) => effect.instructions.flatMap((instruction) => (instruction.verb === MARKER ? [{ ...instruction, code: effect.cardCode }] : [])));
    MARKERS.set(ctx.effects, found);
  }
  return found;
}

// Whether the game deals a card holding a marker of this tally that can enter play by a reveal this round: one in play, or an encounter card dealt in a pile, not a removed one.
function holderDealt(state: ScenarioState, tally: string, ctx: ReduceContext): boolean {
  const codes = new Set(markersOf(ctx).filter((marker) => tallyOf(marker) === tally).map((marker) => marker.code));
  return Object.values(state.cards).some((card) => codes.has(card.code) && (inPlay(card.zone) || (card.zone !== "removed" && printedOf(ctx.cards, card.code).type !== "quest")));
}

// Whether a marker of this tally is in force now (its constant record's own condition holds: the location is the active one).
function markerHolds(state: ScenarioState, marker: "ambush" | "surge", tally: string, ctx: ReduceContext): boolean {
  return constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === MARKER && instruction.keyword === marker && tallyOf(instruction) === tally);
}

function tallied(state: ScenarioState, tally: string): boolean {
  return state.modifiers.some((modifier) => modifier.stat === tally && modifier.amount > 0 && modifierActive(state, modifier));
}

/**
 * An enemy was revealed (the `revealed` hook): the first enemy the encounter deck reveals in a round of a game that deals a holder is noted for the round (`enemyRevealed`) and gains ambush when a marker's condition holds, for the rest of the round (`gainsAmbush`); the
 * first with the ambush keyword, the one just given included, is noted the same way (`ambushEnemyRevealed`) and gains surge as it is revealed.
 */
export function noteFirstEnemy(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || top?.data.kind !== "reveal" || top.cardId !== cardId || top.data.fromDeck !== true || constantVerbCodes(ctx, MARKER).size === 0 || printedOf(ctx.cards, card.code).type !== "enemy") return state;
  let next = state;
  if (!tallied(next, "enemyRevealed") && holderDealt(next, "enemyRevealed", ctx)) {
    next = { ...next, modifiers: [...next.modifiers, { instanceId: "table", sourceId: cardId, stat: "enemyRevealed" as const, amount: 1, until: "endOfRound" as const }] };
    if (markerHolds(next, "ambush", "enemyRevealed", ctx)) next = { ...next, modifiers: [...next.modifiers, { instanceId: cardId, sourceId: cardId, stat: "gainsAmbush" as const, amount: 1, until: "endOfRound" as const }] };
  }
  if (hasKeyword(next, cardId, "ambush", ctx.cards) && !tallied(next, "ambushEnemyRevealed") && holderDealt(next, "ambushEnemyRevealed", ctx)) {
    next = { ...next, modifiers: [...next.modifiers, { instanceId: "table", sourceId: cardId, stat: "ambushEnemyRevealed" as const, amount: 1, until: "endOfRound" as const }] };
    if (markerHolds(next, "surge", "ambushEnemyRevealed", ctx)) next = markSurge(next, cardId);
  }
  return next;
}
