import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The River Running (Vengeance of Mordor part 1, A Shadow in the East, no campaign card): Easterling Pursuit and the four Easterling enemies, the Riverland and Plains locations, the Easterling treacheries that attach to enemies, the two quest stages and the two
// encounter side quests. Every line is read from the scan ledger (data/printed/vengeance-of-mordor.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The scenario's readings are in
// docs/scenarios/vengeance-of-mordor/the-river-running.md; the vocabulary the box adds is in src/catalog/families/mordor.ts (an attached treachery, a lasting effect held by a class of cards).
// Rules: rr.attachment-cards, rr.treachery-cards, rr.forced, rr.travel, rr.cost, rr.cancel, rr.damage, rr.first-player, rr.engaged, rr.optional-engagement, rr.step-5-2, rr.step-7-2, rr.running-out-of-cards, rr.lasting-effects, rr.modifiers, rr.shadow-effects,
// rr.then, rr.the-word-choose, rr.current-quest, faq.lasting-effects, faq.cancel-encounter-effect, faq.enemy-attacks-outside-combat, faq.side-quest-current-quest-text, faq.triggering-forced-effects (data/rules/entries.json).
const PURSUIT = "21012";
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// "Place 1 resource on Easterling Pursuit" (nothing is placed while it is not in play).
const PLACE_ON_PURSUIT: Instruction = { verb: "PlaceResourceTokens", amount: 1, code: PURSUIT };
// "At least 3 resources here" (21012:A:1) and the resources on Easterling Pursuit.
const THREE_RESOURCES: Condition = { kind: "tokens", code: PURSUIT, min: 3 };
const PURSUIT_RESOURCES = { stat: "resources", ofNamed: "Easterling Pursuit" } as const;
const ATTACKER_PLUS = (amount: number, when?: Condition): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", ...(when ? { when } : {}) });
// "If this attack destroys a character": the attack's X is the characters it destroyed.
const DESTROYED_A_CHARACTER: Condition = { kind: "x", min: 1 };
// The Easterling attachments on the source enemy (a Horse, a Sword of Rhûn, a Recurve Bow, whatever treachery attached to it).
const EASTERLING_ATTACHMENTS = { type: "attachment", control: "any", attachedTo: "source", trait: "Easterling" } as const satisfies PickSpec;
// "An Easterling enemy in play (staging area or engaged) without the attachment": the candidates of an Easterling treachery that attaches itself when revealed; the first player chooses among those the stat leaves tied.
const CANDIDATE = (title: string, narrowed: Partial<PickSpec>): PickSpec => ({ type: "enemy", control: "any", staging: true, trait: "Easterling", hasAttachment: { names: [title], none: true }, who: "firstPlayer", ...narrowed });
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const EXHAUSTED_HERO: PickSpec = { type: "hero", control: "you", state: "exhausted" };
const EASTERLING_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, trait: "Easterling" };
// "While a player is engaged with an enemy" (21076:B:2): an enemy engaged with any player.
const SOME_PLAYER_ENGAGED: Condition = { kind: "any", conditions: [{ kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you" } }, { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "other" } }] };
// "Easterling Horse", "Sword of Rhûn" and "Recurve Bow" attach to an enemy while they are in play (rr.attachment-cards): the Weapon and Mount lines are their texts.
const CARRIED_ATTACHMENT = (code: string, line: string, trait: "Mount" | "Weapon"): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait }] });
const ATTACH_TO_PICKED = (title: string, narrowed: Partial<PickSpec>): Instruction[] => [
  { verb: "Pick", pick: CANDIDATE(title, narrowed) },
  { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: CANDIDATE(title, narrowed) } },
];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 21012 Easterling Pursuit (objective). Forced: at the end of the round it gets 1 resource; with 3 or more, 3 come off, the encounter discard pile is shuffled in and cards are discarded from the top until X enemies are discarded (X the players), each added to the staging area
  // (not revealed). The three steps run first and the resources come off last, so the condition reads the count the Forced effect found (more than 3 keeps the rest).
  {
    id: "21012:forced:1",
    cardCode: PURSUIT,
    lines: ["21012:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [
      { verb: "PlaceResourceTokens", amount: 1, on: "self" },
      { verb: "ShuffleEncounterDiscard", when: THREE_RESOURCES },
      { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging", when: THREE_RESOURCES },
      { verb: "RemoveResourceTokens", on: "self", amount: 3, when: THREE_RESOURCES },
    ],
  },

  // 21013 Easterling Outrider (Surge is a keyword). Forced: after it engages a player, that player chooses: 1 resource on Easterling Pursuit, or the Outrider makes an immediate attack (however it was engaged). Shadow: the defending player discards an attachment he controls.
  {
    id: "21013:forced:1",
    cardCode: "21013",
    lines: ["21013:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "pursuit", requires: { kind: "inPlay", code: PURSUIT, is: true }, instructions: [PLACE_ON_PURSUIT] }, { id: "attack", instructions: [{ verb: "ImmediateAttack" }] }] }],
  },
  { id: "21013:shadow:1", cardCode: "21013", lines: ["21013:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "DiscardPicked" }] },

  // 21014 River Running (location). While it is in the staging area enemies cannot be optionally engaged (the optional engagement step only: engagement checks and its Travel still engage). Travel: the first player engages the highest engagement cost enemy in the staging area (the players cannot travel here with none).
  { id: "21014:constant:1", cardCode: "21014", lines: ["21014:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }] },
  { id: "21014:travel:1", cardCode: "21014", lines: ["21014:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, highestEngagementCost: true, who: "firstPlayer" } }, { verb: "Engage", target: "picked" }] },

  // 21015 Exposed Riverbank (location). While it is in the staging area, after a "when revealed" effect is canceled 1 resource goes on Easterling Pursuit. Travel: place 1 resource on Easterling Pursuit (payable only while it is in play).
  { id: "21015:forced:1", cardCode: "21015", lines: ["21015:A:1"], timing: "forced", trigger: "whenRevealedCanceled", condition: IN_STAGING, instructions: [PLACE_ON_PURSUIT] },
  { id: "21015:travel:1", cardCode: "21015", lines: ["21015:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { type: "objective", control: "any", names: ["Easterling Pursuit"] } }, { verb: "PlaceResourceTokens", amount: 1, on: "picked" }] },

  // 21016 Enemies Close Behind (treachery). When Revealed: 1 resource on Easterling Pursuit, then each player raises his threat by the resources on it (the new one included). Shadow: the attacking enemy gets +1 Attack; if this attack destroys a character, 1 resource goes on Easterling Pursuit.
  { id: "21016:whenRevealed:1", cardCode: "21016", lines: ["21016:A:1"], timing: "whenRevealed", instructions: [PLACE_ON_PURSUIT, { verb: "RaiseThreat", amount: PURSUIT_RESOURCES, who: "eachSeat" }] },
  { id: "21016:shadow:1", cardCode: "21016", lines: ["21016:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS(1), { verb: "AfterAttack", instructions: [{ ...PLACE_ON_PURSUIT, when: DESTROYED_A_CHARACTER }] }] },

  // 21017 Easterling Captain. Forced: when it enters play, cards are discarded from the top of the encounter deck until an Easterling treachery is discarded, and that treachery is attached to the Captain (its When Revealed and Surge do not resolve; with none the deck is all discarded and nothing attaches).
  // Forced: when it would take damage, the players choose an Easterling attachment on it, it is discarded and the damage is canceled; with none the Captain takes the damage.
  { id: "21017:forced:1", cardCode: "21017", lines: ["21017:A:1"], timing: "forced", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "DiscardUntil", type: "treachery", trait: "Easterling" }, { verb: "AttachTreachery", from: "picked", to: "self" }] },
  {
    id: "21017:forced:2",
    cardCode: "21017",
    lines: ["21017:A:2"],
    timing: "forced",
    trigger: "damageDealt",
    subject: "self",
    instructions: [
      { verb: "Pick", pick: { ...EASTERLING_ATTACHMENTS, who: "firstPlayer" } },
      { verb: "CancelDamage", all: true, when: { kind: "canPick", pick: EASTERLING_ATTACHMENTS } },
      { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: EASTERLING_ATTACHMENTS } },
    ],
  },

  // 21018 Rider of Rhûn (Archery 2 is a keyword). -10 engagement cost for each Easterling attachment it has. When Revealed: the encounter deck and discard pile are searched for an Easterling Horse, which attaches to it (not revealed), and the deck is shuffled.
  { id: "21018:constant:1", cardCode: "21018", lines: ["21018:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: { count: EASTERLING_ATTACHMENTS, times: 10, negative: true }, until: "whileSourceInPlay", target: "self" }] },
  { id: "21018:whenRevealed:1", cardCode: "21018", lines: ["21018:A:3"], timing: "whenRevealed", instructions: [{ verb: "AttachSearched", type: "treachery", trait: "Easterling", name: "Easterling Horse", to: "Rider of Rhûn" }, { verb: "ShuffleEncounterDeck" }] },

  // 21019 Easterling Horse (treachery). While attached to an enemy it counts as a Mount attachment: the enemy gets +2 Threat and at the end of the round it returns to the staging area (the Horse stays). When Revealed: it attaches to the Easterling enemy in play, staged or
  // engaged, with the lowest engagement cost and no Horse (the first player chooses among ties), which returns to the staging area; with none the Horse gains Surge.
  CARRIED_ATTACHMENT("21019", "21019:A:1", "Mount"),
  { id: "21019:constant:2", cardCode: "21019", lines: ["21019:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "host" }] },
  { id: "21019:forced:1", cardCode: "21019", lines: ["21019:A:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "ReturnToStaging", target: { kind: "host" } }] },
  {
    id: "21019:whenRevealed:1",
    cardCode: "21019",
    lines: ["21019:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: CANDIDATE("Easterling Horse", { lowestEngagementCost: true }) },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: CANDIDATE("Easterling Horse", { lowestEngagementCost: true }) } } },
      { verb: "ReturnToStaging", target: { kind: "picked" }, when: { kind: "canPick", pick: CANDIDATE("Easterling Horse", { lowestEngagementCost: true }) } },
      { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: CANDIDATE("Easterling Horse", { lowestEngagementCost: true }) } },
    ],
  },

  // 21020 Easterling Raider (Archery 1 is a keyword). +1 Attack and +1 Defense for each Easterling attachment on it. Shadow: the attacking enemy gets +1 Attack (+2 Attack in all, not +3, if it has an Easterling attachment).
  { id: "21020:constant:1", cardCode: "21020", lines: ["21020:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: EASTERLING_ATTACHMENTS }, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "defense", amount: { count: EASTERLING_ATTACHMENTS }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "21020:shadow:1",
    cardCode: "21020",
    lines: ["21020:A:3"],
    timing: "shadow",
    instructions: [
      ATTACKER_PLUS(2, { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", hasAttachment: { trait: "Easterling" } } }),
      ATTACKER_PLUS(1, { kind: "not", condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", hasAttachment: { trait: "Easterling" } } } }),
    ],
  },

  // 21021 Warrior of Rhûn. Forced: when it attacks, the top Easterling treachery of the encounter discard pile attaches to it. Shadow: it attaches to the attacking enemy instead (none in the pile, nothing).
  { id: "21021:forced:1", cardCode: "21021", lines: ["21021:A:1"], timing: "forced", trigger: "enemyAttacks", subject: "self", instructions: [{ verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "self" }] },
  { id: "21021:shadow:1", cardCode: "21021", lines: ["21021:A:2"], timing: "shadow", instructions: [{ verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "attacker" }] },

  // 21022 Sword of Rhûn (treachery, Surge is a keyword). While attached to an enemy it counts as a Weapon attachment: +2 Attack. When Revealed: it attaches to the Easterling enemy in play without a Sword of Rhûn that has the lowest Attack (the first player chooses among ties); with none it is discarded.
  CARRIED_ATTACHMENT("21022", "21022:A:2", "Weapon"),
  { id: "21022:constant:2", cardCode: "21022", lines: ["21022:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "host" }] },
  { id: "21022:whenRevealed:1", cardCode: "21022", lines: ["21022:A:3"], timing: "whenRevealed", instructions: ATTACH_TO_PICKED("Sword of Rhûn", { lowestAttack: true }) },

  // 21023 Recurve Bow (treachery, Surge is a keyword). While attached to an enemy it counts as a Weapon attachment: Archery 2. When Revealed: it attaches to the Easterling enemy in play without a Recurve Bow that has the highest engagement cost (the first player chooses among ties); with none it is discarded.
  CARRIED_ATTACHMENT("21023", "21023:A:2", "Weapon"),
  { id: "21023:constant:2", cardCode: "21023", lines: ["21023:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "archery", amount: 2, until: "whileSourceInPlay", target: "host" }] },
  { id: "21023:whenRevealed:1", cardCode: "21023", lines: ["21023:A:3"], timing: "whenRevealed", instructions: ATTACH_TO_PICKED("Recurve Bow", { highestEngagementCost: true }) },

  // 21024 Warriors of the East (encounter side quest, Surge is a keyword). Forced: after an Easterling enemy enters play the top Easterling treachery of the encounter discard pile attaches to it. Forced: after it becomes the current quest the highest Attack Easterling enemy in the staging area (the first player
  // chooses among ties) attacks the first player.
  { id: "21024:forced:1", cardCode: "21024", lines: ["21024:A:2"], timing: "forced", trigger: "encounterEnteredPlay", subject: { type: "enemy", control: "any", trait: "Easterling" }, instructions: [{ verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "subject" }] },
  { id: "21024:forced:2", cardCode: "21024", lines: ["21024:A:3"], timing: "forced", trigger: "becameCurrentQuest", subject: "self", instructions: [{ verb: "Pick", pick: { ...EASTERLING_IN_STAGING, highestAttack: true, who: "firstPlayer" } }, { verb: "AttackFromStaging", who: "firstPlayer" }] },

  // 21025 Rolling Plains (location). When Revealed: each copy of Rolling Plains in play gets +2 Threat until the end of the phase, a copy revealed later in the phase too. Travel: each player raises his threat by 2.
  { id: "21025:whenRevealed:1", cardCode: "21025", lines: ["21025:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyHeld", stat: "threat", amount: 2, holders: "sourceTitle", until: "endOfPhase" }] },
  { id: "21025:travel:1", cardCode: "21025", lines: ["21025:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

  // 21026 Rocky Outcrop (location). While it is in the staging area no player card effect readies a character (the refresh phase still does). Travel: the first player exhausts a hero he controls (the players cannot travel here with none ready).
  { id: "21026:constant:1", cardCode: "21026", lines: ["21026:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },
  { id: "21026:travel:1", cardCode: "21026", lines: ["21026:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", state: "ready", who: "firstPlayer" } }, { verb: "Exhaust", target: { kind: "picked" } }] },

  // 21027 Weary Lands (treachery, Doomed 1 is a keyword). When Revealed: each exhausted character gets -1 Willpower until the end of the phase, read live (a character exhausted later in the phase is held too). Shadow: 1 damage to the defending character.
  { id: "21027:whenRevealed:1", cardCode: "21027", lines: ["21027:A:2"], timing: "whenRevealed", instructions: [{ verb: "ModifyHeld", stat: "willpower", amount: -1, holders: "exhaustedCharacters", until: "endOfPhase" }] },
  { id: "21027:shadow:1", cardCode: "21027", lines: ["21027:A:3"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

  // 21028 Painful Fatigue (treachery). When Revealed: each player exhausts a ready character he controls and deals 1 damage to it. Shadow: the defending player either exhausts a ready character he controls, or the attacking enemy returns to the staging area after this attack.
  {
    id: "21028:whenRevealed:1",
    cardCode: "21028",
    lines: ["21028:A:1"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER([{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" }, when: { kind: "canPick", pick: READY_CHARACTER } }, { verb: "DamageCard", amount: 1, target: "picked", when: { kind: "canPick", pick: { type: "character", control: "you", state: "exhausted" } } }])],
  },
  {
    id: "21028:shadow:1",
    cardCode: "21028",
    lines: ["21028:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "exhaust", requires: { kind: "canPick", pick: READY_CHARACTER }, instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] },
          { id: "staging", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
        ],
      },
    ],
  },

  // 21029 An Arduous Journey (encounter side quest). While it is in play each player cannot ready more than 6 characters he controls in the refresh phase (he chooses which). Response: when it is defeated each player may ready a hero he controls.
  { id: "21029:forced:1", cardCode: "21029", lines: ["21029:A:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, { kind: "inPlay", code: "21029", is: true }] }, instructions: [EACH_PLAYER([{ verb: "CapRefresh", amount: 6 }])] },
  {
    id: "21029:response:1",
    cardCode: "21029",
    lines: ["21029:A:2"],
    timing: "response",
    trigger: "questDefeated",
    instructions: [EACH_PLAYER([{ verb: "Choose", who: "actor", options: [{ id: "ready", requires: { kind: "canPick", pick: EXHAUSTED_HERO }, instructions: [{ verb: "Pick", pick: EXHAUSTED_HERO }, { verb: "Ready", target: "picked" }] }, { id: "none", instructions: [] }] }])],
  },

  // 21075 Chased by Easterlings (stage 1). Setup: Warriors of the East is set aside, Easterling Pursuit and a River Running are in the staging area (the piles of the scenario); each player in turn chooses from the encounter deck an Easterling enemy of a title no other player took and adds it to the staging area, and the
  // deck is shuffled. 1B: +5 quest points for each player; +1 Threat in the staging area for each resource on Easterling Pursuit.
  { id: "21075:setup:1", cardCode: "21075", lines: ["21075:A:1"], timing: "setup", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Easterling", to: "staging", different: true, deckOnly: true }]), { verb: "ShuffleEncounterDeck" }] },
  { id: "21075:constant:1", cardCode: "21075", lines: ["21075:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { players: true, times: 5 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "21075:constant:2", cardCode: "21075", lines: ["21075:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "moreStagingThreat", amount: PURSUIT_RESOURCES, until: "whileSourceInPlay", target: "table" }] },

  // 21076 The Crossing of Araw (stage 2). When Revealed: Warriors of the East is added to the staging area (not revealed), the encounter discard pile is shuffled into the deck and cards are discarded until X enemies are discarded, each added to the staging area. 2B: each enemy in the staging area gets -10 engagement cost;
  // while a player is engaged with an enemy no more than 5 progress can be placed here each round; when it is defeated the players win (the engine ends the game on the last stage).
  { id: "21076:whenRevealed:1", cardCode: "21076", lines: ["21076:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "21024" }, { verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }] },
  { id: "21076:constant:1", cardCode: "21076", lines: ["21076:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } }] },
  { id: "21076:constant:2", cardCode: "21076", lines: ["21076:B:2"], timing: "constant", condition: SOME_PLAYER_ENGAGED, instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "whileSourceInPlay", target: "table" }] },
  { id: "21076:constant:3", cardCode: "21076", lines: ["21076:B:3"], timing: "constant", instructions: [] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
