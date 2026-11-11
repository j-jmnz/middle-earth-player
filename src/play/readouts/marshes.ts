// Rules: mec112.mire, mec112.gollum-smeagol (data/rules/entries.json); ledger lines 144019:A:1, 144022:A:2, 144064:B:1, 144075:A:1, 144075:A:3, 144076:A:1.
//
// The pieces of The Passage of the Marshes' table (docs/design-system-table.md, Cards, The Passage of the Marshes): the Mire dial (the mire tokens on the location closest to its Mire X, each location's count in its spoken words),
// Gollum's hit points as a goal dial (his defeat is the gate of stage 1B), and the seat that holds the card Gollum / Sméagol: its dial's held mark says Gollum is engaged with it, or that it controls Sméagol. The engine decided every number
// (`mireTally`, `modifiedStat`); nothing here changes one. Pure, so a test reads it.
import { inPlay } from "../../rules/core/state.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { GOLLUM, gollumCard } from "../../rules/families/gollum/index.ts";
import { mireTally } from "../../rules/families/mire/index.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { GOLLUM_WORDS, gollumHeldWords, listNames, mireWarn, mireWords, nearestRows } from "../words/scenarios/marshes.ts";
import { useStableDials, type TableDial } from "./dials.ts";
import type { HeldDial } from "./widgets.ts";

/**
 * The dials The Passage of the Marshes' pieces hold now, in the order the top bar draws them: Mire (a location in the staging area or the active one with the keyword), then Gollum's hit points while he is an enemy in play.
 * The Mire dial warms toward its limit, never the accent: a location that reaches it is discarded, and it warns when 1 mire token is left. Empty in any other scenario.
 */
export function marshesDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  const places = [...game.staging, ...(game.activeLocation ? [game.activeLocation] : [])];
  const rows = places.flatMap((id) => {
    const tally = mireTally(game, id);
    const card = game.cards[id];
    return tally && card ? [{ name: nameOf(card.code), tokens: tally.tokens, limit: tally.value }] : [];
  });
  if (rows.length > 0) {
    // The nearest to its limit: the fewest tokens left, chosen once for the dial's number, its name and its words; a tie names every tied location and reads against the larger limit.
    const closest = nearestRows(rows);
    const nearest = closest.reduce((best, row) => (row.limit > best.limit ? row : best), closest[0]!);
    const left = Math.max(0, nearest.limit - nearest.tokens);
    const warn = mireWarn(left, closest);
    dials.push({ id: "mire", testID: "marshes-mire", label: "Mire", name: `Mire tokens on ${listNames(closest)}, closest to discard:`, value: nearest.tokens, limit: nearest.limit, warms: true, ...(warn ? { warn } : {}), limitWords: mireWords(rows, closest) });
  }
  const gollum = gollumCard(game);
  if (gollum?.code === GOLLUM && inPlay(gollum.zone)) {
    const hitPoints = modifiedStat(game, gollum, "hitPoints", ctx.cards);
    dials.push({ id: "gollum", testID: "marshes-gollum", label: "Gollum · HP", name: `${nameOf(GOLLUM)}'s hit points left`, value: Math.max(0, hitPoints - gollum.damage), limit: hitPoints, filled: Math.min(hitPoints, gollum.damage), goal: true, limitWords: GOLLUM_WORDS });
  }
  return dials;
}

/** The held mark of the seat that holds the card Gollum / Sméagol: Gollum engaged with it, or Sméagol controlled by it (the first player). Empty while the card is out of play. */
export function gollumHeld(game: ScenarioState): readonly HeldDial[] {
  const card = gollumCard(game);
  if (!card || !inPlay(card.zone) || card.controller == null) return [];
  const who = game.seatCount > 1 ? `Player ${card.controller + 1}` : "you";
  return [{ seat: card.controller, words: gollumHeldWords(card.code === GOLLUM ? "gollum" : "smeagol", who, card.exhausted), mark: "hero" }];
}

/** The dials for the top bar: the same list while no dial's words or number changed. */
export function useMarshesDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  return useStableDials(marshesDials(game, ctx, nameOf));
}
