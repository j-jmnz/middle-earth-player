import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for We Must Away, Ere Break of Day (the-hobbit cycle part 1, no campaign card). Every line is read from the scan ledger (data/printed/); the Western Lands set's records are set-western-lands.ts. The readings are in docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md (We Must Away, Ere Break of Day).
// Bilbo Baggins is dealt by the loadout, never by a Setup record, and the cycle has no log: the "discovered" treasure line stores nothing.
// Rules: hob.setup-we-must-away-ere-break-of-day, hob.sack-deck, hob.sack-x, hob.sack-x-example, rr.attachment-cards, rr.forced, rr.response, rr.travel, rr.victory, rr.doomed-x, rr.engaged, rr.objective-cards (data/rules/entries.json).
const BILBO = "Bilbo Baggins";
const TROLL: PickSpec = { type: "enemy", control: "any", trait: "Troll", staging: true };
const TROLL_IN_STAGING: PickSpec = { type: "enemy", control: "any", trait: "Troll", stagingOnly: true };
const TROLL_IN_STAGING_NOW: Condition = { kind: "count", pick: TROLL_IN_STAGING, min: 1 };
const NO_TROLL_IN_STAGING: Condition = { kind: "count", pick: TROLL_IN_STAGING, max: 0 };
const ATTACKER_IS_TROLL: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Troll", staging: true } };
// A Sack card on a character is an encounter card that nobody controls (`onCharacter`).
const SACK_CARD: PickSpec = { type: "objective", control: "any", trait: "Sack", onCharacter: true };
const TRAVEL_COST = { amount: 5, reduced: 2, key: "131043", purse: "131042" } as const;
const TRAVEL_PAYABLE: Condition = { kind: "bagginsTravel", ...TRAVEL_COST };
const SELF_ENGAGED: Condition = { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "sourceIn", zone: "engaged" }] };

// Forced: "Return ~ to the staging area at the end of the combat phase. The engaged player may raise his threat by 1 to cancel this effect."
const RETURN_UNLESS_RAISED: Instruction[] = [
  {
    verb: "ForEachPlayer",
    order: "firstFirst",
    seats: "engaged",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "return", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }, { id: "raise", instructions: [{ verb: "RaiseThreat", amount: 1, who: "actor" }] }] }],
  },
];

// A Troll Key and Troll Purse that are discarded come back to the staging area; one in the staging area with no host waits for a Troll.
const WAIT_FOR_TROLL: Instruction[] = [{ verb: "Pick", pick: { ...TROLL, who: "firstPlayer" } }, { verb: "AttachSelfToPicked", unlimited: true }];

