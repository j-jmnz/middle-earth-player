import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as ROAD_TO_RIVENDELL } from "../dwarrowdelf/road-to-rivendell.ts";
import { ALWAYS } from "../conditions.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Peril in Pelargir (Against the Shadow part 1, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json). Keywords (Surge, Immune, Archery, Battle) are the cards' own; the Battle stages
// keep an empty record for the reminder text. The piles place The Leaping Fish as the active location; Alcaron's Scroll is dealt by the quest card's Setup (the `attachedChosen` pile). The readings are in docs/scenarios/against-the-shadow/peril-in-pelargir.md (Readings).
// Rules: rr.attachment-cards, rr.objective-cards, rr.ownership-and-control, rr.forced, rr.damage, rr.step-6-4-3, rr.optional-engagement, rr.step-5-2, rr.engaged, rr.travel, rr.search, rr.reveal, rr.running-out-of-cards, rr.quest-advancement, faq.search-effects, faq.progress-without-advancing, faq.enemy-attacks-outside-combat (data/rules/entries.json).
const SCROLL = "05019";
const THUG = "05020";
const SCROLL_NAME = "Alcaron's Scroll";
const SCROLL_ON_A_HERO: Condition = { kind: "attachedToHero", code: SCROLL, is: true };
const SCROLL_NOT_ON_A_HERO: Condition = { kind: "attachedToHero", code: SCROLL, is: false };
const OPTIONALLY: Condition = { kind: "flag", stat: "engagedOptionally", holder: "self" };
const NOT_OPTIONALLY: Condition = { kind: "not", condition: OPTIONALLY };
const UNDEFENDED: Condition = { kind: "undefended" };
const EVERY_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true };
const LOCATION: PickSpec = { type: "location", control: "any" };
const DAMAGE_TO_SCROLL: Instruction = { verb: "ModifyStat", stat: "damageToScroll", amount: 1, until: "endOfAttack", target: "attacker" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 05019 Alcaron's Scroll. A:1: if unattached it returns to the staging area (a claimed objective that returns: the flag) and there gains the Action that any player's ready hero exhausts for to attach it (claim, as the Gate Key's, 12071:A:1). The second
    // flag marks the card that 05020:A:2 and 05024:A:2 look for ("the hero with Alcaron's Scroll attached", read by families/pelargir/scroll.ts). The Scroll on a hero is an attachment he controls, so Pickpocket's Shadow may discard it (reading of 05037:A:2, recommended). A:2: the Forced effect attaches the Scroll to the enemy whose attack damaged the hero (AttachObjectiveTo keeps it a claimed objective).
    {
      id: "05019:constant:1",
      cardCode: SCROLL,
      lines: ["05019:A:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "takesAttackDamage", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "CountsAs", cardType: "attachment" },
      ],
    },
    {
      id: "05019:action:1",
      cardCode: SCROLL,
      lines: ["05019:A:1"],
      timing: "action",
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "canPick", pick: { type: "hero", control: "you", state: "ready" } }] },
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }],
    },
    { id: "05019:forced:1", cardCode: SCROLL, lines: ["05019:A:2"], timing: "forced", trigger: "damagedByAttack", subject: "host", instructions: [{ verb: "AttachObjectiveTo", card: "other" }] },

    // 05020 Harbor Thug. A:1: when the player whose hero has the Scroll raises his threat (the Forced effect's actor is the player who raised it), the Thug engages him, from the staging area or from another player's area. A:2 (Shadow): the damage of this attack goes to
    // the hero with the Scroll (families/defense/damage.ts damageGoesTo), 05024's Shadow is the same line.
    {
      id: "05020:forced:1",
      cardCode: THUG,
      lines: ["05020:A:1"],
      timing: "forced",
      trigger: "threatRaised",
      condition: { kind: "canPick", pick: { type: "hero", control: "you", hasAttachment: { names: [SCROLL_NAME] } } },
      instructions: [{ verb: "Engage", target: "self" }],
    },
    { id: "05020:shadow:1", cardCode: THUG, lines: ["05020:A:2"], timing: "shadow", instructions: [DAMAGE_TO_SCROLL] },

    // 05021 The Leaping Fish (active from Setup). A:1: while the Scroll is attached to a hero at the beginning of the quest phase, X cards (X the players, a deck that runs out is reset) leave the top of the encounter deck and each enemy among them is added to the staging area.
    {
      id: "05021:forced:1",
      cardCode: "05021",
      lines: ["05021:A:1"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, SCROLL_ON_A_HERO] },
      instructions: [{ verb: "DiscardEncounterTop", count: { players: true }, reset: true }, { verb: "StageDiscarded", type: "enemy" }],
    },

    // 05022 Pelargir Docks. While it is the active location every enemy in play, engaged or in the staging area, gets +1 Attack and +1 Defense.
    {
      id: "05022:constant:1",
      cardCode: "05022",
      lines: ["05022:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: EVERY_ENEMY },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: EVERY_ENEMY },
      ],
    },

    // 05023 Harbor Storehouse. A:1: while it is in play the table announces the cards that leave the top of the encounter deck (the flag), and each location among them raises each player's threat by 1. A:2 (Shadow): one more shadow card for each Thug in play, counted
    // as the effect resolves (the staging area and every player's engagement area).
    { id: "05023:constant:1", cardCode: "05023", lines: ["05023:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noteDeckDiscards", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "05023:forced:1", cardCode: "05023", lines: ["05023:A:1"], timing: "forced", trigger: "discardedFromEncounterDeck", subject: LOCATION, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
    {
      id: "05023:shadow:1",
      cardCode: "05023",
      lines: ["05023:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Repeat", times: { count: { ...EVERY_ENEMY, trait: "Thug" } }, instructions: [{ verb: "DealShadowTo", target: "attacker", inPlay: true }] }],
    },

    // 05024 Collateral Damage. A:1, sentence by sentence: discard 2; count the copies in the discard pile now and discard 2 for each (the cards of both steps are the ones "discarded by this effect"); then raise each player's threat by 2 for each location among them.
    {
      id: "05024:whenRevealed:1",
      cardCode: "05024",
      lines: ["05024:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "DiscardEncounterTop", count: 2, reset: true },
        { verb: "DiscardEncounterTopMore", count: { count: { type: "treachery", control: "any", from: "encounterDiscard", names: ["Collateral Damage"] }, times: 2 }, reset: true },
        { verb: "RaiseThreatPerDiscarded", type: "location", amount: 2 },
      ],
    },

    // 05037 Pickpocket. A:1: when it attacks, the defending player discards 1 resource from a hero of his choice and 1 card at random from his hand, each part as far as it can be done. A:2 (Shadow): 1 of his attachments he controls (an encounter attachment such as Local
    // Trouble is not his; the Scroll on his hero is), all of them when the attack is undefended.
    {
      id: "05037:forced:1",
      cardCode: "05037",
      lines: ["05037:A:1"],
      timing: "forced",
      trigger: "attacks",
      subject: "self",
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", hasResources: true } }, { verb: "DiscardResources", amount: 1, target: "picked" }, { verb: "DiscardRandomFromHand" }],
    },
    {
      id: "05037:shadow:1",
      cardCode: "05037",
      lines: ["05037:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "Pick", pick: { type: "attachment", control: "you", controlled: true }, when: { kind: "not", condition: UNDEFENDED } },
        { verb: "DiscardPicked", when: { kind: "not", condition: UNDEFENDED } },
        { verb: "Each", pick: { type: "attachment", control: "you", controlled: true }, instructions: [{ verb: "DiscardPicked" }], when: UNDEFENDED },
      ],
    },

    // 05038 City Street. While it is in the staging area the players can travel only to a location titled City Street (the trait City is no title).
    { id: "05038:constant:1", cardCode: "05038", lines: ["05038:A:2"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "Restrict", what: "travel", exceptTitle: "City Street" }] },

    // 05039 Market Square (Immune to player card effects is a keyword). Travel: each player spends 1 resource from one of his heroes' pools, and the players cannot travel here when one cannot. Shadow: the defending player discards every resource of his heroes.
    { id: "05039:travel:1", cardCode: "05039", lines: ["05039:A:2"], timing: "travel", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SpendResources", amount: 1 }] }] },
    { id: "05039:shadow:1", cardCode: "05039", lines: ["05039:A:3"], timing: "shadow", instructions: [{ verb: "Each", pick: { type: "hero", control: "you" }, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] }] },

    // 05040 Lost in the City. A:1: each player in turn searches the encounter deck and discard pile for a City location and adds it to the staging area (no reveal), then the deck is shuffled; nothing cancels it. A:2 (Shadow): the defending player discards his hand.
    {
      id: "05040:whenRevealed:1",
      cardCode: "05040",
      lines: ["05040:A:1"],
      timing: "whenRevealed",
      uncancelable: ALWAYS,
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "location", trait: "City", to: "staging" }] }, { verb: "ShuffleEncounterDeck" }],
    },
    { id: "05040:shadow:1", cardCode: "05040", lines: ["05040:A:2"], timing: "shadow", instructions: [{ verb: "DiscardHand" }] },

    // 05041 Local Trouble. A:1: it attaches to the hero with the highest threat cost among those without a copy (the first player chooses among those tied; with none it is discarded as a treachery), and counts as a Condition attachment whose text raises the
    // hero's controller's threat by 1 each time the hero exhausts, readies or triggers an ability.
    { id: "05041:whenRevealed:1", cardCode: "05041", lines: ["05041:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachToHighestThreatCost" }] },
    { id: "05041:constant:1", cardCode: "05041", lines: ["05041:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    ...(["exhausted", "readied", "abilityTriggered"] as const).map(
      (trigger, at): Effect => ({ id: `05041:triggered:${at + 1}`, cardCode: "05041", lines: ["05041:A:1"], timing: "triggered", trigger, subject: "host", instructions: [{ verb: "RaiseThreat", amount: 1, who: "hostController" }] }),
    ),

    // 05042 Zealous Traitor, 05043 Lossarnach Bandit, 05044 Umbar Assassin (Archery is a keyword). Forced: when it engages a player, by the optional engagement or in any other way, the player pays the lighter price (1 damage to each ally, 1 resource from each hero, 3 damage
    // to a hero he chooses) if he chose the engagement and the heavier one (2, 2, the chosen hero discarded) otherwise. The engine marks an engagement the player chose (machine.ts, the flag `engagedOptionally`).
    {
      id: "05042:forced:1",
      cardCode: "05042",
      lines: ["05042:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [
        { verb: "Each", pick: { type: "ally", control: "you" }, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }], when: OPTIONALLY },
        { verb: "Each", pick: { type: "ally", control: "you" }, instructions: [{ verb: "DamageCard", amount: 2, target: "picked" }], when: NOT_OPTIONALLY },
      ],
    },
    {
      id: "05043:forced:1",
      cardCode: "05043",
      lines: ["05043:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [
        { verb: "Each", pick: { type: "hero", control: "you", hasResources: true }, instructions: [{ verb: "DiscardResources", amount: 1, target: "picked" }], when: OPTIONALLY },
        { verb: "Each", pick: { type: "hero", control: "you", hasResources: true }, instructions: [{ verb: "DiscardResources", amount: 2, target: "picked" }], when: NOT_OPTIONALLY },
      ],
    },
    {
      id: "05044:forced:1",
      cardCode: "05044",
      lines: ["05044:A:2"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [
        { verb: "Pick", pick: { type: "hero", control: "you" } },
        { verb: "DamageCard", amount: 3, target: "picked", when: OPTIONALLY },
        { verb: "Discard", target: { kind: "picked" }, when: NOT_OPTIONALLY },
      ],
    },

    // 05045 Lurking in Shadows. A:1: every engaged Brigand, any player's, returns to the staging area, and with none returned the card gains surge. A:2 (Shadow): Ruined Road's, returned once the attack ends.
    {
      id: "05045:whenRevealed:1",
      cardCode: "05045",
      lines: ["05045:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", trait: "Brigand", who: "each", pick: "all" } }, { verb: "GainSurge", when: { kind: "noneReturned" } }],
    },
    copyLine("04042:A:2", "05045:A:2"),
    copyLine("05020:A:2", "05024:A:2"),

    // 05065 The Leaping Fish (stage 1). A:1: the Fish is the active location by the piles; the Scroll is set aside out of the encounter deck and attached to a hero the first player chooses, claimed (as the Book of Mazarbul, 03067:A:1), and the deck is shuffled after the
    // search. B:1: Battle is a keyword, the record owns the reminder text. B:2: each player searches the encounter deck (not the discard pile) for a Harbor Thug and adds it to the staging area, then the deck is shuffled.
    {
      id: "05065:setup:1",
      cardCode: "05065",
      lines: ["05065:A:1"],
      timing: "setup",
      instructions: [
        { verb: "SetAside", code: SCROLL },
        { verb: "Pick", pick: { type: "hero", control: "any", attachable: SCROLL, who: "firstPlayer" } },
        { verb: "AttachSetAside", code: SCROLL, claimed: true },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    { id: "05065:constant:1", cardCode: "05065", lines: ["05065:B:1"], timing: "constant", instructions: [] },
    {
      id: "05065:whenRevealed:1",
      cardCode: "05065",
      lines: ["05065:B:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", code: THUG, to: "staging", deckOnly: true }] }, { verb: "ShuffleEncounterDeck" }],
    },
    copyLine("05065:B:1", "05066:B:1"),

    // 05066 Fighting in the Streets (stage 2). B:2: while the Scroll is not on a hero the stage is not advanced, though it takes progress; it advances once the Scroll is attached (the settle check of a stage held back, stage-reveal.ts advanceFreed). B:3: the Scroll goes to
    // the enemy in play with the highest engagement cost, the staging area included (the first player chooses among those tied) and from wherever it is, or to the staging area when no enemy is in play.
    { id: "05066:constant:2", cardCode: "05066", lines: ["05066:B:2"], timing: "constant", condition: SCROLL_NOT_ON_A_HERO, instructions: [{ verb: "Restrict", what: "advance" }] },
    {
      id: "05066:whenRevealed:1",
      cardCode: "05066",
      lines: ["05066:B:3"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { ...EVERY_ENEMY, highestEngagementCost: true, who: "firstPlayer" } },
        { verb: "AttachObjectiveTo", code: SCROLL, card: "picked", orStaging: true },
      ],
    },

    // 05067 Escape to the Quays (stage 3). A:1: each player in turn searches the encounter deck and discard pile for an enemy, which joins the staging area without being revealed, then the deck is shuffled. B:1: no enemy is optionally engaged. B:2: the first enemy the
    // encounter deck reveals each round attacks, from the staging area, the player whose hero has the Scroll (no attack when no hero does). B:3: the stage is not defeated while the Scroll is not on a hero; defeating the last stage wins the game.
    {
      id: "05067:whenRevealed:1",
      cardCode: "05067",
      lines: ["05067:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "enemy", to: "staging" }] }, { verb: "ShuffleEncounterDeck" }],
    },
    { id: "05067:constant:1", cardCode: "05067", lines: ["05067:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    {
      id: "05067:forced:1",
      cardCode: "05067",
      lines: ["05067:B:2"],
      timing: "forced",
      trigger: "revealed",
      byEncounterDeck: true,
      subject: { type: "enemy", control: "any" },
      condition: { kind: "firstEnemy" },
      instructions: [{ verb: "AttackScrollHolder", code: SCROLL }],
    },
    { id: "05067:constant:2", cardCode: "05067", lines: ["05067:B:3"], timing: "constant", condition: SCROLL_NOT_ON_A_HERO, instructions: [{ verb: "Restrict", what: "advance" }] },
  ],
  { pool: ROAD_TO_RIVENDELL },
);

export const AUTHORED_REPLACES: readonly string[] = [];
