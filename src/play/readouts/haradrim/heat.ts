// Rules: hrd.heat-tracker, rr.blank, rr.cannot (data/rules/entries.json); ledger lines 16068:A:1, 16068:B:3, 16069:B:2, 16070:B:3, 16053:A:1, 16048:A:1 (docs/scenarios/haradrim/desert-crossing.md, Table).
// The pieces Desert Crossing's cards hold on the table: the temperature as a top-bar dial against its limit of 60 (it warms as the pursuit dial does), the "Blank" pill on a damaged character under Craft Remedy and the line in the preview of a character
// that Find Water bars from readying by player card effects. The engine decided every number (the `temperature` table modifier, `blankText`, `cannotReadyByPlayerCard`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { inPlay, type ScenarioState } from "../../../rules/core/state.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { textBlank } from "../../../rules/families/attachments/hold.ts";
import { temperatureOf } from "../../../rules/families/haradrim/heat.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import { flaggedByClass } from "../../../rules/core/holder-classes.ts";

import { BLANK_WORD, blankWords, HEAT_LABEL, HEAT_LIMIT, HEAT_NAME, heatLimitWords, heatNearWords, heatWords, noReadyWords } from "../../words/scenarios/haradrim/heat-table.ts";
import type { TableDial } from "../dials.ts";

const SCENARIO = "desert-crossing";
export const CRAFT_REMEDY = "16053";
export const FIND_WATER = "16048";

/** The temperature dial: the value against 60, warm near the limit; none before Setup sets the tracker or in any other scenario. */
export function heatDials(game: ScenarioState): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const value = temperatureOf(game);
  if (value == null) return [];
  const near = value >= (HEAT_LIMIT * 4) / 5 ? { warn: { level: value >= (HEAT_LIMIT * 9) / 10 ? ("critical" as const) : ("near" as const), words: heatNearWords(value) } } : {};
  return [{ id: "heat", testID: "desert-heat", label: HEAT_LABEL, name: HEAT_NAME, value, limit: HEAT_LIMIT, warms: true, ...near, limitWords: heatLimitWords, note: heatWords(value) }];
}

const isCharacter = (game: ScenarioState, ctx: ReduceContext, cardId: string): boolean => holds(game, { kind: "matches", card: "self", pick: { type: "character", control: "any" } }, { actor: game.cards[cardId]?.controller ?? 0, sourceId: cardId, returned: 0 }, ctx);

// The name of the card of a code in play, for the lines that say where a bar comes from.
const inPlayName = (game: ScenarioState, ctx: ReduceContext, code: string): string | null => {
  const found = Object.values(game.cards).find((card) => card.code === code && inPlay(card.zone));
  return found ? printedOf(ctx.cards, found.code).name : null;
};

/** The pill on a damaged character whose text box Craft Remedy blanks, or null. The cheap tests first: this runs for every card in play. */
export function blankMark(game: ScenarioState, ctx: ReduceContext, cardId: string): { word: string; speech: string } | null {
  const card = game.cards[cardId];
  if (game.scenarioId !== SCENARIO || !card || !inPlay(card.zone) || card.face === "down" || card.damage <= 0) return null;
  const source = inPlayName(game, ctx, CRAFT_REMEDY);
  if (source == null || !textBlank(game, cardId, ctx.cards) || !isCharacter(game, ctx, cardId)) return null;
  return { word: BLANK_WORD, speech: blankWords(source) };
}

/** The line in the preview of a character that Find Water bars from readying by player card effects, or null. */
export function noReadyLine(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (game.scenarioId !== SCENARIO || !card || !inPlay(card.zone)) return null;
  const source = inPlayName(game, ctx, FIND_WATER);
  if (source == null || !flaggedByClass(game, card, printedOf(ctx.cards, card.code), "cannotReadyByPlayerCard")) return null;
  return isCharacter(game, ctx, cardId) ? noReadyWords(source) : null;
}

/** The line a long press on a card of Desert Crossing shows: the blank text box or the bar on readying; null for any other card. */
export function heatDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  return blankMark(game, ctx, cardId)?.speech ?? noReadyLine(game, ctx, cardId);
}
