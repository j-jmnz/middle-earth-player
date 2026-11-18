// Rules: docs/brief.md (The Stone of Erech), rr.forced (data/rules/entries.json); ledger lines 50301:A:1, 50303:B:2, 50304:A:1, 50304:A:4, 50308:A:1, 50308:A:2, 50309:A:1, 50309:A:2, 50310:A:1.
//
// The pieces The Stone of Erech's cards hold on the table, as top-bar dials: the progress on the Night objective in play (Eventide, Dusk and Midnight lie one at a time beside the current quest, 50301:A:1) against the 4 that brings the next Night in (the limit is read
// from the card's own NightAdvance record, 50308:A:2, 50309:A:2; it warms near the limit, and Midnight has none, 50310:A:1), and Derufin, controlled by a player or still attached to the Stone (50304:A:1, 50303:B:2), whose controller's seat wears a mark. The engine decided every number
// (the progress tokens, who controls Derufin); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { nightCard } from "../../../rules/families/erech/night.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { derufinFreeWords, derufinHeldWords, derufinStageWords, midnightWords, nightLimitWords, nightNearWords, nightWords } from "./erech-words.ts";
import { cardsOf, type TableDial } from "../dials.ts";
import type { HandMark } from "../isengard.ts";

const SCENARIO = "the-stone-of-erech";
const DERUFIN = "50304";
/** The last stage, which takes no progress while no player controls Derufin (50303:B:2). */
export const SHADOW_HOST = "50303";
/** How near the limit the dial warms (near) and turns critical. */
const NEAR = 2;
const CRITICAL = 1;

/** The limit and the next Night of a Night objective, read from its NightAdvance record; null for Midnight, which has none. */
function advance(ctx: ReduceContext, code: string): { at: number; next: string } | null {
  for (const effect of effectsOf(ctx, code)) for (const instruction of effect.instructions) if (instruction.verb === "NightAdvance") return { at: instruction.at, next: instruction.next };
  return null;
}

/** The dials The Stone of Erech's cards hold now: none in any other scenario. */
export function erechDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const night = nightCard(game);
  if (night) {
    const name = nameOf(night.code);
    const limit = advance(ctx, night.code);
    if (limit) {
      const next = nameOf(limit.next);
      const left = Math.max(0, limit.at - night.progress);
      const level = left <= CRITICAL ? ("critical" as const) : left <= NEAR ? ("near" as const) : null;
      dials.push({ id: "night", testID: "erech-night", label: name, name: `Progress on ${name}`, value: night.progress, limit: limit.at, warms: true, ...(level ? { warn: { level, words: nightNearWords(left, next) } } : {}), limitWords: nightLimitWords(limit.at, next), note: nightWords(name, night.progress, limit.at, next) });
    } else {
      dials.push({ id: "night", testID: "erech-night", label: name, name: `Progress on ${name}`, value: night.progress, note: midnightWords(name, night.progress) });
    }
  }
  const derufin = cardsOf(game, DERUFIN)[0] ?? Object.values(game.cards).find((card) => card.code === DERUFIN && card.zone === "attached");
  if (derufin) {
    const owner = derufin.controller;
    const onLastStage = game.questStage != null && game.cards[game.questStage]?.code === SHADOW_HOST;
    const warn = owner == null && onLastStage ? { level: "near" as const, words: derufinStageWords() } : undefined;
    dials.push({ id: "derufin", testID: "erech-derufin", label: "Derufin", name: "Derufin", value: owner == null ? 0 : 1, word: owner == null ? "Free" : "Held", ...(warn ? { warn } : {}), note: owner == null ? derufinFreeWords() : derufinHeldWords(game.seatCount > 1 ? owner : null) });
  }
  return dials;
}

/** The mark of the seat that controls Derufin ("Derufin", "P2 · Derufin" two-handed). Empty while no player controls him and in any other scenario. */
export function erechHands(game: ScenarioState): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO) return [];
  return cardsOf(game, DERUFIN).flatMap((card) => (card.controller == null ? [] : [{ seat: card.controller, label: game.seatCount > 1 ? `P${card.controller + 1} · Derufin` : "Derufin", note: "Derufin: if he leaves play the players lose the game." }]));
}
