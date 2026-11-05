import type { Condition, Effect } from "../../catalog/boundary.ts";

// Records for Journey Up the Anduin (Ered Mithrin part 1, campaign card 120165): the encounter cards no template reads, the three quest stages, Woodmen Village, Haldan, The Old Ford and the campaign card. Turayn, A Growing Threat and the
// treasures the campaign card names are in pool/EMCE.ts. Every line is read from the scan ledger (data/printed/ered-mithrin.json); a line a template already writes (pnpm data:build) needs no record here.
// The piles place the cards set aside and the Evil Creatures deck (emce.evil-creatures-deck); the stage's Setup shuffles them. The Wilderlands enemies the scenario deals (01081 to 01085) have their records in journey-along-the-anduin.ts.
// Rules: emce.evil-creatures-deck, emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.setup-journey-up-the-anduin, rr.guarded, rr.travel, rr.explored, rr.step-3-3 (data/rules/entries.json).
const EVIL_CREATURES = { verb: "AddFromPile", pile: "evilCreatures", to: "staging" } as const;
const STAGING_ENEMY = { type: "enemy", control: "any", stagingOnly: true } as const;
const MY_CHARACTER = { type: "character", control: "you" } as const;
const MY_ALLY = { type: "ally", control: "you" } as const;
// Each player but the first (the first player does the other half of a line that names both).
const OTHER_PLAYERS = { kind: "not", condition: { kind: "firstPlayer" } } as const;
// The campaign card holds X resources, X being 3 more than the number of players (120165:A:3): exactly that many, so the treasure comes once.
const X_RESOURCES: Condition = {
  kind: "all",
  conditions: [
    { kind: "less", left: { players: true, plus: 2 }, right: { stat: "resources", of: "self" } },
    { kind: "less", left: { stat: "resources", of: "self" }, right: { players: true, plus: 4 } },
  ],
};
const ACTIVE_LOCATION = { kind: "canPick", pick: { type: "location", control: "any", active: true } } as const;
const CONDITION_ATTACHMENT = { verb: "CountsAs", cardType: "attachment", trait: "Condition" } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 120165 Journey Up the Anduin (campaign card). Setup: Turayn comes under a player's control (the first player's: Mendor's pattern) and A Growing Threat joins the encounter deck. Response: after a non-unique location is explored a resource goes on
  // the card, and at X resources the first player looks at 3 random undiscovered treasures, chooses 1 and attaches it to an eligible character the first player chooses. Resolution: Turayn joins the pool or the oath line is written; each treasure the players control
  // is discovered; A Growing Threat and each Evil Creatures enemy in play join the pool.
  { id: "120165:campaignSetup:1", cardCode: "120165", lines: ["120165:A:2"], timing: "campaignSetup", instructions: [{ verb: "PutObjectiveAllyIntoPlay", code: "12166" }, { verb: "ShuffleIntoEncounterDeck", code: "12167" }] },
  {
    id: "120165:response:1",
    cardCode: "120165",
    lines: ["120165:A:3"],
    timing: "response",
    trigger: "locationExplored",
    subject: { type: "location", control: "any", nonUnique: true },
    instructions: [
      { verb: "PlaceToken", amount: 1 },
      { verb: "ClaimRandomTreasure", count: 3, when: X_RESOURCES },
      { verb: "Pick", pick: { type: "card", control: "any", hostForPicked: true, who: "firstPlayer" }, when: X_RESOURCES },
      { verb: "AttachPicked", when: X_RESOURCES },
    ],
  },
  { id: "120165:resolution:1", cardCode: "120165", lines: ["120165:B:1"], timing: "resolution", instructions: [{ verb: "BoonAllyOrLogLine", ally: "12166", line: "turayn" }] },
  { id: "120165:resolution:2", cardCode: "120165", lines: ["120165:B:2"], timing: "resolution", instructions: [{ verb: "DiscoverTreasure" }] },
  { id: "120165:resolution:3", cardCode: "120165", lines: ["120165:B:3"], timing: "resolution", instructions: [{ verb: "AddEncounterToPool", codes: ["12167"] }, { verb: "AddEncounterToPool", codes: ["01081", "01082", "01083", "01084", "01085"], inPlay: true }] },

  // 18016 The Old Ford: 5 more quest points for each enemy in play; becoming the active location, each enemy in the staging area attacks the first player, one after the other.
  { id: "18016:constant:1", cardCode: "18016", lines: ["18016:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { count: { type: "enemy", control: "any", staging: true }, times: 5 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "18016:forced:1", cardCode: "18016", lines: ["18016:A:3"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "Each", pick: STAGING_ENEMY, instructions: [{ verb: "AttackFromStaging", who: "firstPlayer" }] }] },

  // 18017 Wooded Riverbank: explored, the top card of the Evil Creatures deck comes into play engaged with the first player; the Shadow deals 1 damage to the defending character.
  { id: "18017:forced:1", cardCode: "18017", lines: ["18017:A:1"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [{ verb: "AddFromPile", pile: "evilCreatures", to: "engaged", who: "firstPlayer" }] },
  { id: "18017:shadow:1", cardCode: "18017", lines: ["18017:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

  // 18018 Frenzied Creature: it goes on the top card of the Evil Creatures deck, added to the staging area, and as a Condition attachment gives that enemy +1 Threat, Attack and Defense and immunity to player card effects; the Shadow attaches it to the attacking enemy.
  { id: "18018:whenRevealed:1", cardCode: "18018", lines: ["18018:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddFromPile", pile: "evilCreatures", to: "staging", attachSource: true }] },
  {
    id: "18018:constant:1",
    cardCode: "18018",
    lines: ["18018:A:1"],
    timing: "constant",
    instructions: [
      CONDITION_ATTACHMENT,
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "host" },
    ],
  },
  { id: "18018:shadow:1", cardCode: "18018", lines: ["18018:A:2"], timing: "shadow", instructions: [{ verb: "AttachSelf", to: { kind: "attackingEnemy" } }] },

  // 18019 Dangerous Crossing: each player assigns damage equal to the active location's Threat among their characters; under 3, it gains surge. The Shadow gives the attacker +1 Attack, +2 when the defender is damaged.
  {
    id: "18019:whenRevealed:1",
    cardCode: "18019",
    lines: ["18019:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "AssignDamage", amount: { stat: "threat", of: "activeLocation" }, pick: MY_CHARACTER, who: "eachSeat" },
      { verb: "GainSurge", when: { kind: "less", left: { stat: "threat", of: "activeLocation" }, right: 3 } },
    ],
  },
  {
    id: "18019:shadow:1",
    cardCode: "18019",
    lines: ["18019:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } },
    ],
  },

  // 18020 Goblin Troop: engaged with a player, each other Goblin enemy engaged with that player gets +1 Attack and +1 Defense.
  {
    id: "18020:constant:2",
    cardCode: "18020",
    lines: ["18020:A:2"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "engaged" },
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", engaged: "you", trait: "Goblin", other: true } },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", engaged: "you", trait: "Goblin", other: true } },
    ],
  },

  // 18021 Stray Goblin: it cannot be optionally engaged; in the staging area it engages a player who engages an enemy; the Shadow adds it to the staging area.
  { id: "18021:constant:1", cardCode: "18021", lines: ["18021:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "18021:forced:1", cardCode: "18021", lines: ["18021:A:2"], timing: "forced", trigger: "engaged", subject: { type: "enemy", control: "any", other: true }, condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "Engage", target: "self" }] },
  { id: "18021:shadow:1", cardCode: "18021", lines: ["18021:A:3"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },

  // 18022 Pack of Wargs: dealt a shadow card with no effect, it makes an additional attack after this one, dealt no shadow card.
  { id: "18022:forced:1", cardCode: "18022", lines: ["18022:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "ImmediateAttack", shadow: false }] },

  // 18023 Hills of Wilderland: its Threat and quest points are the most characters any one player controls; the first player may exhaust a character in the quest phase to lower its Threat by 1 for the phase.
  {
    id: "18023:constant:1",
    cardCode: "18023",
    lines: ["18023:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: { mostPerPlayer: { type: "character", control: "you" } }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "questPoints", amount: { mostPerPlayer: { type: "character", control: "you" } }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  {
    id: "18023:action:1",
    cardCode: "18023",
    lines: ["18023:A:2"],
    timing: "action",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "firstPlayer" }, { kind: "canPick", pick: { type: "character", control: "you", state: "ready" } }] },
    instructions: [
      { verb: "Pick", pick: { type: "character", control: "you", state: "ready" } },
      { verb: "Exhaust", target: { kind: "picked" } },
      { verb: "ModifyStat", stat: "threat", amount: -1, until: "endOfPhase", target: "self" },
    ],
  },

  // 18024 Lonely Lands: +2 Threat for each facedown card under it; in the staging area an event played in the quest phase is placed facedown under it.
  { id: "18024:constant:1", cardCode: "18024", lines: ["18024:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { facedown: true, times: 2 }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "18024:forced:1",
    cardCode: "18024",
    lines: ["18024:A:2"],
    timing: "forced",
    trigger: "played",
    subject: { type: "card", control: "any", cardType: "event" },
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "sourceIn", zone: "staging" }] },
    instructions: [{ verb: "AttachFacedown" }],
  },

  // 18025 Ruined Supplies: each player raises threat by 1 for each ally they control, or deals 1 damage to each of their allies; the Shadow raises the defender's threat by 1 for each enemy engaged with them.
  {
    id: "18025:whenRevealed:1",
    cardCode: "18025",
    lines: ["18025:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: MY_ALLY }, who: "actor" }] },
              { id: "damage", instructions: [{ verb: "DamageEach", amount: 1, pick: MY_ALLY }] },
            ],
          },
        ],
      },
    ],
  },
  { id: "18025:shadow:1", cardCode: "18025", lines: ["18025:A:3"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "enemy", control: "any", engaged: "you" } }, who: "actor" }] },

  // 18026 Lost in the Wild: the player with the most cards in hand among those holding no copy adds it to their hand, where player card effects cannot discard it and playing a card discards the hand.
  { id: "18026:whenRevealed:1", cardCode: "18026", lines: ["18026:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSourceToHandOfMost" }, { verb: "Undiscardable" }] },
  {
    id: "18026:forced:1",
    cardCode: "18026",
    lines: ["18026:A:1"],
    timing: "forced",
    trigger: "played",
    subject: { type: "card", control: "you" },
    eventSeat: "you",
    fromHand: true,
    condition: { kind: "sourceIn", zone: "hand" },
    // The pick leaves the source out of a hand (it is not "another" card), but "each card in your hand" holds it: it goes to the encounter discard pile last.
    instructions: [{ verb: "DiscardEach", pick: { type: "card", control: "you", from: "hand" } }, { verb: "Discard", target: { kind: "self" } }],
  },

  // 18027 Weighed Down: it attaches to the hero with the most attachments that it is not on, which exhausts; as a Condition attachment, when that hero readies its controller chooses and discards one of its attachments (Weighed Down only when it has no other non-objective one).
  { id: "18027:whenRevealed:1", cardCode: "18027", lines: ["18027:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "mostAttachments" } }, { verb: "Exhaust", target: { kind: "ref", ref: "host" } }] },
  { id: "18027:constant:1", cardCode: "18027", lines: ["18027:A:1"], timing: "constant", instructions: [CONDITION_ATTACHMENT] },
  {
    id: "18027:forced:1",
    cardCode: "18027",
    lines: ["18027:A:1"],
    timing: "forced",
    trigger: "readied",
    subject: "host",
    instructions: [
      { verb: "Pick", pick: { type: "card", control: "any", attachedTo: "host", nonObjective: true, other: true }, when: { kind: "canPick", pick: { type: "card", control: "any", attachedTo: "host", nonObjective: true, other: true } } },
      { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "card", control: "any", attachedTo: "host", nonObjective: true, other: true } } },
      { verb: "Discard", target: { kind: "self" }, when: { kind: "not", condition: { kind: "canPick", pick: { type: "card", control: "any", attachedTo: "host", nonObjective: true, other: true } } } },
    ],
  },

  // 18066 Traveling North. Setup: Woodmen Village and The Old Ford are set aside by the piles (the first record describes it); the Evil Creatures deck is created, the encounter deck shuffled, and cards discarded until one location for each player is, each added to the staging area.
  // Side B: a successful quest places a resource here; each encounter phase removes one and, only if one was removed (rr.then), adds the top Evil Creatures card to the staging area (the card is added first, while the resource is still there to read); the stage cannot be defeated while an Evil Creatures enemy is in play.
  { id: "18066:setup:1", cardCode: "18066", lines: ["18066:A:1"], timing: "setup", instructions: [{ verb: "SetAside", code: "18069" }, { verb: "SetAside", code: "18016" }] },
  {
    id: "18066:setup:2",
    cardCode: "18066",
    lines: ["18066:A:1"],
    timing: "setup",
    instructions: [
      { verb: "ShufflePile", pile: "evilCreatures" },
      { verb: "ShuffleEncounterDeck" },
      { verb: "Repeat", times: { players: true }, instructions: [{ verb: "DiscardUntil", type: "location" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] },
    ],
  },
  { id: "18066:forced:1", cardCode: "18066", lines: ["18066:B:1"], timing: "forced", trigger: "progressPlaced", subject: "self", condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "questSucceeded" }] }, instructions: [{ verb: "PlaceToken", amount: 1 }] },
  { id: "18066:forced:2", cardCode: "18066", lines: ["18066:B:2"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Encounter" }, instructions: [{ ...EVIL_CREATURES, when: { kind: "less", left: 0, right: { stat: "resources", of: "self" } } }, { verb: "DiscardResources", amount: 1, target: "self" }] },
  { id: "18066:constant:1", cardCode: "18066", lines: ["18066:B:3"], timing: "constant", condition: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, fromDeck: "evilCreatures" } }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 18067 Woodmen Under Attack: the first player adds Woodmen Village and each other player reveals a card; at most 1 progress on each location in the staging area each round; after the players travel the top Evil Creatures card is added;
  // the stage cannot be defeated unless the first player controls Haldan.
  { id: "18067:whenRevealed:1", cardCode: "18067", lines: ["18067:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "18069" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter", when: OTHER_PLAYERS }] }] },
  { id: "18067:constant:1", cardCode: "18067", lines: ["18067:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressCap", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
  { id: "18067:forced:1", cardCode: "18067", lines: ["18067:B:2"], timing: "forced", trigger: "traveled", subject: { type: "location", control: "any" }, instructions: [EVIL_CREATURES] },
  { id: "18067:constant:2", cardCode: "18067", lines: ["18067:B:3"], timing: "constant", condition: { kind: "not", condition: { kind: "controls", code: "18070" } }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 18068 The Passage of the Ford: the first player adds The Old Ford and each other player the top Evil Creatures card; the players cannot travel to The Old Ford before 5 progress is here; the top Evil Creatures card is added at the beginning of each quest phase;
  // the stage cannot be defeated while The Old Ford is in play, and exploring it wins the game.
  { id: "18068:whenRevealed:1", cardCode: "18068", lines: ["18068:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "18016" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ ...EVIL_CREATURES, when: OTHER_PLAYERS }] }] },
  { id: "18068:constant:1", cardCode: "18068", lines: ["18068:B:1"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 5 } }, instructions: [{ verb: "Restrict", what: "travel", location: "18016" }] },
  { id: "18068:forced:1", cardCode: "18068", lines: ["18068:B:2"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Quest" }, instructions: [EVIL_CREATURES] },
  { id: "18068:constant:2", cardCode: "18068", lines: ["18068:B:3"], timing: "constant", condition: { kind: "inPlay", code: "18016", is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "18068:forced:2", cardCode: "18068", lines: ["18068:B:3"], timing: "forced", trigger: "locationExplored", subject: { type: "location", control: "any", names: ["The Old Ford"] }, instructions: [{ verb: "WinGame" }] },

  // 18069 Woodmen Village: explored, the top Evil Creatures card is added to the staging area and the card flips over to Haldan, attached to that enemy as a guarded objective.
  { id: "18069:forced:1", cardCode: "18069", lines: ["18069:A:2"], timing: "forced", trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" }, instructions: [EVIL_CREATURES, { verb: "FlipOver", into: "18070", guardedBy: "picked" }] },

  // 18070 Haldan: the first player controls him while he is free of encounters; with an active location he does not exhaust to quest.
  { id: "18070:constant:1", cardCode: "18070", lines: ["18070:A:1"], timing: "constant", instructions: [{ verb: "GainControlWhenFree", who: "firstPlayer" }] },
  { id: "18070:constant:2", cardCode: "18070", lines: ["18070:A:2"], timing: "constant", condition: ACTIVE_LOCATION, instructions: [{ verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "whileSourceInPlay", target: "self" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
