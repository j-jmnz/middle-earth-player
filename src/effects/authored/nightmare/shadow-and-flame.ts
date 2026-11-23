import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { ALWAYS } from "../conditions.ts";

// Shadow and Flame Nightmare (deck 9018, data/printed/nightmare.json). The setup card's A:1 and its side B are the deck-building text (inert: the build removes and shuffles in the cards of the recipe). A:2 to A:4: the encounter cards with the Attack trait are Durin's Bane's shadow cards and lie in
// a Balrog deck of their own, with a Balrog discard pile that is shuffled back in at the beginning of each combat phase and whenever the deck is empty (src/rules/families/flame/balrog.ts). The ten Attack cards have only a Shadow effect and are never revealed. The new cards use the vocabulary of
// ../dwarrowdelf/shadow-and-flame.ts. The readings are in docs/scenarios/dwarrowdelf/shadow-and-flame.md (Shadow and Flame).
// Rules: dwd.durins-bane, rr.forced, rr.shadow-effects, rr.search, rr.travel, rr.damage, rr.hit-points, rr.modifiers, rr.cancel, rr.attachment-cards, faq.additional-attacks (data/rules/entries.json).
const BANE = "Durin's Bane";
const DURINS_BANE: PickSpec = { type: "enemy", control: "any", staging: true, names: [BANE] };
const BANE_UNDAMAGED: Condition = { kind: "count", pick: { type: "enemy", control: "any", staging: true, names: [BANE], damaged: false }, min: 1 };
// "If this attack destroys a character" (the X of an AfterAttack is the characters it destroyed).
const DESTROYED_A_CHARACTER: Condition = { kind: "x", min: 1 };
const NOT_UNDEFENDED: Condition = { kind: "not", condition: { kind: "undefended" } };

