// Rules: ats.underworld, ats.setup-the-stewards-fear-underworld-deck, rr.running-out-of-cards (data/rules/entries.json); ledger lines 06011:A:1, 06011:B:3, 06012:B:3, 06013:B:1, 06018:A:1, 06022:A:1, 06029:A:1, 06030:A:1, 06030:A:2, 06031:A:1.
//
// The pieces The Steward's Fear' cards hold on the table: the underworld deck's count (a top-bar dial; the deck is the set-aside cards that hold a place in it, and its order is never read), the facedown cards under an Underworld location (a pill, the preview line and the Underworld X chip),
// the resource tokens that advance stages 1 and 2 against their 4, Up in Flames' tokens against each deck, and the lines of the Plots. Every hook reads this scenario's own records (the verb TakeUnderworld, the `tokens` condition of a stage's `advanceNow` record) or its Plots' codes,
// and is empty in any other scenario. The engine decided every number; nothing here changes one. Pure, so a test reads it.
import type { Effect } from "../../../catalog/boundary.ts";
import type { CardInstance, ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { resolveAmount } from "../../../rules/interpret/amounts.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { allianceWords, clueDialName, clueDialWords, clueStageWords, counselsWords, deckDialName, deckDialWords, deckGoneWords, flamesDialName, flamesDialWords, flamesNearWords, flamesWords, stackPill, stackWords } from "../../words/scenarios/against-the-shadow/stewards-fear.ts";
import { ownerWords } from "../../words/owner.ts";
import type { TableDial } from "../dials.ts";

const SCENARIO = "the-stewards-fear";
const STAGE_ONE = "06011";
const STAGE_TWO = "06012";
const STAGE_THREE = "06013";
const ALLIANCE = "06029";
const FLAMES = "06030";
const COUNSELS = "06031";

/** Whether the game is The Steward's Fear: every hook below keys on it. */
export const live = (game: ScenarioState): boolean => game.scenarioId === SCENARIO;

/** The cards of the underworld deck: the set-aside cards that hold a place in it. Only the count is ever said. */
export const underworldCount = (game: ScenarioState): number => (live(game) ? game.setAside.filter((id) => game.cards[id]?.stackedAt != null).length : 0);

/** The value X of the card's Underworld X, read from its own record (a `TakeUnderworld` of the card on itself), or 0 for a card without one. */
export function underworldValue(game: ScenarioState, ctx: ReduceContext, cardId: string): number {
  const card = game.cards[cardId];
  if (!card || !live(game)) return 0;
  for (const effect of effectsOf(ctx, card.code) as readonly Effect[]) {
    for (const step of effect.instructions) if (step.verb === "TakeUnderworld" && step.host === "self") return resolveAmount(game, step.amount, { actor: 0, sourceId: cardId }, ctx);
  }
  return 0;
}

/** The facedown cards under a card: the underworld stack a location holds in the staging area or as the active location. */
export const stackUnder = (game: ScenarioState, cardId: string): readonly string[] => {
  const card = game.cards[cardId];
  return live(game) && card && (card.zone === "staging" || card.zone === "activeLocation") ? Object.values(game.cards).filter((other) => other.zone === "under" && other.host === cardId).map((other) => other.id) : [];
};

/** The pill on a location that holds an underworld stack, or null. Any location in staging or active counts: Sewers puts its card under the active location, whatever that is (06018:A:2). */
export function stackMark(game: ScenarioState, cardId: string): ReturnType<typeof stackPill> | null {
  const count = stackUnder(game, cardId).length;
  return count > 0 ? stackPill(count) : null;
}

/** The preview line of an Underworld location in play, or of any location that holds a stack: what lies under it. Null for any other card. */
export function underworldLine(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  const count = stackUnder(game, cardId).length;
  if (!card || (count === 0 && underworldValue(game, ctx, cardId) === 0) || (card.zone !== "staging" && card.zone !== "activeLocation")) return null;
  return stackWords(count);
}

// The quest stage's `tokens` condition of its `advanceNow` record: how many resource tokens advance it, or 0 for a stage with none.
function advanceTokens(ctx: ReduceContext, code: string): number {
  for (const effect of effectsOf(ctx, code) as readonly Effect[]) {
    const condition = effect.condition;
    if (effect.timing === "constant" && condition?.kind === "tokens" && effect.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "advanceNow")) return condition.min;
  }
  return 0;
}

const stageCard = (game: ScenarioState): CardInstance | undefined => (game.questStage ? game.cards[game.questStage] : undefined);

// Whether the underworld deck has been shuffled into the encounter deck: stage 3B is the current stage.
const shuffledIn = (game: ScenarioState): boolean => {
  const stage = stageCard(game);
  return stage?.code === STAGE_THREE && stage.face === "B";
};

/** The dials of this scenario, in the order the bar draws them: the underworld deck, the Clue tokens of stage 1 or 2 against 4, Up in Flames. Empty in any other scenario. */
export function stewardsFearDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (!live(game)) return [];
  const dials: TableDial[] = [];
  const count = underworldCount(game);
  if (!shuffledIn(game)) dials.push({ id: "underworld-deck", testID: "underworld-deck", label: "Deck", name: deckDialName, value: count, note: deckDialWords(count) });
  const stage = stageCard(game);
  const limit = stage ? advanceTokens(ctx, stage.code) : 0;
  if (stage && limit > 0) {
    dials.push({ id: "clue-tokens", testID: "clue-tokens", label: "Clues", name: clueDialName(nameOf(stage.code)), value: stage.resources, limit, goal: true, cardId: stage.id, limitWords: `${limit} advance the stage`, note: clueDialWords(stage.resources, limit) });
  }
  const flames = Object.values(game.cards).find((card) => card.code === FLAMES && card.zone === "staging");
  if (flames) {
    const next = flames.resources + 1;
    const short = game.seats.flatMap((seat, index) => (index < game.seatCount && !seat.eliminated && seat.deck.length <= next ? [{ index, cards: seat.deck.length }] : []))[0];
    dials.push({
      id: "flames",
      testID: "flames-tokens",
      label: "Flames",
      name: flamesDialName(flames.resources),
      value: flames.resources,
      cardId: flames.id,
      ...(short ? { warn: { level: "critical" as const, words: flamesNearWords(ownerWords(game.seatCount, short.index), short.cards, next) } } : {}),
      note: flamesDialWords(flames.resources),
    });
  }
  return dials;
}

/** The lines a stage adds to its preview and to the screen that tells the advance to it: the tokens toward advancing (stages 1 and 2), and that the deck is gone (3B). Empty for another stage and in any other scenario. */
export function stewardsFearStageLines(game: ScenarioState, ctx: ReduceContext, code: string): string[] {
  const stage = stageCard(game);
  if (!live(game) || !stage || stage.code !== code) return [];
  if (code === STAGE_ONE || code === STAGE_TWO) {
    const limit = advanceTokens(ctx, code);
    return limit > 0 ? [clueStageWords(stage.resources, limit)] : [];
  }
  return code === STAGE_THREE && stage.face === "B" ? [deckGoneWords] : [];
}

/** The preview line of a Plot in staging: Up in Flames' tokens against each deck, Unholy Alliance's extra reveal, Poisoned Counsels' threat. Null for another card. */
export function plotLine(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!live(game) || !card || card.zone !== "staging") return null;
  if (card.code === FLAMES) return flamesWords(card.resources);
  if (card.code === ALLIANCE) return allianceWords;
  return card.code === COUNSELS ? counselsWords : null;
}
