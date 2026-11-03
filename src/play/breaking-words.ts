// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules (data/rules/entries.json). The words of the breaking family's verbs
// (src/catalog/families/breaking.ts) inside a choice: the stage each player advances to at stage 2B, the Hunter's two branches, Growing Threat's two,
// and the burden card the Seat of Seeing removes from the game.
import type { Instruction } from "../catalog/boundary.ts";
import type { ScenarioState } from "../rules/core/state.ts";

type Names = { code: (code: string) => string; card: (cardId: string) => string };

/** The first player's staging area in words: "Player 2's staging area (first player)" with two players, "the first player's staging area" otherwise. */
export function firstArea(game: ScenarioState | undefined): string {
  return game && game.seatCount > 1 ? `Player ${game.firstPlayer + 1}'s staging area (first player)` : "the first player's staging area";
}

/** One breaking instruction in words, or null when it is not one of them. */
export function breakingWords(instruction: Instruction, names: Names, game?: ScenarioState): string | null {
  switch (instruction.verb) {
    case "StartSeparateStage":
    case "AdvanceToStage":
      return `advance to ${names.code(instruction.code)}`;
    case "MoveToFirstStaging":
      return `move it to ${firstArea(game)}`;
    case "MovePickedToOwnStaging":
      return "move it to your staging area";
    case "RemoveFromGame":
      return "remove it from the game and from the campaign pool";
    case "FallIntoEvil":
      return `the attached hero becomes an enemy in ${firstArea(game)}`;
    case "ReturnFallenHero":
      return "return the attached hero to its owner's control";
    default:
      return null;
  }
}

/**
 * A whole branch that reads better as one sentence: Uruk-hai Hunter's player that reveals a card or the Hunter that attacks you (142072:A:2),
 * Growing Threat's enemy sent to the first player's staging area or the card that gains Doomed 2 and Surge (142080:A:2).
 */
export function breakingBranchWords(instructions: readonly Instruction[], names: Names, sourceId: string | null, game?: ScenarioState): string | null {
  const source = sourceId ? names.card(sourceId) : "This card";
  const [first, second, third] = instructions;
  if (instructions.length === 3 && first?.verb === "Pick" && first.pick.type === "player" && second?.verb === "SwitchActor" && third?.verb === "RevealEncounter") return "A player you choose reveals an encounter card";
  if (instructions.length === 1 && first?.verb === "AttackFromStaging" && first.target === "self") return `${source} attacks you`;
  if (instructions.length === 2 && first?.verb === "Pick" && first.pick.type === "enemy" && first.pick.engaged === "you" && second?.verb === "MoveToFirstStaging" && second.target === "picked") {
    return `Move an enemy engaged with you to ${firstArea(game)}`;
  }
  if (instructions.length === 2 && first?.verb === "Doomed" && second?.verb === "GainSurge") return `${source} gains Doomed ${first.amount} and Surge: each player raises threat by ${first.amount}, and another card is revealed`;
  return null;
}

/** What a Pick the breaking cards make asks for: the burden card the Seat of Seeing removes, the enemy Growing Threat moves, the player the Hunter lets reveal. */
export function breakingPickWords(pick: Instruction, next: Instruction | undefined, game?: ScenarioState): { verb: string; prompt: string } | null {
  if (pick.verb !== "Pick") return null;
  if (pick.pick.burden === true && next?.verb === "RemoveFromGame") return { verb: "Remove", prompt: "Choose a burden card, in play or in the encounter deck or discard pile, to remove from the game and from the campaign pool." };
  if (pick.pick.type === "enemy" && next?.verb === "MoveToFirstStaging") return { verb: "Move", prompt: `Choose an enemy engaged with you to move to ${firstArea(game)}.` };
  if (pick.pick.type === "player" && next?.verb === "SwitchActor") return { verb: "Choose", prompt: "Choose the player who reveals an encounter card." };
  return null;
}
