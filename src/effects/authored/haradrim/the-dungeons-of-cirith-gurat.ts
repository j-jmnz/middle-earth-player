import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Dungeons of Cirith Gurat (haradrim cycle part 8, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json). See docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md, Readings
// A character attached to an encounter card is a Captive (the captive zone, families/captives): AttachCaptive puts it there, the Captives objective blanks and strips it, and its host leaving play rescues it (RescueCaptured). Abaan lies the same way under Dungeon Cell.
// Rules: hrd.setup-the-dungeons-of-cirith-gurat, hrd.captives-of-cirith-gurat, hrd.guarded-heroes, hrd.side-quests, hrd.encounter-side-quests, rr.guarded, rr.attachment-cards, rr.blank, rr.immune, rr.forced, rr.shadow-effects, rr.cancel, rr.travel, rr.engagement-check, rr.attacks-outside-the-combat-phase, rr.doomed-x, rr.printed, rr.first-player.
type Instruction = Effect["instructions"][number];

const ABAAN = "17120";
const CAPTIVES = "17119";
const STAGE_1 = "17132";
const STAGE_2 = "17133";
const STAGE_3 = "17134";

// Every captive in play (a hero, an ally, Abaan), the ones the acting seat owns, and an encounter card that holds one: "guarding an objective".
const CAPTIVE: PickSpec = { type: "card", control: "any", captive: "only" };
const MY_CAPTIVE: PickSpec = { ...CAPTIVE, ownedByActor: true };
const HELD_BY_SOURCE: PickSpec = { ...CAPTIVE, heldBySource: true };
const GUARDING: PickSpec = { type: "card", control: "any", guardsCaptive: true };
const GUARDS: Condition = { kind: "matches", card: "self", pick: GUARDING };
const ATTACKER_GUARDS: Condition = { kind: "matches", card: "attacker", pick: GUARDING };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const MY_ALLY: PickSpec = { type: "ally", control: "you" };
// "An unattached enemy (or location) in the staging area": nothing is attached to it, no attachment of any kind and no captive.
const UNATTACHED_ENEMY: PickSpec = { type: "enemy", control: "any", stagingOnly: true, unattached: true };
const UNATTACHED_ENEMY_OR_LOCATION: PickSpec = { type: "card", control: "any", stagingOnly: true, enemyOrLocation: true, unattached: true };
// "If this attack destroys an ally": the attack's X is the characters it destroyed, and the one it destroyed is an ally.
const DESTROYED_AN_ALLY: Condition = { kind: "all", conditions: [{ kind: "x", min: 1 }, { kind: "matches", card: "other", pick: { type: "card", control: "any", cardType: "ally" }, inPlay: false }] };
const ORC_FOUND: Condition = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Orc" }, inPlay: false };
const ATTACH_PICKED_TO_PREVIOUS: Instruction = { verb: "AttachCaptive", card: "previous", to: "picked" };

