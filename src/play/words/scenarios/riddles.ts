// Rules: hob.riddles (data/rules/entries.json); ledger lines 131075:A:2, 131076:A:2, 131077:A:2, 131080:A:2, 131082:A:2. The branches of the choice a riddle card offers when it is revealed from the encounter deck, in words.
import type { Instruction } from "../../../catalog/boundary.ts";

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
