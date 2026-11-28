// The pieces The Vengeance of Mordor cycle adds (src/catalog/families/mordor.ts): a treachery of the encounter discard pile attached to an enemy, a lasting effect held by a class of cards, and the verbs and the condition of Danger in Dorwinion.
import { pck, type ConditionTemplates, type Samples, type Templates } from "../family-kit.ts";
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
  AddRandomSetAsideToStaging: (i) => ({ text: `one random set-aside card with the trait ${str(i.trait)} (drawn by the game seed, by the player who resolves this) is added to the staging area, faceup and not revealed (nothing when none is set aside)`, read: ["trait"] }),
  ConvertAttachedAlly: () => ({ text: "the ally this card is attached to loses the ally card type and gains the enemy card type, its text box blank (its own Attack, Defense and hit points stay, its Threat is its Willpower), and it engages its owner (nothing when the host is not an ally in a player's area)", read: [] }),
  ReturnConvertedAlly: (i) => ({
    text: i.ifOwnerGone === true ? "when the owner of the ally this card is attached to is eliminated, that ally goes to its owner's discard pile as the ally card it printed, and this card is discarded" : "each ally made an enemy by Secret Cultist that no Secret Cultist is attached to any more (this one left play, or the enemy was defeated) goes to its owner's discard pile as the ally card it printed",
    read: ["ifOwnerGone"],
  }),
  ResolveActiveTravel: () => ({ text: "the Travel effect of the active location resolves as an effect of that card: its cost is not paid and the players do not travel (nothing with no active location, a blank text box or no Travel effect)", read: [] }),
  KeepDealtShadow: () => ({ text: "the shadow card just dealt to this enemy becomes its first shadow card, the ones it held lying faceup beside it; when it has a shadow effect it is kept faceup on this enemy past the end of the combat phase, until the enemy leaves play", read: [] }),
  ResolveHeldShadowEffects: () => ({ text: "each faceup shadow card this enemy holds with a shadow effect resolves that effect now against the attack in progress, the defending player resolving it, in the order they were dealt", read: [] }),
  PlaceResourcePerDiscarded: (i) => ({ text: `1 resource is placed on this card for each ${str(i.cardType)} card among those this effect discarded from the top of the players' decks, all the decks counted together`, read: ["cardType"] }),
  RevealFacedownUnder: () => ({ text: "each card facedown under this card is revealed by the acting player as an encounter card that is not from the encounter deck (its When Revealed resolves, a location or enemy is added to the staging area)", read: [] }),
  BarDamageToEngaged: (i) => ({ text: `until the end of the round, enemies engaged with the ${i.who === "firstPlayer" ? "first player" : str(i.who)} cannot take damage, read as the table stands (an enemy that engages that player later in the round is held too)`, read: ["who"] }),
  RevealPowerOfMordor: (i) => ({ text: `${i.removeDamage ? `up to ${(i.removeDamage as { amount: number }).amount} damage token(s) come off the card in play with printed code ${(i.removeDamage as { code: string }).code}, then ` : ""}the first player reveals the top card of the Power of Mordor deck as an encounter card (an objective stays in the staging area, an enemy or a location is added to it; whatever leaves play goes to the encounter discard pile, never back to the deck)${i.onEmpty === "loseGame" ? "; with no card to reveal the players lose the game" : ""}`, read: ["onEmpty", "removeDamage"] }),
  ShuffleStagesUnder: (i) => ({ text: `the quest cards ${(i.codes as readonly string[]).map(str).join(", ")} are shuffled together on top of the quest deck; the quest then advances in the order of its quest deck, each stage that prints Victory is added to the victory display when it is defeated, and defeating the last one wins the game`, read: ["codes"] }),
  PickLowestDefense: (i, ctx) => ({ text: `the card of the pick with the lowest Defense as the table shows it becomes the picked card (the first player chooses among those tied; nothing is picked when none matches): ${pck(i.pick, ctx)}`, read: ["pick"] }),
  PutUnderDial: (i) => ({ text: `the top ${i.count} cards of the acting player's deck are placed facedown under his threat dial (they lie under this card, still his, in the order of his deck)`, read: ["count"] }),
  DiscardUnderDial: () => ({ text: "the top card under the acting player's threat dial goes to his discard pile (nothing with none under it); the cards under the dials go back into their owners' decks, shuffled, when this card is defeated", read: [] }),
  DiscardCopiesOfLooked: () => ({ text: "the acting player discards each card in his hand, and each card he controls in play, with the title of a card the last discard took from the top of his deck", read: [] }),
  ModifyHeld: (i) => ({ text: `${HOLDERS[String(i.holders)] ?? str(i.holders)} gets ${Number(i.amount) > 0 ? "+" : ""}${i.amount} ${str(i.stat)}${i.until === "endOfPhase" ? " until the end of the phase" : ""}`, read: ["stat", "amount", "holders", "until"] }),
};

export const MORDOR_CONDITIONS: ConditionTemplates = {
  controlsOutnumberStaging: () => ({ text: "the players control more locations than the staging area holds (the active location is not in the staging area)", read: [] }),
  raisedThreatThisRound: () => ({ text: "the acting player raised their threat this round, by any effect or cost (false unless the table holds the flag noteThreatRaised)", read: [] }),
};

export const MORDOR_CONDITION_SAMPLES: Samples = { raisedThreatThisRound: [{ kind: "raisedThreatThisRound" }], controlsOutnumberStaging: [{ kind: "controlsOutnumberStaging" }] };

export const MORDOR_SAMPLES: Samples = {
  AddRandomSetAsideToStaging: [{ verb: "AddRandomSetAsideToStaging", trait: "Plot" }],
  ConvertAttachedAlly: [{ verb: "ConvertAttachedAlly" }],
  ReturnConvertedAlly: [{ verb: "ReturnConvertedAlly" }, { verb: "ReturnConvertedAlly", ifOwnerGone: true }],
  ResolveActiveTravel: [{ verb: "ResolveActiveTravel" }],
  KeepDealtShadow: [{ verb: "KeepDealtShadow" }],
  ResolveHeldShadowEffects: [{ verb: "ResolveHeldShadowEffects" }],
  PlaceResourcePerDiscarded: [{ verb: "PlaceResourcePerDiscarded", cardType: "event" }],
  RevealFacedownUnder: [{ verb: "RevealFacedownUnder" }],
  RevealPowerOfMordor: [{ verb: "RevealPowerOfMordor", onEmpty: "loseGame" }],
  ShuffleStagesUnder: [{ verb: "ShuffleStagesUnder", codes: ["21081", "21083", "21084", "21085"] }],
  PickLowestDefense: [{ verb: "PickLowestDefense", pick: { type: "enemy", control: "any", staging: true, trait: "Easterling" } }],
  PutUnderDial: [{ verb: "PutUnderDial", count: 10 }],
  DiscardUnderDial: [{ verb: "DiscardUnderDial" }],
  DiscardCopiesOfLooked: [{ verb: "DiscardCopiesOfLooked" }],
  BarDamageToEngaged: [{ verb: "BarDamageToEngaged", who: "firstPlayer", until: "endOfRound" }],
  AttachTreachery: [{ verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "self" }, { verb: "AttachTreachery", from: "picked", to: "self" }],
  ModifyHeld: [{ verb: "ModifyHeld", stat: "threat", amount: 2, holders: "sourceTitle", until: "endOfPhase" }, { verb: "ModifyHeld", stat: "willpower", amount: -1, holders: "exhaustedCharacters", until: "endOfPhase" }],
};