// "When this card is attached ... ": a defending ally the attacker's Threat beats, read at the shadow (17121:A:2).
const THREAT_BEATS_ALLY: Condition = { kind: "all", conditions: [{ kind: "threatAboveWillpower" }, { kind: "matches", card: "defender", pick: { type: "ally", control: "any" } }] };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 17119 The Captives of Cirith Gurat (objective). A character attached to an encounter card is a guarded objective with a blank text box (the captive zone, blankText); when it is attached its tokens and attachments are discarded
  // (Forced on `attached`); when the encounter card that holds it leaves play it is free of encounters and its owner takes control of it, exhausted (Forced on `leftPlay`, RescueCaptured; a side quest that holds one rescues them itself when it is defeated, 17131:A:2).
  { id: `${CAPTIVES}:constant:1`, cardCode: CAPTIVES, lines: [`${CAPTIVES}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: CAPTIVE }] },
  { id: `${CAPTIVES}:forced:1`, cardCode: CAPTIVES, lines: [`${CAPTIVES}:A:2`], timing: "forced", trigger: "attached", subject: CAPTIVE, instructions: [{ verb: "StripCaptive" }] },
  { id: `${CAPTIVES}:forced:2`, cardCode: CAPTIVES, lines: [`${CAPTIVES}:A:3`], timing: "forced", trigger: "leftPlay", subject: { ...GUARDING, enemyOrLocation: true }, instructions: [{ verb: "RescueCaptured" }] },

  // 17120 Abaan (objective ally; A:3, the loss, is a template). While free of encounters the first player gains control of him; Response: after he exhausts, a Harad character gets +1 Willpower, Attack and Defense for the round.
  { id: `${ABAAN}:constant:1`, cardCode: ABAAN, lines: [`${ABAAN}:A:1`], timing: "constant", instructions: [{ verb: "GainControlWhenFree", who: "firstPlayer" }] },
  {
    id: `${ABAAN}:response:1`,
    cardCode: ABAAN,
    lines: [`${ABAAN}:A:2`],
    timing: "response",
    trigger: "exhausted",
    subject: "self",
    instructions: [
      { verb: "Pick", pick: { type: "character", control: "any", trait: "Harad" } },
      { verb: "ModifyStat", stat: "willpower", amount: 1, until: "endOfRound", target: "picked" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "picked" },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "endOfRound", target: "picked" },
    ],
  },

  // 17121 Jailer of Cirith Gurat. Forced: after it engages you, an ally you control is attached to it. Shadow: when its Threat beats the defending ally's Willpower the ally is attached to the attacker, then the attack is canceled.
  { id: "17121:forced:1", cardCode: "17121", lines: ["17121:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: MY_ALLY }, { verb: "AttachCaptive", card: "picked", to: "self" }] },
  {
    id: "17121:shadow:1",
    cardCode: "17121",
    lines: ["17121:A:2"],
    timing: "shadow",
    instructions: [{ verb: "AttachCaptive", card: "defender", to: "attacker", when: THREAT_BEATS_ALLY }, { verb: "CancelAttack", when: { kind: "all", conditions: [{ kind: "threatAboveWillpower" }, { kind: "matches", card: "defender", pick: CAPTIVE }] } }],
  },

  // 17122 Prison Guard. While it guards an objective it gets +2 Defense; while it guards none it gains the Forced: after it attacks and damages an ally, that ally is attached to it.
  { id: "17122:constant:1", cardCode: "17122", lines: ["17122:A:1"], timing: "constant", condition: GUARDS, instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "17122:forced:1",
    cardCode: "17122",
    lines: ["17122:A:2"],
    timing: "forced",
    trigger: "attackDamagedCharacter",
    subject: "self",
    condition: { kind: "all", conditions: [{ kind: "matches", card: "self", pick: { ...GUARDING, type: "enemy", guardsCaptive: false } }, { kind: "matches", card: "other", pick: { type: "ally", control: "any" } }] },
    instructions: [{ verb: "AttachCaptive", card: "other", to: "self" }],
  },

  // 17123 Dungeon Warg (Surge and the Shadow are templates). When Revealed: it makes an immediate attack against the player who controls the most allies, the first player choosing among those that tie.
  { id: "17123:whenRevealed:1", cardCode: "17123", lines: ["17123:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttackSeatWithMost", pick: MY_ALLY }] },

  // 17124 Gate of Iron. While it is in the staging area no progress is placed on a location there. Travel: the top card of the encounter deck is discarded; then the first player discards a card from his hand with a cost above its Threat, or each player raises his threat by 3.
  { id: "17124:constant:1", cardCode: "17124", lines: ["17124:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
  {
    id: "17124:travel:1",
    cardCode: "17124",
    lines: ["17124:A:2"],
    timing: "travel",
    instructions: [
      { verb: "MoveEncounterCard", card: "deckTop", to: "discard" },
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "discard", requires: { kind: "canPick", pick: { type: "card", control: "you", from: "hand", costAboveDiscardedThreat: true } }, instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "hand", costAboveDiscardedThreat: true } }, { verb: "DiscardPicked" }] },
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eachSeat" }] },
        ],
      },
    ],
  },

  // 17125 Dungeon Cell (Surge is a template). +X Threat, X the printed Willpower of the attached objective. In the staging area it gains the Forced: after an ally is destroyed, it is attached to Dungeon Cell when nothing is attached to it.
  { id: "17125:constant:1", cardCode: "17125", lines: ["17125:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { heldPrinted: { stat: "willpower" } }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "17125:forced:1",
    cardCode: "17125",
    lines: ["17125:A:3"],
    timing: "forced",
    trigger: "characterDestroyed",
    subject: { type: "card", control: "any", cardType: "ally" },
    condition: { kind: "all", conditions: [IN_STAGING, { kind: "matches", card: "self", pick: { type: "location", control: "any", guardsCaptive: false } }] },
    instructions: [{ verb: "AttachCaptive", card: "subject", to: "self" }],
  },

  // 17126 Uruk Guardroom. While it is in the staging area each ally costs 1 more to play (two copies add). Travel: the encounter discard pile is shuffled into the deck, cards are discarded until an Orc enemy is, and it is added to the staging area.
  { id: "17126:constant:1", cardCode: "17126", lines: ["17126:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "IncreaseCost", amount: 1, pick: { type: "card", control: "any", cardType: "ally" } }] },
  {
    id: "17126:travel:1",
    cardCode: "17126",
    lines: ["17126:A:2"],
    timing: "travel",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "enemy", trait: "Orc" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: ORC_FOUND }],
  },

  // 17127 Mines of Cirith Gurat. In the staging area a player card reduces a player's threat by at most 1. Travel: each player discards the top 3 cards of his deck and raises his threat by 1 for each ally discarded.
  { id: "17127:constant:1", cardCode: "17127", lines: ["17127:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threatReductionToOne", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  {
    id: "17127:travel:1",
    cardCode: "17127",
    lines: ["17127:A:2"],
    timing: "travel",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: 3, count: { type: "ally", control: "any", looked: true } }, { verb: "RaiseThreat", amount: { x: true }, who: "actor", when: { kind: "x", min: 1 } }] }],
  },

  // 17128 Torture Room. When Revealed: the first player discards from his deck until an ally; it is attached to Torture Room and each other copy of it in play is discarded. While it guards an objective it gains the Forced: at the end of the round each player raises his threat by 1.
  {
    id: "17128:whenRevealed:1",
    cardCode: "17128",
    lines: ["17128:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ActAs", who: "firstPlayer" }, { verb: "DiscardUntilAlly" }, { verb: "AttachCaptive", card: "picked", to: "self", discardCopies: true }],
  },
  { id: "17128:forced:1", cardCode: "17128", lines: ["17128:A:2"], timing: "forced", trigger: "endOfRound", condition: GUARDS, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },

  // 17129 Taken Prisoner. When Revealed: the first player attaches an ally he controls to an unattached enemy or location in the staging area; with no ally or no such card it gains doomed 2. Shadow: +1 Attack; a destroyed ally reveals the top encounter card.
  {
    id: "17129:whenRevealed:1",
    cardCode: "17129",
    lines: ["17129:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ActAs", who: "firstPlayer" },
      { verb: "Doomed", amount: 2, when: { kind: "any", conditions: [{ kind: "less", left: { count: MY_ALLY }, right: 1 }, { kind: "less", left: { count: UNATTACHED_ENEMY_OR_LOCATION }, right: 1 }] } },
      { verb: "Pick", pick: MY_ALLY },
      { verb: "Pick", pick: UNATTACHED_ENEMY_OR_LOCATION },
      ATTACH_PICKED_TO_PREVIOUS,
    ],
  },
  {
    id: "17129:shadow:1",
    cardCode: "17129",
    lines: ["17129:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "RevealEncounter", when: DESTROYED_AN_ALLY }] }],
  },

  // 17130 Tormented by Orcs. When Revealed: each player raises his threat by 1 for each guarded objective he owns; with a player who owns none it gains surge. Shadow: the attacker gets +1 Defense until the end of the phase, +2 instead while it guards an objective.
  {
    id: "17130:whenRevealed:1",
    cardCode: "17130",
    lines: ["17130:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RaiseThreat", amount: { count: MY_CAPTIVE }, who: "actor" }, { verb: "GainSurge", when: { kind: "captives", max: 0, of: "actor" } }] }],
  },
  {
    id: "17130:shadow:1",
    cardCode: "17130",
    lines: ["17130:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "endOfPhase", target: "attacker", when: { kind: "not", condition: ATTACKER_GUARDS } },
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "attacker", when: ATTACKER_GUARDS },
    ],
  },

  // 17131 Captured! (encounter side quest). When Revealed: each player loses control of an ally he controls and attaches it to this stage; with none attached it is discarded and an additional encounter card is revealed. Forced: when it is defeated each player
  // reduces his threat by the printed cost of the ally of his that was attached (the allies are rescued with it).
  {
    id: "17131:whenRevealed:1",
    cardCode: "17131",
    lines: ["17131:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: MY_ALLY }, { verb: "AttachCaptive", card: "picked", to: "self" }] },
      { verb: "Discard", target: { kind: "self" }, when: { kind: "not", condition: { kind: "canPick", pick: HELD_BY_SOURCE } } },
      { verb: "RevealEncounter", when: { kind: "not", condition: { kind: "canPick", pick: HELD_BY_SOURCE } } },
    ],
  },
  {
    id: "17131:forced:1",
    cardCode: "17131",
    lines: ["17131:A:2"],
    timing: "forced",
    trigger: "questDefeated",
    subject: "self",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "LowerThreat", amount: { heldPrinted: { stat: "cost", ownedByActor: true } }, who: "actor" }] }, { verb: "RescueCaptured", host: "self" }],
  },

  // 17132 Rescue the Prisoners (stage 1). Setup: Uruk Chieftain is set aside and The Captives and Dungeon Cell are added to the staging area (the piles); Abaan is attached to Dungeon Cell; each player searches the encounter deck for a different Orc enemy and
  // adds it to the staging area; the deck is shuffled; each player discards from his deck until an ally not in play and attaches it to an unattached enemy in the staging area. B: an enemy or location in the staging area that guards an objective is immune to
  // player card effects; after characters are rescued an encounter card is revealed; it cannot be defeated while a guarded objective is in play.
  {
    id: `${STAGE_1}:setup:1`,
    cardCode: STAGE_1,
    lines: [`${STAGE_1}:A:1`],
    timing: "setup",
    instructions: [
      { verb: "Pick", pick: { type: "location", control: "any", stagingOnly: true, names: ["Dungeon Cell"] } },
      { verb: "AttachCaptive", code: ABAAN, to: "picked" },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "enemy", trait: "Orc", to: "staging", different: true, deckOnly: true }] },
      { verb: "ShuffleEncounterDeck" },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardUntilAlly", notInPlay: true }, { verb: "Pick", pick: UNATTACHED_ENEMY }, ATTACH_PICKED_TO_PREVIOUS] },
    ],
  },
  { id: `${STAGE_1}:constant:1`, cardCode: STAGE_1, lines: [`${STAGE_1}:B:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { ...GUARDING, stagingOnly: true } }] },
  { id: `${STAGE_1}:forced:1`, cardCode: STAGE_1, lines: [`${STAGE_1}:B:2`], timing: "forced", trigger: "charactersRescued", subject: "self", instructions: [{ verb: "RevealEncounter" }] },
  { id: `${STAGE_1}:constant:2`, cardCode: STAGE_1, lines: [`${STAGE_1}:B:3`], timing: "constant", condition: { kind: "canPick", pick: CAPTIVE }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 17133 Sneak Past the Guards (stage 2). When Revealed: the discard pile is shuffled into the deck and each player discards until an enemy and adds it to the staging area. B: an enemy in the staging area cannot take damage and gets +X engagement cost, X the progress here;
  // at the end of the round an encounter card is revealed and, when no enemy was engaged that round, a resource is placed here; it cannot be defeated with fewer than 2 resources.
  { id: `${STAGE_2}:whenRevealed:1`, cardCode: STAGE_2, lines: [`${STAGE_2}:A:1`], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }] },
  {
    id: `${STAGE_2}:constant:1`,
    cardCode: STAGE_2,
    lines: [`${STAGE_2}:B:1`],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } },
      { verb: "ModifyStat", stat: "engagementCost", amount: { stat: "progress", of: "self" }, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } },
    ],
  },
  {
    id: `${STAGE_2}:forced:1`,
    cardCode: STAGE_2,
    lines: [`${STAGE_2}:B:2`],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [{ verb: "RevealEncounter" }, { verb: "PlaceResourceTokens", amount: 1, on: "self", when: { kind: "engagedThisRound", is: false, anySeat: true } }],
  },
  { id: `${STAGE_2}:constant:2`, cardCode: STAGE_2, lines: [`${STAGE_2}:B:3`], timing: "constant", condition: { kind: "less", left: { stat: "resources", of: "self" }, right: 2 }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 17134 Fight Your Way Out (stage 3). When Revealed: the first player adds Uruk Chieftain to the staging area; each player attaches a hero he controls, as a captive, to an unattached enemy there; then the players make engagement checks against each enemy in the staging
  // area, an enemy that guards no objective checking with an engagement cost of 0. B: at the beginning of the quest phase cards are discarded until an enemy, which is added to the staging area. It cannot be defeated while a guarded objective is in play; defeating it wins the game.
  {
    id: `${STAGE_3}:whenRevealed:1`,
    cardCode: STAGE_3,
    lines: [`${STAGE_3}:A:1`],
    timing: "whenRevealed",
    instructions: [
      { verb: "AddSetAsideToStaging", code: "16061" },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "Pick", pick: UNATTACHED_ENEMY }, ATTACH_PICKED_TO_PREVIOUS] },
      { verb: "ModifyStat", stat: "engagementCostZeroUnguarded", amount: 1, until: "endOfPhase", target: "table" },
      { verb: "MakeEngagementChecks" },
    ],
  },
  {
    id: `${STAGE_3}:forced:1`,
    cardCode: STAGE_3,
    lines: [`${STAGE_3}:B:1`],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [{ verb: "DiscardUntil", type: "enemy", reshuffle: true }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false } }],
  },
  { id: `${STAGE_3}:constant:1`, cardCode: STAGE_3, lines: [`${STAGE_3}:B:2`], timing: "constant", condition: { kind: "canPick", pick: CAPTIVE }, instructions: [{ verb: "Restrict", what: "advance" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
