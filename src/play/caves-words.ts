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

/** The two Actions of "No Time to Waste!" (41048:A:2) and Ranger Sense (41049:A:2) put the card out of the game first: said benefit first, with one trailing clause for that cost
 * ("Each player lowers threat by 3 and an encounter card is revealed. This card leaves the game and the Campaign Pool."). Null when the branch does not start that way. */
export function cavesLeavesWords(instructions: readonly Instruction[], say: (instruction: Instruction) => string | null): string | null {
  const [pool, game, ...rest] = instructions;
  if (pool?.verb !== "RemoveFromCampaignPool" || game?.verb !== "RemoveSourceFromGame" || rest.length === 0) return null;
  const parts = rest.flatMap((instruction): string[] => {
    switch (instruction.verb) {
      case "LowerThreat":
        return instruction.who === "eachSeat" && typeof instruction.amount === "number" ? [`each player lowers threat by ${instruction.amount}`] : [say(instruction) ?? ""];
      case "RevealEncounter":
        return ["an encounter card is revealed"];
      case "LookAtTop":
        return typeof instruction.count === "number" && instruction.deck === "own" ? [`look at the top ${instruction.count} cards of your deck`] : [say(instruction) ?? ""];
      // The card looked at is the one that goes to the hand; the rest go back on top.
      case "Pick":
      case "ArrangeTop":
        return [];
      case "MovePicked":
        return instruction.to === "hand" ? ["put 1 into your hand"] : [say(instruction) ?? ""];
      default:
        return [say(instruction) ?? ""];
    }
  });
  if (parts.length === 0 || parts.some((part) => part === "")) return null;
  const benefit = parts.join(" and ");
  return `${benefit.charAt(0).toUpperCase()}${benefit.slice(1)}. This card leaves the game and the Campaign Pool.`;
}

/** The Cave Torch's X (41029:A:2, "place up to 3 progress on a Dark location"): the Choose ChooseX opens holds only SetX options, and the Pick and PlaceProgressOn that
 * read X wait in the queue. The sheet then asks for the progress, not for "X": null when the choice is anything else. */
export function cavesXChoice(choose: Extract<Instruction, { verb: "Choose" }>, queue: readonly Instruction[]): { note: string; label: (optionId: string) => string } | null {
  if (!choose.options.every((option) => option.instructions.length === 1 && option.instructions[0]?.verb === "SetX")) return null;
  const [pick, place] = queue;
  if (pick?.verb !== "Pick" || place?.verb !== "PlaceProgressOn" || typeof place.amount !== "object" || place.amount.x !== true) return null;
  return {
    note: "Choose how much progress to place on a Dark location.",
    label: (optionId) => {
      const set = choose.options.find((option) => option.id === optionId)?.instructions[0];
      return set?.verb === "SetX" ? `Place ${set.value} progress` : optionId;
    },
  };
}

/** Watchful Eyes (41040:A:1) is a treachery that attaches itself to a hero as it is revealed: the hero it is attached to, not one that "carries" a boon or a burden. Null for any other card. */
export function cavesAttachWords(asked: Instruction, sourceName: string | null): { verb: string; prompt: string } | null {
  return asked.verb === "AttachSelf" && asked.to.kind === "hero" && sourceName === "Watchful Eyes" ? { verb: "Attach", prompt: `Choose a hero to attach ${sourceName} to.` } : null;
}
