// Rules: mec109.multiple-staging-areas (data/rules/entries.json). What the table says in words about the staging area it draws once stage 2B has split the table
// (Breaking of the Fellowship): whose area it is, the stage that area quests on, its cards and its active location. The canvas draws the same area (selectors.ts,
// zoneIds); this is the line a screen reader hears and the one an end-to-end flow reads, since the Skia canvas has no element per card. Pure.
import { isSeparate } from "../rules/families/breaking-areas.ts";
import type { ScenarioState } from "../rules/state.ts";

import { zoneIds } from "./selectors.ts";

/**
 * "Player 2's staging area · Orc Hunting · 3 cards · No active location", or null while the table is one area. True solo has no player label.
 * `seat` is the seat the table draws (`shownSeat`).
 */
export function areaWords(game: ScenarioState, seat: number, nameOf: (code: string) => string): string | null {
  if (!isSeparate(game)) return null;
  const name = (id: string | undefined) => (id ? nameOf(game.cards[id]?.code ?? id) : null);
  const stage = name(zoneIds(game, "questStage", seat)[0]) ?? "No stage";
  const count = zoneIds(game, "staging", seat).length;
  const active = name(zoneIds(game, "activeLocation", seat)[0]);
  const who = game.seatCount > 1 ? `Player ${seat + 1}'s staging area` : "Staging area";
  return [who, stage, `${count} ${count === 1 ? "card" : "cards"}`, active ? `Active location ${active}` : "No active location"].join(" · ");
}
