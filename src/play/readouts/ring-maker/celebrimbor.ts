// Rules: rm.scour, rm.the-orcs-search, rr.cannot (data/rules/entries.json); ledger lines 08122:B:4, 08123:B:4, 08125:A:1, 08125:A:2, 08126:A:3, 08127:A:1, 08127:A:2.
// Celebrimbor's Secret's pieces on the table: the cards facedown underneath The Orcs' Search as one top-bar dial (a count, never which cards), warming when a damaged location in play comes near its printed quest points, and where Celebrimbor's Mould lies
// (a hero, The Secret Chamber, Bellach or free). The engine decided every number (`facedownCount`, the settle sweep `buryDamaged`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { printedOf } from "../../../rules/core/printed.ts";
import { inPlay, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { facedownCount } from "../../../rules/families/misc/amounts.ts";
import { buryPoints } from "../../../rules/families/ring-maker/orcs-search.ts";

import { nearBuriedWords, searchNote } from "../../words/scenarios/ring-maker/celebrimbor-table.ts";
import type { TableDial } from "../dials.ts";
import { cardsOf } from "../dials.ts";

/** The codes of Celebrimbor's Secret: its two quest stages, Bellach, The Orcs' Search, The Secret Chamber and the Mould. */
export const STAGE_1 = "08122";
export const STAGE_2 = "08123";
export const BELLACH = "08124";
export const ORCS_SEARCH = "08125";
export const SECRET_CHAMBER = "08126";
export const MOULD = "08127";

// A location whose damage is this near its printed quest points warns: it goes underneath The Orcs' Search at the points.
const NEAR = 2;

/** The Orcs' Search in play, the host of the facedown cards. */
export const searchIn = (game: ScenarioState) => cardsOf(game, ORCS_SEARCH)[0];

/** The cards facedown underneath The Orcs' Search now (0 in a game without it). */
export const cardsUnderSearch = (game: ScenarioState): number => facedownCount(game, searchIn(game)?.id ?? null);

/** The Mould's card in play or set aside in the game, with what holds it. `where` is "hero", "location" (an encounter location, The Secret Chamber), "bellach", or "free" (not attached). */
export function mouldState(game: ScenarioState, ctx: ReduceContext): { id: string; where: "hero" | "location" | "bellach" | "free"; host: string | null } | null {
  const mould = Object.values(game.cards).find((card) => card.code === MOULD && inPlay(card.zone));
  if (!mould) return null;
  const host = mould.zone === "attached" && mould.host != null ? game.cards[mould.host] : undefined;
  if (!host) return { id: mould.id, where: "free", host: null };
  const where = host.code === BELLACH ? "bellach" : printedOf(ctx.cards, host.code).type === "hero" ? "hero" : "location";
  return { id: mould.id, where, host: host.id };
}

/** The ids of the Mould lying on this card (a hero, The Secret Chamber or Bellach). Empty for any other card. The card's pill names it. */
export const mouldLyingOn = (game: ScenarioState, hostId: string): readonly string[] => (game.cards[hostId]?.attachments ?? []).filter((id) => game.cards[id]?.code === MOULD);

/** The locations in play with damage within NEAR of their printed quest points (and above 0), nearest first, with what is left before they go under. */
export function nearBuried(game: ScenarioState, ctx: ReduceContext): readonly { id: string; code: string; damage: number; points: number }[] {
  const found: { id: string; code: string; damage: number; points: number }[] = [];
  for (const card of Object.values(game.cards)) {
    if (!inPlay(card.zone) || card.damage <= 0) continue;
    const points = buryPoints(ctx, card.code);
    if (points != null && points - card.damage <= NEAR) found.push({ id: card.id, code: card.code, damage: card.damage, points });
  }
  return found.sort((a, b) => a.points - a.damage - (b.points - b.damage));
}

/** The dial of the cards underneath The Orcs' Search, while it is in play: the count, the threat it costs and a warning for each damaged location near its quest points ("critical" when The Secret Chamber is one: it loses the game). */
export function celebrimborDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const search = searchIn(game);
  if (!search) return [];
  const count = cardsUnderSearch(game);
  const near = nearBuried(game, ctx);
  const words = near.map((one) => nearBuriedWords(nameOf(one.code), one.damage, one.points, one.code === SECRET_CHAMBER));
  return [
    {
      id: "search",
      testID: "ring-maker-search",
      label: "Search",
      icon: "shadow",
      name: `Cards facedown under ${nameOf(ORCS_SEARCH)}:`,
      value: count,
      cardId: search.id,
      ...(near.length > 0 ? { warn: { level: near.some((one) => one.code === SECRET_CHAMBER) ? ("critical" as const) : ("near" as const), words: words.join(" ") } } : {}),
      note: searchNote(count),
    },
  ];
}
