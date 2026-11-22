// Rules: docs/scenarios/standalone-scenarios.md (The Stone of Erech), rr.forced (data/rules/entries.json); ledger lines 50301:A:1, 50303:B:2, 50304:A:1, 50304:A:4, 50308:A:1, 50308:A:2, 50309:A:1, 50309:A:2, 50310:A:1.
//
// The pieces The Stone of Erech's cards hold on the table, as top-bar dials: the progress on the Night objective in play (Eventide, Dusk and Midnight lie one at a time beside the current quest, 50301:A:1) against the 4 that brings the next Night in (the limit is read
// from the card's own NightAdvance record, 50308:A:2, 50309:A:2; it warms near the limit, and Midnight has none, 50310:A:1), and Derufin, controlled by a player or still attached to the Stone (50304:A:1, 50303:B:2), whose controller's seat wears a mark. The engine decided every number
// (the progress tokens, who controls Derufin); nothing here changes one. A tap on either dial shows its card. Each Night's dial has its own id, so a Night that comes in mounts a dial of its own and shows no "lowered" badge. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { flagged } from "../../../rules/core/state.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { nightCard } from "../../../rules/families/erech/night.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { derufinFreeWords, erechProgressWords, derufinHeldWords, derufinStageWords, midnightWords, nightLimitWords, nightNearWords, nightWords } from "./erech-words.ts";
import { cardsOf, type TableDial } from "../dials.ts";
import type { HandMark } from "../isengard.ts";

const SCENARIO = "the-stone-of-erech";
const DERUFIN = "50304";
/** The last stage, which takes no progress while no player controls Derufin (50303:B:2). */
const LAST_STAGE = "50303";
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
      dials.push({ id: `night-${night.code}`, cardId: night.id, testID: "erech-night", label: name, name: `Progress on ${name}`, value: night.progress, limit: limit.at, warms: true, ...(level ? { warn: { level, words: nightNearWords(left, next) } } : {}), limitWords: nightLimitWords(limit.at, next), note: nightWords(name, night.progress, limit.at, next) });
    } else {
      dials.push({ id: `night-${night.code}`, cardId: night.id, testID: "erech-night", label: name, name: `Progress on ${name}`, value: night.progress, note: midnightWords(name, night.progress) });
    }
  }
  const derufin = cardsOf(game, DERUFIN)[0] ?? Object.values(game.cards).find((card) => card.code === DERUFIN && card.zone === "attached");
  if (derufin) {
    const owner = derufin.controller;
    const onLastStage = game.questStage != null && game.cards[game.questStage]?.code === LAST_STAGE;
    const warn = owner == null && onLastStage ? { level: "near" as const, words: derufinStageWords() } : undefined;
    dials.push({ id: "derufin", testID: "erech-derufin", label: "Derufin", name: "Derufin", value: owner == null ? 0 : 1, cardId: derufin.id, word: owner == null ? "Stone" : "Ally", ...(warn ? { warn } : {}), note: owner == null ? derufinFreeWords() : derufinHeldWords(game.seatCount > 1 ? owner : null) });
  }
  return dials;
}

/** The mark of the seat that controls Derufin ("Derufin", "P2 · Derufin" two-handed). Empty while no player controls him and in any other scenario. */
export function erechHands(game: ScenarioState): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO) return [];
  return cardsOf(game, DERUFIN).flatMap((card) => (card.controller == null ? [] : [{ seat: card.controller, label: game.seatCount > 1 ? `P${card.controller + 1} · Derufin` : "Derufin", note: "Derufin: if he leaves play the players lose the game." }]));
}

/** What the quest readout says of `progress` on stage 3B while no player controls Derufin (50303:B:2): the engine's split, run on a copy, between the active location and the stage, which takes none. Null otherwise and in any other scenario. */
export function erechQuestWords(game: ScenarioState, ctx: ReduceContext, progress: number): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (game.scenarioId !== SCENARIO || progress <= 0 || stage?.code !== LAST_STAGE || !flagged(game, "table", "noQuestProgress")) return null;
  const steps: EngineStep[] = [];
  placeQuestProgress(game, progress, ctx.cards, steps, () => false, true);
  let onLocation = 0;
  for (const step of steps) if (step.kind === "progress" && step.targetId !== stage.id) onLocation += step.amount;
  return erechProgressWords(onLocation);
}
