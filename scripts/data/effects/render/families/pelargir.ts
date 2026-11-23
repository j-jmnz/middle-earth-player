// The pelargir family's pieces (src/catalog/families/pelargir.ts): Alcaron's Scroll, the treachery that attaches to the hero with the highest threat cost, the discards Collateral Damage counts in two steps, and the flags those cards read: templates, samples and stat notes.
import { cardRef } from "../amounts.ts";
import { amt, type Samples, type Templates } from "../family-kit.ts";
import { str } from "../kit.ts";

export const PELARGIR_TEMPLATES: Templates = {
  AttachObjectiveTo: (i) => ({
    text: `${typeof i.code === "string" ? `the objective in play with code ${i.code}` : "this objective"} leaves the hero, the enemy or the staging area it is on and attaches to ${cardRef(str(i.card ?? "picked"))}, an enemy in play that may have attachments; it stays a claimed objective that no player controls, so it returns to the staging area when it is detached${i.orStaging === true ? "; with no enemy to attach to it is added to the staging area instead" : "; with no such enemy nothing happens"}`,
    read: ["card", "code", "orStaging"],
  }),
  AttachToHighestThreatCost: () => ({ text: "this card attaches to the hero with the highest printed threat cost among the heroes (any player's) that carry no copy of it and may have it, the first player choosing among heroes tied; with no such hero it is not attached", read: [] }),
  AttackScrollHolder: (i) => ({
    text: `the enemy the event is about, in the staging area, makes an immediate attack against the player whose hero has the card with code ${str(i.code)} attached, from the staging area: it is dealt a shadow card and the defender may be declared; with no such hero (the card is in the staging area or on an enemy) there is no attack`,
    read: ["code"],
  }),
  DiscardEncounterTopMore: (i, ctx) => ({
    text: `discard ${amt(i.count, ctx)} card(s) from the top of the encounter deck${i.reset === true ? " (a deck that runs out in the quest phase is reset from the discard pile and the discard goes on)" : ""}; they join the cards this effect discarded before, so a later amount "discarded by this effect" counts them all`,
    read: ["count", "reset"],
  }),
  RaiseThreatPerDiscarded: (i) => ({
    text: `raise each player's threat by ${String(i.amount)} for each ${str(i.type)} card this effect discarded from the top of the encounter deck, in any of its discard steps, even one a reset of the deck put back in it`,
    read: ["type", "amount"],
  }),
};

export const PELARGIR_SAMPLES: Samples = {
  AttachObjectiveTo: [{ verb: "AttachObjectiveTo", card: "other" }, { verb: "AttachObjectiveTo", code: "05019", card: "subject", orStaging: true }],
  AttachToHighestThreatCost: [{ verb: "AttachToHighestThreatCost" }],
  AttackScrollHolder: [{ verb: "AttackScrollHolder", code: "05019" }],
  DiscardEncounterTopMore: [{ verb: "DiscardEncounterTopMore", count: 2, reset: true }],
  RaiseThreatPerDiscarded: [{ verb: "RaiseThreatPerDiscarded", type: "location", amount: 2 }],
};

export const PELARGIR_STAT_NOTES: Readonly<Record<string, string>> = {
  damageToScroll: " (the damage its attack deals to the defending player's characters goes to the hero the card holding takesAttackDamage is attached to instead, if a hero holds it; with none the damage stays where it was assigned)",
  takesAttackDamage: " (the hero it is attached to takes the damage of an attack whose enemy holds damageToScroll)",
  engagedOptionally: " (marker: the player chose this enemy in the optional engagement step; set before the engagement is announced, in a game with a card that reads it)",
  noteDeckDiscards: " (held by the table: a card that goes from the top of the encounter deck to its discard pile is announced, so a card that hears \"discarded from the encounter deck\" answers it)",
  firstEnemy: " (marker: the first enemy the encounter deck revealed this round, read by the condition firstEnemy; set only in a game with a card that reads it)",
  firstEnemyNoted: " (held by the table until the end of the round: an enemy was already marked firstEnemy this round)",
};
