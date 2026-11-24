// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives (data/rules/entries.json); ledger line 06132:A:2.
// Faramir's choice of the player whose hidden card is turned faceup: the engine queues a Choose with an option `seat:N` for each player who holds one (families/pelargir/hidden-turn.ts), so no record holds it and no asks entry can key it. The sentence over it and each row name the players and
// how many hidden cards each holds, never a card. Keyed on the options of the Choose: empty for any other. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../../rules/core/state.ts";
import { hiddenIds } from "../../../../rules/families/pelargir/hidden.ts";

import { hiddenCards } from "./blood.ts";

type ChooseInstruction = Extract<Instruction, { verb: "Choose" }>;

const SEAT = /^seat:(\d+)$/;

/** Whether the Choose is Faramir's choice of a player (`TurnHiddenCard` for each seat that holds a card). */
export const isSeatChoice = (choose: ChooseInstruction): boolean => choose.options.length > 0 && choose.options.every((option) => SEAT.test(option.id) && option.instructions[0]?.verb === "TurnHiddenCard");

/** The row of one player: his number, how many hidden cards he holds and what is turned, with the damage an enemy takes first. */
export function seatChoiceRow(choose: ChooseInstruction, optionId: string, game: ScenarioState): string | null {
  if (!isSeatChoice(choose)) return null;
  const seat = Number(SEAT.exec(optionId)?.[1]);
  const turn = choose.options.find((option) => option.id === optionId)?.instructions[0];
  const damage = turn?.verb === "TurnHiddenCard" ? turn.damageEnemy : undefined;
  const who = game.seatCount > 1 ? `Player ${seat + 1}` : "You";
  return `${who} (${hiddenCards(hiddenIds(game, seat).length)}): turn 1 hidden card faceup, picked at random${damage != null ? `. An enemy takes ${damage} damage first` : ""}`;
}

/** The sentence over the choice: the card, what it does and that the card is picked blind. */
export function seatChoiceNote(choose: ChooseInstruction, game: ScenarioState, card: string | null): string | null {
  if (!isSeatChoice(choose)) return null;
  const turn = choose.options[0]?.instructions[0];
  const damage = turn?.verb === "TurnHiddenCard" ? turn.damageEnemy : undefined;
  return `${card ?? "Faramir"}: choose the player whose hidden card is turned faceup. The card is picked at random from that player's hidden cards, and nobody sees which it is before it turns. ${damage != null ? `An enemy takes ${damage} damage first, and one it destroys never engages. ` : ""}Any other card is discarded.`;
}
