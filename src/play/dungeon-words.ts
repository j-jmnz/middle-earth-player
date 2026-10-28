// The words of the objectives, prisoner and dungeon families' verbs (src/catalog/families/{objectives,prisoner,dungeon}.ts) inside a choice: what a
// branch of a Choose, or the instruction after a Pick, does.
import type { Instruction } from "../catalog/boundary.ts";

function amountWords(amount: unknown): string {
  return typeof amount === "number" ? String(amount) : "X";
}

/** One instruction of those families in words, or null when it is not one of them. */
export function dungeonWords(instruction: Instruction, nameOf: (code: string) => string): string | null {
  switch (instruction.verb) {
    case "GuardObjective":
      return "reveal the next encounter card that is not an objective and attach it to the objective";
    case "ClaimObjective":
      return "claim this objective and attach it to the chosen hero";
    case "TakePrisoner":
      return "turn a hero chosen at random facedown: it is the prisoner";
    case "SelectLoggedPrisoner":
      return "the prisoner the Campaign Log names is the prisoner instead";
    case "CaptureWithPrisoner":
      return `capture ${nameOf(instruction.code)} facedown with the prisoner`;
    case "RescuePrisoner":
      return `rescue the prisoner: it comes back faceup with ${instruction.damage} damage on it`;
    case "FreeCaptive":
      return `free ${nameOf(instruction.code)} faceup with ${instruction.damage} damage on him`;
    case "PlaceOrcGuard":
      return "turn the top card of your deck into an Orc Guard engaged with you";
    case "AttachToDeck":
      return "attach it to the top of the first player's deck";
    case "TurnFaceUp":
      return `turn ${nameOf(instruction.code)} faceup, still out of play`;
    case "RaiseStagingThreat":
      return `raise the total Threat in the staging area by ${amountWords(instruction.amount)} until the end of the ${instruction.until === "endOfRound" ? "round" : "phase"}`;
    case "LimitPlays":
      return `the players play at most ${instruction.max} ${instruction.cardType} card${instruction.max === 1 ? "" : "s"} each round`;
    default:
      return null;
  }
}
