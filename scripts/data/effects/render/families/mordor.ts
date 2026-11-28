// The pieces The Vengeance of Mordor cycle adds (src/catalog/families/mordor.ts): a treachery of the encounter discard pile attached to an enemy, and a lasting effect held by a class of cards.
import { type Samples, type Templates } from "../family-kit.ts";
import { str } from "../kit.ts";

const HOLDERS: Record<string, string> = {
  exhaustedCharacters: "each character in play that is exhausted, read as the table stands (one exhausted later in the phase is held too, one that readies is not)",
  sourceTitle: "each card in play with the title of this card, in the staging area, engaged or the active location (a copy that enters play later in the phase is held too)",
};

export const MORDOR_TEMPLATES: Templates = {
  AttachTreachery: (i) => ({
    text: `${i.from === "picked" ? "the card this effect picked last, if it lies in the encounter discard pile and is a treachery," : i.from !== "discardTop" ? str(i.from) : `the topmost${i.trait ? ` ${str(i.trait)}` : ""} treachery in the encounter discard pile (the last card put there; nothing when none lies there)`} is attached to the ${str(i.to)} enemy as an attachment, its When Revealed effects and Surge not resolved (nothing when the enemy is not in play or cannot have it)`,
    read: ["from", "trait", "to"],
  }),
  ModifyHeld: (i) => ({ text: `${HOLDERS[String(i.holders)] ?? str(i.holders)} gets ${Number(i.amount) > 0 ? "+" : ""}${i.amount} ${str(i.stat)}${i.until === "endOfPhase" ? " until the end of the phase" : ""}`, read: ["stat", "amount", "holders", "until"] }),
};

export const MORDOR_SAMPLES: Samples = {
  AttachTreachery: [{ verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "self" }, { verb: "AttachTreachery", from: "picked", to: "self" }],
  ModifyHeld: [{ verb: "ModifyHeld", stat: "threat", amount: 2, holders: "sourceTitle", until: "endOfPhase" }, { verb: "ModifyHeld", stat: "willpower", amount: -1, holders: "exhaustedCharacters", until: "endOfPhase" }],
};
