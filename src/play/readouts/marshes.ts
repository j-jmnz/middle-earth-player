// Rules: mec112.mire, mec112.gollum-smeagol (data/rules/entries.json); ledger lines 144019:A:1, 144022:A:2, 144064:B:1, 144075:A:1, 144075:A:3, 144076:A:1.
//
// The pieces of The Passage of the Marshes' table (docs/design-system-table.md, Cards, The Passage of the Marshes): the Mire dial (the mire tokens on the location closest to its Mire X, each location's count in its spoken words),
// Gollum's hit points as a goal dial (his defeat is the gate of stage 1B), and the seat that holds the card Gollum / Sméagol: its dial's held mark says Gollum is engaged with it, or that it controls Sméagol. The engine decided every number
// (`mireTally`, `modifiedStat`); nothing here changes one. Pure, so a test reads it.
import { useMemo } from "react";

import { inPlay } from "../../rules/core/state.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { mireTally } from "../../rules/families/mire/index.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { GOLLUM_WORDS, gollumHeldWords, mireWords, type MireRow } from "../words/scenarios/marshes.ts";
import type { IsengardDial } from "./isengard.ts";
import type { HeldDial } from "./widgets.ts";

const GOLLUM = "144075";
const SMEAGOL = "144076";

/**
 * The dials The Passage of the Marshes' pieces hold now, in the order the top bar draws them: Mire (a location in the staging area or the active one with the keyword), then Gollum's hit points while he is an enemy in play.
 * The Mire dial warms toward its limit (no goal): a location that reaches it is discarded. Empty in any other scenario.
 */
export function marshesDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly IsengardDial[] {
  const dials: IsengardDial[] = [];
  const places = [...game.staging, ...(game.activeLocation ? [game.activeLocation] : [])];
  const rows = places.flatMap((id) => {
    const tally = mireTally(game, id);
    const card = game.cards[id];
    return tally && card ? [{ name: nameOf(card.code), tokens: tally.tokens, limit: tally.value }] : [];
  });
  if (rows.length > 0) {
    // The nearest to its limit: the fewest tokens left, a bigger limit first among equals (its number reads against the larger X).
    const nearest = rows.reduce<MireRow>((best, row) => (row.limit - row.tokens < best.limit - best.tokens || (row.limit - row.tokens === best.limit - best.tokens && row.limit > best.limit) ? row : best), rows[0]!);
    dials.push({ id: "mire", testID: "marshes-mire", label: "Mire", name: `Mire tokens on ${nearest.name}, the location closest to its limit`, value: nearest.tokens, limit: nearest.limit, limitWords: mireWords(rows) });
  }
  const gollum = Object.values(game.cards).find((card) => card.code === GOLLUM && inPlay(card.zone));
  if (gollum) {
    const hitPoints = modifiedStat(game, gollum, "hitPoints", ctx.cards);
    dials.push({ id: "gollum", testID: "marshes-gollum", label: "Gollum · HP", name: `${nameOf(GOLLUM)}'s hit points left`, value: Math.max(0, hitPoints - gollum.damage), limit: hitPoints, filled: Math.min(hitPoints, gollum.damage), goal: true, limitWords: GOLLUM_WORDS });
  }
  return dials;
}

/** The held mark of the seat that holds the card Gollum / Sméagol: Gollum engaged with it, or Sméagol controlled by it (the first player). Empty while the card is out of play. */
export function gollumHeld(game: ScenarioState): readonly HeldDial[] {
  const card = Object.values(game.cards).find((one) => (one.code === GOLLUM || one.code === SMEAGOL) && inPlay(one.zone) && one.controller != null);
  if (!card || card.controller == null) return [];
  const who = game.seatCount > 1 ? `Player ${card.controller + 1}` : "you";
  return [{ seat: card.controller, words: gollumHeldWords(card.code === GOLLUM ? "gollum" : "smeagol", who, card.exhausted), mark: "hero" }];
}

/** The dials for the top bar: the same list while no dial's words or number changed. */
export function useMarshesDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly IsengardDial[] {
  const key = JSON.stringify(marshesDials(game, ctx, nameOf));
  return useMemo((): readonly IsengardDial[] => JSON.parse(key), [key]);
}
