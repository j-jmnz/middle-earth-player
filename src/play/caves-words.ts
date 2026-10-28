// The words of the choices The Caves of Nibin-Dûm asks (src/effects/authored/the-caves-of-nibin-dum.ts, pool/TDoM.ts): the amount of progress the Cave Torch places, the flags its cards set,
// and the verbs of the caves family (src/catalog/families/caves.ts) a Choose branch can hold.
import type { Instruction } from "../catalog/boundary.ts";

/** What an asking instruction wants chosen, or null when it is not one of the caves family's: X for the Cave Torch's progress, the card Branching Paths reveals. */
export function cavesPickWords(asked: Instruction, next: Instruction | undefined): { verb: string; prompt: string } | null {
  if (asked.verb === "PickEncounter" && next?.verb === "BottomOtherLooked") return { verb: "Reveal", prompt: "Choose the card to reveal: the other cards you looked at go to the bottom of the encounter deck." };
  if (asked.verb !== "ChooseX") return null;
  const most = asked.max.length === 1 && typeof asked.max[0] === "number" ? ` to ${asked.max[0]}` : "";
  return { verb: "Choose X", prompt: `Choose X, from ${asked.min ?? 1}${most}.` };
}

/** A flag a record sets on the table, in words ("No progress can be placed on the quest until the end of the phase"), or null when it is not one of the caves family's. */
export function cavesFlagWords(instruction: Extract<Instruction, { verb: "ModifyStat" }>): string | null {
  const until = instruction.until === "endOfPhase" ? " until the end of the phase" : instruction.until === "endOfRound" ? " until the end of the round" : "";
  switch (instruction.stat) {
    case "noQuestProgress":
      return `no progress can be placed on the quest${until}`;
    case "questProgressCap":
      return `no more than ${typeof instruction.amount === "number" ? instruction.amount : "X"} progress can be placed on the quest each round`;
    case "combatDamageCanceled":
      return `all combat damage dealt to it is canceled${until}`;
    default:
      return null;
  }
}

/** One instruction of the caves family, in words, or null when it is not one of them. */
export function cavesWords(instruction: Instruction, nameOf: (code: string) => string): string | null {
  switch (instruction.verb) {
    case "RemoveSourceFromGame":
      return "remove this card from the game";
    case "SetAsideInPlay":
      return `set ${nameOf(instruction.code)} aside, out of play`;
    case "BottomOtherLooked":
      return "put the other cards you looked at on the bottom of the encounter deck";
    case "RemoveFromCampaignPool":
      return "remove this card from the Campaign Pool";
    default:
      return null;
  }
}
