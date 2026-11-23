// Rules: hob.riddles, hob.riddles-steps-2-and-3 (data/rules/entries.json); ledger lines 131075:A:2, 131076:A:2, 131077:A:2, 131079:A:2, 131080:A:2, 131081:A:2, 131082:A:2, 131083:A:2, 131084:A:1. The words of a riddle: the branches of the choice a riddle card offers when it is revealed, and the waits of
// an answered riddle (the items the first player names, Bilbo's Magic Ring, the type Not Fair! Not Fair! asks), each saying its number, whose it is and the deck it is about (docs/design-system-table.md, Choice tray).
import type { Instruction } from "../../../../catalog/boundary.ts";

import type { ReduceContext } from "../../../../rules/interpret/interpret.ts";
import type { ScenarioState } from "../../../../rules/core/state.ts";
import { ringReady } from "../../../../rules/families/riddles/area.ts";
import { riddleOf } from "../../../../rules/families/riddles/conditions.ts";
import type { AskedWords } from "../../asks.ts";
import type { ChoiceNames } from "../../choice.ts";
import { seatSays } from "../../seat.ts";

/** One instruction of the riddles family in words, as a branch of a Choose says it, or null when it is not one of its verbs that a branch holds. */
export function riddlesWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "AnswerRiddle":
      return "answer the riddle on this card: name the items, then your deck is shuffled and its top cards are discarded";
    case "ResolveNormally":
      return "resolve this card as any other card";
    default:
      return null;
  }
}

const ITEM_WORDS = { type: "a card type", sphere: "a sphere", cost: "a cost, from 0 to 6" } as const;

/** The words of the wait of an answered riddle or of Not Fair! Not Fair! (the verbs RiddleStep and NameEncounterType), or null for any other instruction. `queue`: the instructions that follow the asked one. */
export function riddleAsk(instruction: Instruction, queue: readonly Instruction[], game: ScenarioState, ctx: ReduceContext, names: ChoiceNames): AskedWords | null {
  const says = seatSays(game);
  if (instruction.verb === "NameEncounterType") {
    const count = queue.find((item) => item.verb === "DiscardEncounterTop");
    const top = count?.verb === "DiscardEncounterTop" && typeof count.count === "number" ? count.count : 3;
    return { verb: "Name", ...says.owned, prompt: says.say(`name a card type. The top ${top} cards of the encounter deck are discarded. Stage 2 keeps its progress, since it cannot be removed except by answering riddles.`) };
  }
  if (instruction.verb !== "RiddleStep") return null;
  const card = game.cards[instruction.card];
  const riddle = card ? riddleOf(ctx, card.code) : undefined;
  const title = card ? names.card(card.id) : "The riddle";
  if (instruction.step === "name" && instruction.item) {
    const at = riddle ? riddle.names.indexOf(instruction.item) + 1 : 1;
    const of = riddle?.names.length ?? 1;
    const part = of > 1 ? ` (${at} of ${of})` : "";
    return { verb: "Name", ...says.owned, prompt: `${says.titled(title, `name ${ITEM_WORDS[instruction.item]} for its riddle${part}.`)} Then your deck is shuffled and its top ${riddle?.discard ?? 1} cards are discarded: each one that matches every name puts 1 progress on stage 2.` };
  }
  if (instruction.step === "ring") {
    const ready = ringReady(game, ctx);
    const held = ready?.bilbo.resources ?? 0;
    const spend = ready?.spend ?? 1;
    return {
      verb: "Choose",
      ...says.owned,
      prompt: `${says.titled("Bilbo's Magic Ring", `only the first player may use it. Spend ${spend} of the ${held} Baggins resources in Bilbo's pool to discard ${ready?.discard ?? 1} more card from your deck?`)} It is checked for a match like the others.`,
      labels: { ring: `Spend ${spend} Baggins resource: discard ${ready?.discard ?? 1} more card`, stop: "Stop: discard no more cards" },
    };
  }
  return null;
}
