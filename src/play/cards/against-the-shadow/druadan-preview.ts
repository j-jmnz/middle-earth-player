// Rules: ats.prowl, hon.archery, rr.cost, rr.travel (data/rules/entries.json); ledger lines 06047:A:1, 06048:A:1, 06048:A:2, 06049:A:1, 06050:A:1, 06050:A:2, 06051:A:1, 06051:A:2, 06052:A:1, 06054:A:1, 06044:B:2.
// What the card preview (table-preview.ts) says of the cards of The Drúadan Forest that hold something the table shows nowhere else: an enemy's Prowl X and the progress it holds against its hit points, the Hunter's Archery X, the archery a Glade gives a Wose, Ancestral Clearing's extra cost on a
// player card, Garden of Poisons' two lines and the hero it stops. The engine decided each; this only says it. The stage's own line is in readouts/against-the-shadow/druadan.ts (druadanStageLines). Empty in any other scenario.
import type { Effect } from "../../../catalog/boundary.ts";
import { cardArchery } from "../../../rules/combat/combat.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import { playCost } from "../../../rules/player/attach.ts";
import { costIncrease } from "../../../rules/player/cost-rules.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { archeryGains, enemyProgress, live, printsArcheryX, prowlValue } from "../../readouts/against-the-shadow/druadan.ts";
import { archeryXWords, clearingCostWords, clearingWords, enemyProgressWords, gardenHeroWords, GARDEN_WORDS, prowlWords, woseArcheryWords } from "../../words/scenarios/against-the-shadow/druadan.ts";

const CLEARING = "06050";
const GARDEN = "06051";

const constantsOf = (ctx: ReduceContext, code: string) => (effectsOf(ctx, code) as readonly Effect[]).filter((effect) => effect.timing === "constant").flatMap((effect) => effect.instructions);

const hasStat = (ctx: ReduceContext, code: string, stat: string): boolean => constantsOf(ctx, code).some((step) => step.verb === "ModifyStat" && step.stat === stat);

// The amount the card's own IncreaseCost constant adds to a player card's cost, or 0 for a card without one.
const increaseOf = (ctx: ReduceContext, code: string): number => {
  const step = constantsOf(ctx, code).find((one) => one.verb === "IncreaseCost");
  return step?.verb === "IncreaseCost" ? step.amount : 0;
};

// The card of this code in play (the staging area or the active location), whose constant is the one that reads.
const inPlayOf = (game: ScenarioState, code: string) => Object.values(game.cards).find((card) => card.code === code && (card.zone === "staging" || card.zone === "activeLocation"));

/** The muted line under the card's name in its preview, or null. */
export function druadanDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, nameOf: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card || !live(game)) return null;
  const printed = printedOf(ctx.cards, card.code);
  const parts: string[] = [];
  if (printed.type === "enemy") {
    const prowl = prowlValue(game, ctx, cardId);
    if (prowl > 0) parts.push(prowlWords(prowl));
    if (printsArcheryX(game, ctx, card.code) && card.face !== "down") parts.push(archeryXWords(cardArchery(game, ctx.cards, card).own));
    const gains = archeryGains(game, ctx, cardId, nameOf);
    if (gains.length > 0 && (card.zone === "staging" || card.zone === "engaged")) {
      const { keyword, own } = cardArchery(game, ctx.cards, card);
      parts.push(woseArcheryWords(keyword + own, gains));
    }
    const held = enemyProgress(game, ctx, cardId);
    if (held) parts.push(enemyProgressWords(held.progress, held.hits));
  }
  // Ancestral Clearing: the cost it adds to each player card, and the travel cost it prints.
  if (card.code === CLEARING && increaseOf(ctx, card.code) > 0 && (card.zone === "staging" || card.zone === "activeLocation")) parts.push(clearingWords(increaseOf(ctx, card.code)));
  if (card.code === GARDEN && hasStat(ctx, card.code, "noCardResources")) parts.push(GARDEN_WORDS);
  // A hero while Garden of Poisons is in play.
  const garden = inPlayOf(game, GARDEN);
  if (garden && printed.type === "hero" && card.zone === "heroes" && hasStat(ctx, GARDEN, "noCardResources")) parts.push(gardenHeroWords(nameOf(garden.id)));
  // A player card in hand costs more while Ancestral Clearing is in play.
  const clearing = inPlayOf(game, CLEARING);
  if (clearing && increaseOf(ctx, CLEARING) > 0 && card.zone === "hand" && card.controller != null) {
    const more = costIncrease(game, cardId, card.controller, ctx);
    const cost = playCost(game, cardId, card.controller, ctx);
    if (more > 0 && cost != null) parts.push(clearingCostWords(cost, more, nameOf(clearing.id)));
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
