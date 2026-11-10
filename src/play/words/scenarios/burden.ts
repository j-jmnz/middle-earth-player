// The words of the burden family's verbs (src/catalog/families/burden.ts) and of RevealMore inside a choice: what a branch of a
// Choose does ("Reduce the Ring-bearer's life by 1", "Shuffle the top card of the burden deck into the encounter deck").
import type { Instruction } from "../../../catalog/boundary.ts";

function amountWords(amount: unknown): string {
  return typeof amount === "number" ? String(amount) : "X";
}

/** One burden instruction in words, or null when it is not one of them (or adds nothing the player decides on). */
export function burdenWords(instruction: Instruction, nameOf: (code: string) => string): string | null {
  switch (instruction.verb) {
    case "ShuffleCopyIntoEachDeck":
      return `each player shuffles 1 ${nameOf(instruction.code)} into their deck`;
    case "ReduceLife":
      return `reduce the Ring-bearer's life by ${amountWords(instruction.amount)}`;
    case "MoveBurden":
      return instruction.to === "encounterTop" ? "put the top card of the burden deck on top of the encounter deck" : "shuffle the top card of the burden deck into the encounter deck";
    case "RevealBurden":
      return "reveal the top card of the burden deck";
    case "RevealMore":
      return instruction.amount === 1 ? "reveal an additional encounter card this phase" : `reveal ${instruction.amount} additional encounter cards this phase`;
    case "EndQuestPhase":
      return "end the quest phase without resolving the quest";
    case "PassFirstPlayer":
      return "pass the first player token to the next player";
    case "ImmediateAttackEach":
      return "each engaged enemy makes an immediate attack";
    case "DiscardRandomFromHand": {
      const cards = instruction.amount == null || instruction.amount === 1 ? "1 card" : `${instruction.amount} cards`;
      return `${instruction.who === "firstPlayer" ? "the first player discards" : "discard"} ${cards} at random from ${instruction.who === "firstPlayer" ? "their" : "your"} hand`;
    }
    case "RemoveAllQuestProgress":
      return "remove all progress from the current quest";
    case "SetStatUntil":
      return `reduce the Ring-bearer's ${instruction.stat} to ${instruction.value} until the end of the ${instruction.until === "endOfRound" ? "round" : "phase"}`;
    default:
      return null;
  }
}

/** A whole branch that reads better as one sentence than instruction by instruction: choosing the Ring-bearer to exhaust it. */
export function burdenBranchWords(instructions: readonly Instruction[]): string | null {
  const [pick, exhaust] = instructions;
  if (instructions.length === 2 && pick?.verb === "Pick" && pick.pick.trait === "Ring-bearer" && exhaust?.verb === "Exhaust" && exhaust.target?.kind === "picked") return "Exhaust the Ring-bearer";
  return null;
}

/** What a Pick the burden cards make asks for: the hero the first player deals one damage to ("divided among heroes he controls"). */
export function burdenPickWords(pick: Instruction, next: Instruction | undefined): { verb: string; prompt: string } | null {
  if (pick.verb === "Pick" && pick.pick.who === "firstPlayer" && pick.pick.type === "hero" && next?.verb === "DamageCard") return { verb: "Damage", prompt: "Choose a hero to take 1 damage." };
  return null;
}
