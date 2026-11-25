// Rules: hrd.heat-tracker, rr.blank, rr.cannot (data/rules/entries.json); ledger lines 16068:A:1, 16068:B:3, 16069:B:2, 16070:B:3, 16053:A:1, 16048:A:1 (docs/scenarios/haradrim/desert-crossing.md, Table).
// The pieces Desert Crossing's cards hold on the table: the temperature as a top-bar dial against its limit of 60 (it warms as the pursuit dial does), the "Blank" pill on a damaged character under Craft Remedy and the line in the preview of a character
// that Find Water bars from readying by player card effects. The engine decided every number (the `temperature` table modifier, `blankText`, `cannotReadyByPlayerCard`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { ModifierStat } from "../../../catalog/boundary.ts";
import { inPlay, modifierActive, type ScenarioState } from "../../../rules/core/state.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { temperatureOf } from "../../../rules/families/haradrim/heat.ts";
import { heldBy } from "../../../rules/core/holder-classes.ts";

import { BLANK_WORD, blankWords, HEAT_LABEL, HEAT_LIMIT, HEAT_NAME, heatLimitWords, heatNearWords, heatWords, noReadyWords } from "../../words/scenarios/haradrim/heat-table.ts";
import type { TableDial } from "../dials.ts";


/** The temperature dial: the value against the limit the stage's loss record reads, warm near the limit; none while no tracker is set (before Setup, or in any other scenario). */
export function heatDials(game: ScenarioState): readonly TableDial[] {
  const value = temperatureOf(game);
  if (value == null) return [];
  const level = value >= (HEAT_LIMIT * 9) / 10 ? ("critical" as const) : ("near" as const);
  const near = value >= (HEAT_LIMIT * 4) / 5 ? { warn: { level, words: heatNearWords(value) } } : {};
  return [{ id: "heat", testID: "desert-heat", label: HEAT_LABEL, name: HEAT_NAME, value, limit: HEAT_LIMIT, warms: true, ...near, limitWords: heatLimitWords, note: heatWords(value) }];
}

// The active modifiers of a stat that reach the card (its own or its class's), each with the name of the card that put it there: the engine's own facts (`blankText`, `cannotReadyByPlayerCard`), whichever scenario's card made them.
function holders(game: ScenarioState, ctx: ReduceContext, cardId: string, stat: ModifierStat): readonly string[] {
  const card = game.cards[cardId];
  if (!card || !inPlay(card.zone) || card.face === "down") return [];
  const printed = printedOf(ctx.cards, card.code);
  const sources = game.modifiers.filter((modifier) => modifier.stat === stat && modifier.amount > 0 && modifierActive(game, modifier) && heldBy(modifier, card, printed)).map((modifier) => game.cards[modifier.sourceId]);
  return Array.from(new Set(sources.flatMap((source) => (source ? [printedOf(ctx.cards, source.code).name] : []))));
}

/** The pill on a card whose text box a `blankText` modifier blanks (Craft Remedy on a damaged character), or null. The cheap test first: this runs for every card in play. */
export function blankMark(game: ScenarioState, ctx: ReduceContext, cardId: string): { word: string; speech: string } | null {
  if (!game.modifiers.some((modifier) => modifier.stat === "blankText")) return null;
  const sources = holders(game, ctx, cardId, "blankText");
  return sources.length > 0 ? { word: BLANK_WORD, speech: blankWords(sources.join(", ")) } : null;
}

/** The line in the preview of a card a `cannotReadyByPlayerCard` modifier bars from readying by player card effects (Find Water, and the other scenarios' bars), or null. */
export function noReadyLine(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  if (!game.modifiers.some((modifier) => modifier.stat === "cannotReadyByPlayerCard")) return null;
  const sources = holders(game, ctx, cardId, "cannotReadyByPlayerCard");
  return sources.length > 0 ? noReadyWords(sources.join(", ")) : null;
}

/** The line a long press on a card of Desert Crossing shows: the blank text box or the bar on readying; null for any other card. */
export function heatDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  return blankMark(game, ctx, cardId)?.speech ?? noReadyLine(game, ctx, cardId);
}