function sackRecords(code: string, attach: Instruction): Effect[] {
  return [{ id: `${code}:triggered:1`, cardCode: code, lines: [`${code}:A:1`], timing: "triggered", trigger: "sacked", instructions: [attach] }];
}

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 131023 An Unexpected Party. The three Trolls and Troll Cave are set aside by the deal; the Sack cards are set aside too, and the Setup builds the Sack deck from them. The table notes the cards placed in the encounter discard pile, which the Key and the Purse hear when stage 2B discards them from the deck.
  {
    id: "131023:setup:1",
    cardCode: "131023",
    lines: ["131023:A:1"],
    timing: "setup",
    instructions: [{ verb: "PrepareSackDeck" }, { verb: "ModifyStat", stat: "noteEncounterDiscards", amount: 1, until: "endOfGame", target: "table" }, { verb: "ShuffleEncounterDeck" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }],
  },

  // 131024 Roast Mutton.
  {
    id: "131024:whenRevealed:1",
    cardCode: "131024",
    lines: ["131024:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AddSetAsideToStaging", trait: "Troll", all: true }, { verb: "AddSetAsideToStaging", code: "131037" }, { verb: "ShuffleEncounterDiscard" }],
  },
  // Forced: the stage advances when no Troll enemy is left in play (checked as one is destroyed) or the moment the encounter deck has no card (the event `encounterDeckEmpty`, announced before any reset of the deck: recorded reading, rr.forced, rr.running-out-of-cards). One line, two events that can make it true.
  {
    id: "131024:forced:1",
    cardCode: "131024",
    lines: ["131024:B:1"],
    timing: "forced",
    trigger: "enemyDestroyed",
    subject: { type: "enemy", control: "any", trait: "Troll", staging: true },
    condition: { kind: "enemyInPlay", trait: "Troll", is: false },
    instructions: [{ verb: "AdvanceStage" }],
  },
  { id: "131024:forced:2", cardCode: "131024", lines: ["131024:B:1"], timing: "forced", trigger: "encounterDeckEmpty", condition: { kind: "encounterDeckEmpty" }, instructions: [{ verb: "AdvanceStage" }] },
  { id: "131024:constant:1", cardCode: "131024", lines: ["131024:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressDiscards", amount: 1, until: "whileSourceInPlay" }] },

  // 131025 Dawn Take You All. Nothing is stored for the discovered treasure: the cycle has no log.
  { id: "131025:whenRevealed:1", cardCode: "131025", lines: ["131025:B:1"], timing: "whenRevealed", instructions: [{ verb: "RemoveTraitFromGame", traits: ["Troll", "Sack"] }] },
  { id: "131025:constant:1", cardCode: "131025", lines: ["131025:B:2"], timing: "constant", instructions: [{ verb: "WinGame" }] },

  // 131032 William, 131033 Bert, 131034 Tom.
  {
    id: "131032:constant:1",
    cardCode: "131032",
    lines: ["131032:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: TROLL_IN_STAGING }],
  },
  { id: "131032:forced:1", cardCode: "131032", lines: ["131032:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Sack", amount: 2 }] },
  { id: "131032:forced:2", cardCode: "131032", lines: ["131032:A:3"], timing: "forced", trigger: "endOfPhase", condition: SELF_ENGAGED, instructions: RETURN_UNLESS_RAISED },
  { id: "131033:constant:1", cardCode: "131033", lines: ["131033:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noAttachmentPlays", amount: 1, until: "whileSourceInPlay", holders: TROLL }] },
  { id: "131033:forced:1", cardCode: "131033", lines: ["131033:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Sack", amount: 1 }] },
  copyLine("131032:A:3", "131033:A:3"),
  { id: "131034:constant:1", cardCode: "131034", lines: ["131034:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "singleAttacker", amount: 1, until: "whileSourceInPlay", holders: TROLL }] },
  copyLine("131033:A:2", "131034:A:2"),
  copyLine("131032:A:3", "131034:A:3"),

  // 131036 Troll Camp. A:2: the Action Bilbo gains is the Camp's own (an Action of a location in play is any player's), so a Sack on Bilbo does not bar it; Bilbo's controller pays by exhausting him and spending his Baggins resource.
  {
    id: "131036:constant:1",
    cardCode: "131036",
    lines: ["131036:A:1"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay", holders: TROLL }],
  },
  {
    id: "131036:action:1",
    cardCode: "131036",
    lines: ["131036:A:2"],
    timing: "action",
    cost: [{ kind: "exhaustNamed", name: BILBO }, { kind: "resources", amount: 1, sphere: "baggins" }],
    condition: { kind: "canPick", pick: SACK_CARD },
    instructions: [{ verb: "Pick", pick: SACK_CARD }, { verb: "Discard", target: { kind: "picked" } }],
  },

  // 131037 Troll Cave. Immune to player card effects is its keyword.
  // The players cannot travel here unless Bilbo holds the Troll Key and his pool pays; the cost is paid as they travel (nothing between the two moves a resource).
  { id: "131037:constant:1", cardCode: "131037", lines: ["131037:A:2"], timing: "constant", condition: { kind: "not", condition: TRAVEL_PAYABLE }, instructions: [{ verb: "Restrict", what: "travel" }] },
  { id: "131037:forced:1", cardCode: "131037", lines: ["131037:A:2"], timing: "forced", trigger: "traveled", subject: "self", instructions: [{ verb: "SpendBagginsToTravel", ...TRAVEL_COST }] },

  // 131038 Hobbit-lands.
  // Hobbit-lands has 1 quest point, so every placement of progress on it explores it. Like Dreary Hills and Lone-Lands (set-western-lands.ts) the Response hears `progressPlacedOnSelf`, which is announced for the exploring placement too (families/burden/effects.ts).
  { id: "131038:response:1", cardCode: "131038", lines: ["131038:A:1"], timing: "response", trigger: "progressPlacedOnSelf", subject: "self", instructions: [{ verb: "Draw", amount: 1, who: "firstPlayer" }] },
  { id: "131038:shadow:1", cardCode: "131038", lines: ["131038:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "discardTop", to: "deckTop" }] },

  // 131042 Troll Purse, 131043 Troll Key.
  { id: "131042:constant:1", cardCode: "131042", lines: ["131042:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay" }] },
  { id: "131042:forced:1", cardCode: "131042", lines: ["131042:A:1"], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },
  { id: "131042:forced:2", cardCode: "131042", lines: ["131042:A:1"], timing: "forced", trigger: "addedToStaging", subject: "self", condition: { kind: "sourceIn", zone: "staging" }, instructions: WAIT_FOR_TROLL },
  {
    id: "131042:forced:3",
    cardCode: "131042",
    lines: ["131042:A:1"],
    timing: "forced",
    trigger: "addedToStaging",
    subject: { type: "enemy", control: "any", trait: "Troll", staging: true },
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: WAIT_FOR_TROLL,
  },
  // A copy discarded from the encounter deck (stage 2B's discards) or from play goes to the staging area ("If discarded").
  { id: "131042:forced:4", cardCode: "131042", lines: ["131042:A:1"], timing: "forced", trigger: "encounterDiscarded", subject: "self", condition: { kind: "sourceIn", zone: "encounterDiscard" }, instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },
  // The first player's Response, offered as the host is destroyed (hostDestroyed: before the Forced return of this card to the staging area, rr.timing-of-ability-resolution); the cost is one resource of the Baggins sphere.
  {
    id: "131042:response:1",
    cardCode: "131042",
    lines: ["131042:A:2"],
    timing: "response",
    trigger: "hostDestroyed",
    cost: { kind: "resources", amount: 1, sphere: "baggins" },
    instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", names: [BILBO] } }, { verb: "ClaimObjective", fromHost: true }],
  },
  copyLine("131042:A:1", "131043:A:1"),
  {
    id: "131043:response:1",
    cardCode: "131043",
    lines: ["131043:A:2"],
    timing: "response",
    trigger: "enemyDamagedByAttack",
    subject: "host",
    cost: { kind: "exhaustNamed", name: BILBO },
    instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", names: [BILBO] } }, { verb: "ClaimObjective", fromHost: true }],
  },

  // 131044 to 131050 the Sack cards: When Sacked is the record answering the Sack X draw (hob.sack-x); the constant holds the attached character. Six lines print "(excluding Gandalf)"; 131050 prints none and no span bars Gandalf from every Sack (hob.sack-x, hob.sack-x-example), so a hero titled Gandalf can take A Worn Sack.
  ...sackRecords("131044", { verb: "AttachSacked", to: "ally", by: "cost" }),
  {
    id: "131044:constant:1",
    cardCode: "131044",
    lines: ["131044:A:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotDefend", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotTriggerEffects", amount: 1, until: "whileSourceInPlay", target: "host" },
    ],
  },
  ...sackRecords("131045", { verb: "AttachSacked", to: "character", by: "attack" }),
  ...sackRecords("131046", { verb: "AttachSacked", to: "character", by: "defense" }),
  ...sackRecords("131047", { verb: "AttachSacked", to: "character", by: "hitPoints" }),
  ...sackRecords("131048", { verb: "AttachSacked", to: "character", by: "willpower" }),
  ...sackRecords("131049", { verb: "AttachSacked", to: "character", by: "attachments" }),
  ...sackRecords("131050", { verb: "AttachSacked", to: "hero", by: "resources", anyTitle: true }),
  copyLine("131044:A:2", "131045:A:2"),
  copyLine("131044:A:2", "131046:A:2"),
  copyLine("131044:A:2", "131047:A:2"),
  copyLine("131044:A:2", "131048:A:2"),
  copyLine("131044:A:2", "131049:A:2"),
  copyLine("131044:A:2", "131050:A:2"),

  // 131051 Lots or None at All.
  {
    id: "131051:whenRevealed:1",
    cardCode: "131051",
    lines: ["131051:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Sack", amount: 1, when: TROLL_IN_STAGING_NOW }, { verb: "Doomed", amount: 2, when: NO_TROLL_IN_STAGING }],
  },
  { id: "131051:shadow:1", cardCode: "131051", lines: ["131051:A:2"], timing: "shadow", cancel: { cost: 1, sphere: "baggins" }, instructions: [{ verb: "Sack", amount: 1, when: ATTACKER_IS_TROLL }] },

  // 131052 A Nice Pickle.
  {
    id: "131052:whenRevealed:1",
    cardCode: "131052",
    lines: ["131052:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "Repeat", times: { players: true, times: 2 }, instructions: [{ verb: "MoveEncounterCard", card: "discardTop", to: "deckBottom" }] }],
  },
  { id: "131052:shadow:1", cardCode: "131052", lines: ["131052:A:3"], timing: "shadow", instructions: [{ verb: "ShuffleSelfIntoEncounterDeck" }] },

  // 131053 Roast 'Em or Boil 'Em?
  {
    id: "131053:whenRevealed:1",
    cardCode: "131053",
    lines: ["131053:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "DamageEach", amount: 2, pick: { type: "ally", control: "any" }, when: TROLL_IN_STAGING_NOW }, { verb: "DamageEach", amount: 1, pick: { type: "ally", control: "any" }, when: NO_TROLL_IN_STAGING }],
  },
  { id: "131053:shadow:1", cardCode: "131053", lines: ["131053:A:2"], timing: "shadow", instructions: [{ verb: "SearchToStaging", code: "131036", deckOnly: true }, { verb: "ShuffleEncounterDeck", when: { kind: "thenResolves" } }] },

  // 131054 Hungry Troll.
  // The Surge record comes first in the list so that it reads the staging area before the chosen Troll is engaged: a lone staged Troll is engaged and the card gains no Surge.
  { id: "131054:whenRevealed:2", cardCode: "131054", lines: ["131054:A:1"], timing: "whenRevealed", instructions: [{ verb: "GainSurge", when: NO_TROLL_IN_STAGING }] },
  {
    id: "131054:whenRevealed:1",
    cardCode: "131054",
    lines: ["131054:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: { ...TROLL_IN_STAGING, who: "firstPlayer" } }, { verb: "EngageFirstPlayer", target: "picked" }],
  },
  {
    id: "131054:shadow:1",
    cardCode: "131054",
    lines: ["131054:A:2"],
    timing: "shadow",
    cancel: { cost: 2, sphere: "baggins" },
    instructions: [{ verb: "DamageEach", amount: 4, pick: { type: "character", control: "any", hasAttachment: { trait: "Sack" } } }],
  },
]);

export const AUTHORED_REPLACES: readonly string[] = [];