export const AUTHORED_EFFECTS: readonly Effect[] = [
    // 901801 setup card. A:2: the 10 Attack cards are formed into the Balrog deck. A:3: Durin's Bane is dealt its shadow cards from it (and they go to the Balrog discard pile). A:4: at the beginning of each combat phase the discard pile is shuffled back into the deck (the deal does it too when the deck is empty).
    { id: "901801:setup:1", cardCode: "901801", lines: ["901801:A:2"], timing: "setup", instructions: [{ verb: "FormBalrogDeck", trait: "Attack" }] },
    {
      id: "901801:constant:1",
      cardCode: "901801",
      lines: ["901801:A:3", "901801:A:4"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "shadowsFromBalrog", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: [BANE] } }],
    },
    { id: "901801:forced:1", cardCode: "901801", lines: ["901801:A:4"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Combat" }, instructions: [{ verb: "ShuffleBalrogDiscard" }] },

    // 901802 Terrible Strength. Shadow: each point of excess combat damage damages another character the defending player controls, and every character so damaged is exhausted.
    {
      id: "901802:shadow:1",
      cardCode: "901802",
      lines: ["901802:A:1"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "excessToDamage", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "ModifyStat", stat: "excessExhausts", amount: 1, until: "endOfAttack", target: "attacker" }],
    },

    // 901803 The Dark Fire. Shadow: for each point of damage dealt by this attack, 1 damage is healed from Durin's Bane.
    { id: "901803:shadow:1", cardCode: "901803", lines: ["901803:A:1"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "Pick", pick: DURINS_BANE }, { verb: "Heal", amount: { dealt: true }, target: "picked" }] }] },

    // 901804 Blazing Grip. Shadow (it cannot be canceled): all cards attached to the defending character are discarded and it is dealt 1 damage; nothing happens when the attack is undefended.
    {
      id: "901804:shadow:1",
      cardCode: "901804",
      lines: ["901804:A:1"],
      timing: "shadow",
      uncancelable: ALWAYS,
      instructions: [{ verb: "DiscardEach", pick: { type: "attachment", control: "any", attachedTo: "defender" }, when: NOT_UNDEFENDED }, { verb: "DamageCard", amount: 1, target: "defender", uncancelable: true, when: NOT_UNDEFENDED }],
    },

    // 901805 Morgoth's Bidding. Shadow: if this attack destroys a character, Durin's Bane makes an additional attack against the defending player after this one (the shadow cards dealt before are discarded first and a new one is dealt).
    {
      id: "901805:shadow:1",
      cardCode: "901805",
      lines: ["901805:A:1"],
      timing: "shadow",
      instructions: [{ verb: "AfterAttack", instructions: [{ verb: "Pick", pick: DURINS_BANE, when: DESTROYED_A_CHARACTER }, { verb: "AttackFromStaging", when: DESTROYED_A_CHARACTER }] }],
    },

    // 901806 Flame of Udûn. Shadow: Durin's Bane is dealt 3 additional shadow cards from the encounter deck (not the Balrog deck).
    {
      id: "901806:shadow:1",
      cardCode: "901806",
      lines: ["901806:A:1"],
      timing: "shadow",
      instructions: [{ verb: "DealShadowTo", target: "attacker", from: "encounter" }, { verb: "DealShadowTo", target: "attacker", from: "encounter" }, { verb: "DealShadowTo", target: "attacker", from: "encounter" }],
    },

    // 901807 Servant of Flame. A:1: +2 Attack and +2 Defense while Durin's Bane has no damage. Shadow: the defending player searches the encounter deck for a treachery card with the Shadow or Flame trait and reveals it, if able; the deck is shuffled.
    {
      id: "901807:constant:1",
      cardCode: "901807",
      lines: ["901807:A:1"],
      timing: "constant",
      condition: BANE_UNDAMAGED,
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay" }],
    },
    { id: "901807:shadow:1", cardCode: "901807", lines: ["901807:A:2"], timing: "shadow", instructions: [{ verb: "SearchReveal", traits: ["Shadow", "Flame"], type: "treachery", who: "actor", deckOnly: true }, { verb: "ShuffleEncounterDeck" }] },

    // 901808 Captain of Mordor. A:1: each enemy gets -20 engagement cost. Shadow: if this attack destroys a character, the attacking enemy cannot take damage until the end of the round.
    { id: "901808:constant:1", cardCode: "901808", lines: ["901808:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -20, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }] },
    {
      id: "901808:shadow:1",
      cardCode: "901808",
      lines: ["901808:A:2"],
      timing: "shadow",
      instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "self", when: DESTROYED_A_CHARACTER }] }],
    },

    // 901809 Fiery Depths. A:1: no progress while it is in the staging area. Travel: each player moves 1 damage from Durin's Bane to a hero (any hero in play) to travel here; unpayable unless Durin's Bane holds a damage for each player.
    // Dark Pools' line (900406:A:1) word for word; the copies test does not read the Nightmare ledger, so the record is written out.
    { id: "901809:constant:1", cardCode: "901809", lines: ["901809:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "901809:travel:1",
      cardCode: "901809",
      lines: ["901809:A:2"],
      timing: "travel",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: DURINS_BANE }, { verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "MoveDamage", amount: 1 }] }],
    },

    // 901810 Crumbling Stairs. A:1: while it is in the staging area each event card costs 1 additional matching resource to play from hand. Shadow: if this attack destroys a character, the defending player discards all event cards in his hand.
    {
      id: "901810:constant:1",
      cardCode: "901810",
      lines: ["901810:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "IncreaseCost", amount: 1, fromHand: true, pick: { type: "card", control: "any", cardType: "event" } }],
    },
    {
      id: "901810:shadow:1",
      cardCode: "901810",
      lines: ["901810:A:2"],
      timing: "shadow",
      instructions: [{ verb: "AfterAttack", instructions: [{ verb: "DiscardEach", pick: { type: "card", control: "you", from: "hand", cardType: "event" }, when: DESTROYED_A_CHARACTER }] }],
    },
];

export const AUTHORED_REPLACES: readonly string[] = [];

