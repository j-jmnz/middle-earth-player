// The pieces The Vengeance of Mordor cycle adds (src/catalog/families/mordor.ts): a treachery of the encounter discard pile attached to an enemy, a lasting effect held by a class of cards, and the verbs and the condition of Danger in Dorwinion.
import type { ConditionTemplates, Samples, Templates } from "../family-kit.ts";
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
  VictoryWhenFreeAddsResource: (i) => ({ text: `a constant marker: when this card in the staging area is free of encounters (nothing is attached to it as its guard) it is added to the victory display and ${str(i.amount)} resource is placed on the main quest card`, read: ["amount"] }),
  ModifyHeld: (i) => ({ text: `${HOLDERS[String(i.holders)] ?? str(i.holders)} gets ${Number(i.amount) > 0 ? "+" : ""}${i.amount} ${str(i.stat)}${i.until === "endOfPhase" ? " until the end of the phase" : ""}`, read: ["stat", "amount", "holders", "until"] }),
};

export const MORDOR_CONDITIONS: ConditionTemplates = {
  raisedThreatThisRound: () => ({ text: "the acting player raised their threat this round, by any effect or cost (false unless the table holds the flag noteThreatRaised)", read: [] }),
};

export const MORDOR_CONDITION_SAMPLES: Samples = { raisedThreatThisRound: [{ kind: "raisedThreatThisRound" }] };

export const MORDOR_SAMPLES: Samples = {
  AddRandomSetAsideToStaging: [{ verb: "AddRandomSetAsideToStaging", trait: "Plot" }],
  ConvertAttachedAlly: [{ verb: "ConvertAttachedAlly" }],
  ReturnConvertedAlly: [{ verb: "ReturnConvertedAlly" }, { verb: "ReturnConvertedAlly", ifOwnerGone: true }],
  ResolveActiveTravel: [{ verb: "ResolveActiveTravel" }],
  KeepDealtShadow: [{ verb: "KeepDealtShadow" }],
  ResolveHeldShadowEffects: [{ verb: "ResolveHeldShadowEffects" }],
  PlaceResourcePerDiscarded: [{ verb: "PlaceResourcePerDiscarded", cardType: "event" }],
  RevealFacedownUnder: [{ verb: "RevealFacedownUnder" }],
  BarDamageToEngaged: [{ verb: "BarDamageToEngaged", who: "firstPlayer", until: "endOfRound" }],
  VictoryWhenFreeAddsResource: [{ verb: "VictoryWhenFreeAddsResource", amount: 1 }],
  AttachTreachery: [{ verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "self" }, { verb: "AttachTreachery", from: "picked", to: "self" }],
  ModifyHeld: [{ verb: "ModifyHeld", stat: "threat", amount: 2, holders: "sourceTitle", until: "endOfPhase" }, { verb: "ModifyHeld", stat: "willpower", amount: -1, holders: "exhaustedCharacters", until: "endOfPhase" }],
};
