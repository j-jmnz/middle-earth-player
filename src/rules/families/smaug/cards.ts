// Rules: docs/brief.md (The Battle of Lake-town; the Smaug deck and Burn X come from the Quest Companion), rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 50207:A:1, 50204:A:1, 50203:B:3.
// The cards of The Battle of Lake-town the family reads: the Lake-town objective (damage tokens go on it, never dealt) and the Smaug in play, in the staging area or engaged. Pure lookups.
import { victoryPointsOf } from "../../core/printed-stat.ts";
import type { PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount, inPlay, livingSeats } from "../../core/state.ts";

/** Lake-town (50207), the objective in the staging area that takes the damage. */
export const LAKE_TOWN = "50207";
/** The three Smaug cards (the Mighty, the Terrible, the Magnificent): enemies of the Smaug deck. */
export const SMAUG_CODES: ReadonlySet<string> = new Set(["50204", "50205", "50206"]);

/** The Lake-town card in play, or null when the game has none. */
export function lakeTownId(state: ScenarioState): string | null {
  return Object.values(state.cards).find((card) => card.code === LAKE_TOWN && inPlay(card.zone))?.id ?? null;
}

/** Whether the card is one of the Smaug cards. */
export function isSmaug(state: ScenarioState, id: string): boolean {
  const code = state.cards[id]?.code;
  return code != null && SMAUG_CODES.has(code);
}

/** The Smaug in play (staging area or engaged), or null: at most one lies there, since a new one takes the old one's damage and discards it (docs/brief.md, The Battle of Lake-town). */
export function smaugInPlay(state: ScenarioState): string | null {
  return Object.values(state.cards).find((card) => SMAUG_CODES.has(card.code) && (card.zone === "staging" || card.zone === "engaged"))?.id ?? null;
}

/** The damage tokens on Lake-town, 0 without it. */
export function lakeTownDamage(state: ScenarioState): number {
  const id = lakeTownId(state);
  return id == null ? 0 : (state.cards[id]?.damage ?? 0);
}

/** The damage on Lake-town that loses the game: its record's `loseAtDamage`, 50 while the game holds none (50207:A:1). */
export function lakeTownLimit(state: ScenarioState): number {
  const id = lakeTownId(state);
  const held = id == null ? 0 : heldAmount(state, id, "loseAtDamage");
  return held > 0 ? held : 50;
}

/** The Victory points of the cards in the victory display (stage 3B's score, 50203:B:3). */
export function victoryPoints(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): number {
  return state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, cards), 0);
}

/** The players still in the game in turn order, from the first player. */
export function turnOrder(state: ScenarioState): number[] {
  const living = livingSeats(state);
  const from = living.indexOf(state.firstPlayer);
  return from < 0 ? living : [...living.slice(from), ...living.slice(0, from)];
}

/** The last player: the one who plays last in turn order, the first player alone (docs/brief.md, The Battle of Lake-town; the player who may defend Smaug's attack against Lake-town, 50211:A:1). */
export function lastSeat(state: ScenarioState): number {
  return turnOrder(state).at(-1) ?? state.firstPlayer;
}
