// The words of the attachments family's verbs (src/catalog/families/attachments.ts) inside a choice: what a branch of a Choose
// does ("Heal up to 5 damage from among characters you control") and what a step-by-step choice asks for.
import type { Instruction } from "../../catalog/boundary.ts";

type AttachmentVerb = Extract<
  Instruction,
  {
    verb:
      | "PlayInto"
      | "AttachSourceTo"
      | "Guarded"
      | "GuardWith"
      | "HealAmong"
      | "ChooseAttackers"
      | "QuestProgressFirst";
  }
>;

function amountWords(amount: unknown): string {
  return typeof amount === "number" ? String(amount) : "X";
}

/** One of the attachments family's instructions in words, or null when it is not one of them. */
export function attachmentWords(instruction: Instruction): string | null {
  const verb = instruction as AttachmentVerb;
  switch (verb.verb) {
    case "AttachSourceTo":
      return "attach this card to that card";
    case "HealAmong":
      return `heal up to ${amountWords(verb.amount)} damage from among characters you control`;
    case "ChooseAttackers":
      return "declare an attack against the attached enemy";
    case "QuestProgressFirst":
      return verb.first ? "place progress from questing on the location before the quest" : "place progress from questing on the quest";
    case "GuardWith":
      return "reveal encounter cards until this card is guarded";
    case "PlayInto":
    case "Guarded":
      return null;
    default:
      return null;
  }
}

/** What one of the family's step-by-step choices asks for: the button and the prompt. Null for another verb. */
export function attachmentPickWords(asked: Instruction): { verb: string; prompt: string } | null {
  switch (asked.verb) {
    case "HealAmong":
      return { verb: "Heal", prompt: "Choose a character to heal 1 damage from, or Done to stop." };
    case "ChooseAttackers":
      return { verb: "Attack", prompt: "Choose a character to attack the enemy, or Done once all attackers are declared." };
    default:
      return null;
  }
}

/** What a Reattach asks (the "attach ~ to another hero" Action, the Command that moves a picked attachment): the card that moves is named, and the new host is another one. */
export function reattachWords(instruction: Extract<Instruction, { verb: "Reattach" }>, moved: string | null): { verb: string; prompt: string } {
  return { verb: "Attach", prompt: `Choose another ${instruction.card === "picked" ? "card" : "hero"} to attach ${moved ?? "it"} to.` };
}
