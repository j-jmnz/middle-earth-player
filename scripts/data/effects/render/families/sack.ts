// The sack family's pieces (src/catalog/families/sack.ts, We Must Away, Ere Break of Day): templates for its verbs and conditions and the samples read-fields.test.ts checks them with.
import { str, type Ctx, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

const BY: Readonly<Record<string, string>> = { cost: "printed cost", attack: "printed Attack", defense: "printed Defense", willpower: "printed Willpower", hitPoints: "printed hit points", attachments: "number of attachments", resources: "resources in its pool" };
const TO: Readonly<Record<string, string>> = { ally: "ally", character: "character (hero or ally)", hero: "hero" };

export const SACK_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  PrepareSackDeck: () => ({ text: "the set-aside Sack cards are shuffled facedown into the Sack deck, a deck of its own beside the encounter deck", read: [] }),
  Sack: (i) => ({ text: `Sack ${str(i.amount)}: the first player draws the top ${str(i.amount)} card(s) of the Sack deck one at a time and resolves each card's When Sacked effect before the next (an empty Sack deck ignores it)`, read: ["amount"] }),
  AttachSacked: (i) => ({ text: `(When Sacked) this Sack card attaches to the ${TO[String(i.to)] ?? str(i.to)} in play, never one titled Gandalf, with a Sack attached or unable to have attachments, with the highest ${BY[String(i.by)] ?? str(i.by)} (the first player chooses among those tied); with none it is shuffled into the Sack deck`, read: ["to", "by"] }),
  RemoveTraitFromGame: (i) => ({ text: `every card with the trait ${(Array.isArray(i.traits) ? i.traits : []).map((trait) => str(trait)).join(" or ")} leaves the game wherever it lies, its attachments with it`, read: ["traits"] }),
  SpendBagginsToTravel: (i) => ({ text: `the first player spends ${str(i.amount)} resources from Bilbo Baggins' pool (${str(i.reduced)} while the card with code ${str(i.purse)} is attached to him; he holds the card with code ${str(i.key)})`, read: ["amount", "reduced", "key", "purse"] }),
};

export const SACK_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  encounterDeckEmpty: () => ({ text: "the encounter deck holds no card", read: [] }),
  bagginsTravel: (c) => ({ text: `Bilbo Baggins has the card with code ${str(c.key)} attached and his pool holds the travel cost: ${str(c.amount)} resources, ${str(c.reduced)} while the card with code ${str(c.purse)} is attached too`, read: ["amount", "reduced", "key", "purse"] }),
};

export const SACK_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  PrepareSackDeck: [{ verb: "PrepareSackDeck" }],
  Sack: [{ verb: "Sack", amount: 2 }],
  AttachSacked: [{ verb: "AttachSacked", to: "ally", by: "cost" }, { verb: "AttachSacked", to: "hero", by: "resources" }],
  RemoveTraitFromGame: [{ verb: "RemoveTraitFromGame", traits: ["Troll", "Sack"] }],
  SpendBagginsToTravel: [{ verb: "SpendBagginsToTravel", amount: 5, reduced: 2, key: "131043", purse: "131042" }],
};

export const SACK_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  encounterDeckEmpty: [{ kind: "encounterDeckEmpty" }],
  bagginsTravel: [{ kind: "bagginsTravel", amount: 5, reduced: 2, key: "131043", purse: "131042" }],
};
