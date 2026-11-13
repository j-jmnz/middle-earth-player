// Rules: mec108.day-and-night, mec108.campaign-log (data/rules/entries.json); ledger lines 10011:A:1, 10012:A:1, 10015:B:1, 100158:A:2, 10172:A:1, 10173:A:1, 10173:A:2.
// The one line a card of The Wastes of Eriador says about itself in the card preview (angmar-preview.ts) when it has more to say than its text: the Time objective's side, Pack Leader and stage 3B's gate, Arnor Ravaged's damage, Fend Off Despair's starting threat, and a character
// that is determined or carries Determination. The engine decided each; nothing here changes one. Pure.
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { DAYBREAK, timeObjective } from "../../rules/families/angmar/day-night.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";

import { ARNOR_RAVAGED, FEND_OFF_DESPAIR, GATE, PACK_LEADER, packLeaderGate } from "../readouts/wastes.ts";
import { despairPreviewWords, gateWords, ravagedWords, timePreviewWords } from "../words/scenarios/angmar/wastes-table.ts";
import { determinedMark } from "./determined-mark.ts";

export function wastesDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (timeObjective(game)?.id === cardId) return timePreviewWords(card.code === DAYBREAK);
  // Pack Leader and the stage that holds him: the progress on stage 3B against the 5 that let him take damage, once the gate shows.
  if (card.code === PACK_LEADER || card.id === stageOf(game, 0)) {
    const gate = packLeaderGate(game);
    if (gate) return gateWords(gate.progress, GATE);
  }
  if (card.code === ARNOR_RAVAGED && card.zone === "staging") return ravagedWords(card.damage);
  if (card.code === FEND_OFF_DESPAIR && card.zone === "staging") return despairPreviewWords;
  return determinedMark(game, ctx, cardId)?.speech ?? null;
}
