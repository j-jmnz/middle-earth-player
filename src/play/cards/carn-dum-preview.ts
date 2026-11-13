// Rules: mec108.thaurdir, mec108.side-quests-in-play, rr.active-location, rr.attachment-cards (data/rules/entries.json); ledger lines 10125:B:3, 10127:A:4, 10128:A:4, 10129:A:1, 10139:A:3.
//
// The preview line of the cards The Battle of Carn Dûm adds: Thaurdir (his side, the shadow cards dealt to him, his damage and the burden he carries across a flip), the Carn Dûm Garrison (its Threat grown by its shadow cards) and Furious Charge (the progress its defeat adds to
// the main quest). The engine decided every number; nothing here changes one. Pure.
import { FURIOUS_CHARGE_PROGRESS } from "../../effects/authored/angmar-awakened/the-battle-of-carn-dum.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import { shadowCards } from "../../rules/core/zones.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { hitPointsOf } from "../../rules/families/angmar/quest.ts";
import { questPointsOf } from "../../rules/quest/quest.ts";

import { CARN_DUM_GARRISON, FURIOUS_CHARGE, THAURDIR_CAPTAIN, THAURDIR_CHAMPION, flipsAt, sideOf } from "../readouts/carn-dum.ts";
import { isBurden } from "../words/scenarios/angmar/angmar-table.ts";
import { furiousPreviewWords, garrisonPreviewWords, thaurdirPreviewWords } from "../words/scenarios/angmar/carn-dum-table.ts";

/** What a card of The Battle of Carn Dûm says in its preview, or null for any other card. `name` is a card's title by instance id. */
export function dumDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if ((card.code === THAURDIR_CAPTAIN || card.code === THAURDIR_CHAMPION) && inPlay(card.zone)) {
    const burden = card.attachments.map((id) => game.cards[id]).find((one) => one != null && isBurden(one.code));
    return thaurdirPreviewWords(sideOf(card), shadowCards(card).length, flipsAt(game), card.damage, hitPointsOf(game, card, ctx), burden ? name(burden.id) : null);
  }
  if (card.code === CARN_DUM_GARRISON && inPlay(card.zone)) return garrisonPreviewWords(modifiedStat(game, card, "threat", ctx.cards), printedOf(ctx.cards, card.code).threat ?? 0, shadowCards(card).length);
  if (card.code === FURIOUS_CHARGE && card.zone === "staging") {
    const main = game.questStage ? name(game.questStage) : "the main quest";
    return furiousPreviewWords(card.progress, questPointsOf(game, card, ctx.cards) ?? 0, FURIOUS_CHARGE_PROGRESS, main);
  }
  return null;
}
