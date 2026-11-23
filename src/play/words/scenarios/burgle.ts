// The words of the burgle family's choices (src/catalog/families/burgle.ts, The Lonely Mountain) inside a Choose branch: the card type Secret Entrance names, the Baggins resources Pretending to Sleep spends, the progress Western Slopes removes from Smaug the Golden.
// Every sentence names what the branch does and leads with it; the numbers are the engine's, read from the table.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { inPlay } from "../../../rules/core/state.ts";

import { article } from "../instruction.ts";
import type { ChoiceNames } from "../choice.ts";

type ChooseInstruction = Extract<Instruction, { verb: "Choose" }>;

/** The progress on the first card in play with this title, or null when none is in play. */
function progressOn(game: ScenarioState, title: string, names: ChoiceNames): number | null {
  const card = Object.values(game.cards).find((entry) => inPlay(entry.zone) && names.code(entry.code) === title);
  return card ? card.progress : null;
}

/** A branch of a burgle family card's choice in words, or null for any other branch. */
export function burgleBranchWords(choose: ChooseInstruction, optionId: string, game: ScenarioState, names: ChoiceNames): string | null {
  const option = choose.options.find((entry) => entry.id === optionId);
  const [first, second] = option?.instructions ?? [];
  // Secret Entrance (132045:A:2): each branch names a card type, travels, looks at the top card and sends the location back unless it is that type.
  if (first?.verb === "Travel") return `Name ${article(optionId)}: travel here, look at the top card of the encounter deck, and send this location back to the staging area unless it is ${article(optionId)}`;
  // Pretending to Sleep (132048:A:2): the progress on Smaug the Golden is the number of Baggins resources.
  if (first?.verb === "SpendBaggins") {
    const progress = progressOn(game, "Smaug the Golden", names);
    return progress == null ? "Spend as many Baggins resources as Smaug the Golden has progress" : `Spend ${progress} Baggins resource${progress === 1 ? "" : "s"} from the Baggins hero's pool`;
  }
  // Western Slopes (132047:A:1): the choice of a card of Smaug the Golden's.
  if (first?.verb === "Pick" && second?.verb === "RemoveProgressFrom") return `Remove ${second.amount === 1 ? "1 progress" : `${String(second.amount)} progress`} from ${first.pick.names?.[0] ?? "the card"}`;
  return null;
}
