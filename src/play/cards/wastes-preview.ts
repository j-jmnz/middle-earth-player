// Rules: mec108.day-and-night, mec108.campaign-log (data/rules/entries.json); ledger lines 10011:A:1, 10012:A:1, 10015:B:1, 100158:A:2, 10172:A:1, 10173:A:1, 10173:A:2.
// The one line a card of The Wastes of Eriador says about itself in the card preview (angmar-preview.ts) when it has more to say than its text: the Time objective's side, Pack Leader and stage 3B's gate, Arnor Ravaged's damage, Fend Off Despair's starting threat, and a character
// that is determined or carries Determination. The engine decided each; nothing here changes one. Pure.
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { DAYBREAK, timeObjective } from "../../rules/families/angmar/day-night.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";

import { GATE } from "../readouts/wastes.ts";
import { despairPreviewWords, gateWords, ravagedWords, timePreviewWords } from "../words/scenarios/wastes-table.ts";
import { determinedMark } from "./determined-mark.ts";

export function wastesDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (timeObjective(game)?.id === cardId) return timePreviewWords(card.code === DAYBREAK);
  // Pack Leader and the stage that holds him: the progress on stage 3B against the 5 that let him take damage.
  const stage = stageOf(game, 0);
  const current = stage ? game.cards[stage] : undefined;
  if ((card.code === "10017" && inPlay(card.zone)) || (card.id === stage && card.code === "10015")) return current?.code === "10015" ? gateWords(current.progress, GATE) : null;
  if (card.code === "100158" && card.zone === "staging") return ravagedWords(card.damage);
  if (card.code === "10173" && card.zone === "staging") return despairPreviewWords;
  return determinedMark(game, ctx, cardId)?.speech ?? null;
}
