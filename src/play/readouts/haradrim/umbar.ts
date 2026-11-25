// Rules: rr.constant-ability, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 16014:A:2, 16016:A:1, 16040:A:1, 16045:A:2 (docs/scenarios/haradrim/escape-from-umbar.md, Table).
// The pieces Escape from Umbar's cards hold on the table: the enemy faceup under Narrow Alleyway (drawn under it in staging and as the active location, with a pill), the Champion (the enemy with the resource token of Southron Champion, a pill), each seat's hand against the limit
// of In Enemy Territory (a mark on its threat dial) and the loss "Seize Them!" holds (a pill on it). The engine decided every number (`handLimit`, `stageEntered`, the resource token); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { flagged, heldLeast, livingSeats, type CardInstance, type ScenarioState } from "../../../rules/core/state.ts";
import { cardsUnder } from "../../../rules/core/zones.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { stageInPlayWholeRound } from "../../../rules/families/haradrim/stage.ts";

import { ownerWords } from "../../words/owner.ts";
import { alleywayPill, CHAMPION_WORD, championWords, handLabel, handLimitWords, handWarning, SEIZE_WORD, seizeSpeech, underAlleywayWords } from "../../words/scenarios/haradrim/umbar-table.ts";
import type { HandMark } from "../isengard.ts";

export const NARROW_ALLEYWAY = "16016";
export const SOUTHRON_CHAMPION = "16040";
export const SEIZE_THEM = "16014";

/** The enemies faceup under Narrow Alleyway, wherever it lies: drawn under it like an attachment (empty for any other card). */
export const underAlleyway = (game: ScenarioState, cardId: string): readonly string[] => (game.cards[cardId]?.code === NARROW_ALLEYWAY ? cardsUnder(game, cardId) : []);

/** The pill on Narrow Alleyway that holds an enemy ("1 held"), or null. */
export function alleywayMark(game: ScenarioState, ctx: ReduceContext, cardId: string): ReturnType<typeof alleywayPill> | null {
  const held = underAlleyway(game, cardId);
  return held.length > 0 ? alleywayPill(held.map((id) => printedOf(ctx.cards, game.cards[id]?.code ?? "").name)) : null;
}

/** The line in the preview of a card lying under Narrow Alleyway, or null. */
export function underAlleywayLine(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  return card?.zone === "under" && card.host != null && game.cards[card.host]?.code === NARROW_ALLEYWAY ? underAlleywayWords(name(card.host)) : null;
}

const isChampion = (game: ScenarioState, card: CardInstance): boolean =>
  card.resources > 0 && (card.zone === "staging" || card.zone === "engaged") && Object.values(game.cards).some((other) => other.code === SOUTHRON_CHAMPION && other.zone === "staging");

/** The Champion: the enemy that holds the resource token while Southron Champion is in play. The cheap test (a resource token on an enemy in staging or engaged) comes first. */
export function championMark(game: ScenarioState, ctx: ReduceContext, cardId: string): { word: string; speech: string } | null {
  const card = game.cards[cardId];
  if (!card || card.face === "down" || !isChampion(game, card) || printedOf(ctx.cards, card.code).type !== "enemy") return null;
  return { word: CHAMPION_WORD, speech: championWords };
}

/** The pill on "Seize Them!": the main quest's progress is what keeps the players in the game. Threat red when none is on it and the stage has been in play the whole round. */
export function seizeMark(game: ScenarioState, cardId: string): { text: string; danger: boolean; speech: string } | null {
  const card = game.cards[cardId];
  if (card?.code !== SEIZE_THEM || card.zone !== "staging" || game.questStage == null) return null;
  const progress = game.cards[game.questStage]?.progress ?? 0;
  const danger = progress === 0 && stageInPlayWholeRound(game);
  return { text: SEIZE_WORD, danger, speech: seizeSpeech(progress, danger) };
}

/** Each living seat's hand against the limit while In Enemy Territory is in the staging area, for its threat dial's label and warning. Empty in any other scenario. */
export function umbarHands(game: ScenarioState): readonly HandMark[] {
  if (!flagged(game, "table", "handLimit")) return [];
  const limit = heldLeast(game, "table", "handLimit");
  const seats = livingSeats(game);
  return seats.map((seat) => {
    const count = game.seats[seat]?.hand.length ?? 0;
    const warn = handWarning(count, limit);
    return { seat, label: handLabel(seats.length > 1 ? seat : null, count, limit), note: handLimitWords(ownerWords(game.seatCount, seat), count, limit), ...(warn ? { warn } : {}) };
  });
}

/** The line a long press on a card of Escape from Umbar shows: the Champion's rules, what "Seize Them!" loses on, or where the enemy under Narrow Alleyway lies; null for any other card. */
export function umbarDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  return championMark(game, ctx, cardId)?.speech ?? seizeMark(game, cardId)?.speech ?? underAlleywayLine(game, cardId, name);
}
