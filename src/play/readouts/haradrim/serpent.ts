// Rules: rr.engaged, rr.guarded, rr.objective-cards, hrd.stage-number (data/rules/entries.json); ledger lines 17094:A:1, 17094:A:2, 17107:B:2, 17091:A:1 (docs/scenarios/haradrim/the-black-serpent.md, Table).
// What the table reads of The Black Serpent's pieces from the state's own facts, never a card code: the enemy that is considered engaged with the players who control an objective (`engagedWithClaimers`), the stage-number enemy that cannot leave the staging area (`neverEngaged`) with its totals, the objective an encounter card guards, and the cards that carry objectives.
// The engine decided every one and nothing here changes one. Pure, so a test reads it.
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { consideredEngagedSeats } from "../../../rules/core/engaged.ts";
import { flagged, inPlay, livingSeats, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import { addsNoThreatNote, consideredChipText, consideredEmptyWord, consideredPreview, consideredSpeech, GUARDED_CHIP, guardedSpeech, totalsWords } from "../../words/scenarios/haradrim/serpent-table.ts";

/** The living seats a staging enemy is considered engaged with because they control an objective; none for any other card. */
export function claimerSeats(game: ScenarioState, cardId: string): number[] {
  if (!flagged(game, cardId, "engagedWithClaimers")) return [];
  return consideredEngagedSeats(game, cardId, livingSeats(game));
}

const whoWords = (game: ScenarioState, seats: readonly number[]): string => (game.seatCount > 1 ? seats.map((seat) => `Player ${seat + 1}`).join(" and ") : "you");

/** The chip on a staging enemy considered engaged: its words and the reader's. */
export function consideredChip(game: ScenarioState, cardId: string): { chip: string; speech: string } | null {
  const seats = claimerSeats(game, cardId);
  return seats.length > 0 ? { chip: consideredChipText(seats, game.seatCount), speech: consideredSpeech(seats, game.seatCount) } : null;
}

// The encounter cards that guard the objective: attached to it as its guard and in play, wherever they stand (an engaged guard stays attached).
const guardIds = (game: ScenarioState, cardId: string): string[] => (game.cards[cardId]?.attachments ?? []).filter((id) => game.cards[id]?.guard === true && game.cards[id]?.host === cardId && inPlay(game.cards[id]?.zone ?? "removed"));

/** The "Guarded" chip on an objective an encounter card guards, naming the guard for the reader. */
export function guardedChip(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): { chip: string; speech: string } | null {
  const card = game.cards[cardId];
  if (!card || card.zone !== "staging" || printedOf(ctx.cards, card.code).type !== "objective") return null;
  const guards = guardIds(game, cardId);
  return guards.length > 0 ? { chip: GUARDED_CHIP, speech: guardedSpeech(guards.map(name)) } : null;
}

/** The empty engagement area's word: with a staging enemy considered engaged with the seat it says so, else "No enemy engaged". */
export function emptyEngagedWord(game: ScenarioState, seat: number, name: (id: string) => string): string {
  const considered = game.staging.filter((id) => claimerSeats(game, id).includes(seat));
  return considered.length > 0 ? consideredEmptyWord(considered.map(name), game.seatCount > 1 ? `Player ${seat + 1}` : "you") : "No enemy engaged";
}

/** The quest readout's note: each staging enemy that is considered engaged with the seat and adds no Threat. Empty with none. */
export function addsNoThreatNotes(game: ScenarioState, seat: number, name: (id: string) => string): string {
  const quiet = game.staging.filter((id) => claimerSeats(game, id).includes(seat) && flagged(game, id, "noThreatContribution"));
  return quiet.map((id) => ` · ${addsNoThreatNote(name(id), game.seatCount > 1 ? `Player ${seat + 1}` : "you")}`).join("");
}

const STATS = [["threat", "Threat"], ["attack", "Attack"], ["defense", "Defense"]] as const;

/**
 * The preview line of The Black Serpent: its totals while the stage number adds to them, then whom it is considered engaged with. Null for any card that cannot leave the staging area with the flag `neverEngaged`.
 * The Threat it adds to the staging area is said by the engine's own sum (the dial), so this line only says the stat.
 */
export function serpentDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card || !inPlay(card.zone) || !flagged(game, cardId, "neverEngaged")) return null;
  const totals = totalsWords(STATS.map(([key, label]) => ({ name: label, value: modifiedStat(game, card, key, ctx.cards) })), game.questStage != null);
  const seats = claimerSeats(game, cardId);
  const engaged = seats.length > 0 ? consideredPreview(whoWords(game, seats), !flagged(game, cardId, "noThreatContribution")) : "";
  return engaged ? `${totals} ${engaged}` : totals;
}
