// Rules: rr.constant-ability, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 16014:A:2, 16016:A:1, 16040:A:1, 16045:A:2 (docs/scenarios/haradrim/escape-from-umbar.md, Table).
// The pieces Escape from Umbar's cards hold on the table: the enemy faceup under Narrow Alleyway (drawn under it in staging and as the active location, with a pill), the Champion (the enemy with the resource token of Southron Champion, a pill), each seat's hand against the limit
// of In Enemy Territory (a mark on its threat dial) and the loss "Seize Them!" holds (a pill on it). The engine decided every number (`handLimit`, `stageEntered`, the resource token); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { flagged, heldLeast, livingSeats, modifierActive, type CardInstance, type ScenarioState } from "../../../rules/core/state.ts";
import { cardsUnder } from "../../../rules/core/zones.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { ownerWords } from "../../words/owner.ts";
import { alleywayPill, CHAMPION_WORD, championWords, handLabel, handLimitWords, handWarning, HELD_ROLE, SEIZE_WORD, seizeSpeech, underAlleywayWords } from "../../words/scenarios/haradrim/umbar-table.ts";
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

/** The role of a card lying under Narrow Alleyway in a preview, or null. */
export function underAlleywayRole(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  return card?.zone === "under" && card.host != null && game.cards[card.host]?.code === NARROW_ALLEYWAY ? HELD_ROLE : null;
}

/** The line in the preview of a card lying under Narrow Alleyway, or null. */
export function underAlleywayLine(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  return card?.zone === "under" && card.host != null && game.cards[card.host]?.code === NARROW_ALLEYWAY ? underAlleywayWords(name(card.host)) : null;
}

// The Champion is the enemy Southron Champion's records modify: the immunity its When Revealed record puts on the enemy, while that card is in play (`modifierActive`). The pill reads the engine's own modifier.
const isChampion = (game: ScenarioState, card: CardInstance): boolean =>
  (card.zone === "staging" || card.zone === "engaged") &&
  game.modifiers.some((modifier) => modifier.instanceId === card.id && modifier.stat === "immuneToPlayerCards" && game.cards[modifier.sourceId]?.code === SOUTHRON_CHAMPION && modifierActive(game, modifier));

/** The Champion: the enemy Southron Champion's records modified (+2 and the immunity). The cheap test (a modifier of that card) comes first. */
export function championMark(game: ScenarioState, ctx: ReduceContext, cardId: string): { word: string; speech: string } | null {
  const card = game.cards[cardId];
  if (!card || card.face === "down" || !isChampion(game, card) || printedOf(ctx.cards, card.code).type !== "enemy") return null;
  return { word: CHAMPION_WORD, speech: championWords };
}

/** The pill on "Seize Them!": the main quest's progress is what keeps the players in the game. Threat red when the condition of its loss record (16014:triggered:1) holds now. */
export function seizeMark(game: ScenarioState, ctx: ReduceContext, cardId: string): { text: string; danger: boolean; speech: string } | null {
  const card = game.cards[cardId];
  if (card?.code !== SEIZE_THEM || card.zone !== "staging" || game.questStage == null) return null;
  const progress = game.cards[game.questStage]?.progress ?? 0;
  const loss = effectsOf(ctx, SEIZE_THEM).find((effect) => effect.id === "16014:triggered:1");
  const danger = loss?.condition != null && holds(game, loss.condition, { actor: 0, sourceId: cardId, returned: 0 }, ctx);
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
  return championMark(game, ctx, cardId)?.speech ?? seizeMark(game, ctx, cardId)?.speech ?? underAlleywayLine(game, cardId, name);
}
