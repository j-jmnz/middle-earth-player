import type { Effect, PickSpec } from "../../catalog/boundary.ts";

// Records for Voyage Across Belegaer (Dream-chaser part 1, campaign card 11171): the six quest stages, the Voyage, Vast Oceans, Stormy Weather, Umbar Fleet and
// Corsair Pirates encounter cards no template or earlier record reads, the six ship-objectives of The Dream-chaser's Fleet on both sides, and the campaign card. The
// Modification boons it fits and the burdens it shuffles in are in pool/DCCE.ts. Every line is read from the scan ledger (data/printed/dream-chaser.json).
// Rules: dcce.sailing, dcce.sailing-tests, dcce.heading, dcce.corsair-deck, dcce.boarding, dcce.prepare-your-fleet, dcce.ship-enemies, dcce.ship-objectives,
// dcce.scalable-upgradable, dcce.gaining-xp, dcce.setup-voyage-across-belegaer, dcce.campaign-setup-voyage-across-belegaer, rr.search, rr.travel, rr.cancel
// (data/rules/entries.json).
const IN_STAGING = { kind: "sourceIn", zone: "staging" } as const;
const ACTIVE = { kind: "sourceIn", zone: "activeLocation" } as const;
const ON_COURSE = { kind: "heading", is: "onCourse" } as const;
const OFF_COURSE = { kind: "heading", is: "offCourse" } as const;
const WORST = { kind: "heading", is: "worst" } as const;
const NOT_OFF_COURSE = { kind: "not", condition: OFF_COURSE } as const;
// A Ship objective (a ship-objective is a character that bears the Ship trait) and a Ship enemy anywhere in play.
const SHIP_OBJECTIVE: PickSpec = { type: "character", control: "any", trait: "Ship" };
const YOUR_SHIP: PickSpec = { type: "character", control: "you", trait: "Ship" };
const SHIP_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Ship", staging: true };
const ATTACKER_IS_SHIP = { kind: "matches", card: "attacker", pick: SHIP_ENEMY } as const;
const ALL_PLAYERS = { type: "player", control: "any" } as const;

// The Search a stage 2 card's When Revealed makes.
const stageSearch = (code: string, find: string): Effect => ({
  id: `${code}:whenRevealed:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "whenRevealed",
  instructions: [{ verb: "SearchMove", code: find, to: "staging" }, { verb: "ShuffleEncounterDeck" }],
});

// "When this stage is defeated, if you are on-course (Sun), look at the top 2 stages of the quest deck and advance to one of your choice, placing the other on the
// bottom of the quest deck. Otherwise, advance to the top stage of the quest deck." (rules/families/quest-order.ts reads it from the stage's definition)
// The record has the `constant` timing only because every record needs one: nothing runs it, the stage definition carries the verb.
const lookAtStages = (code: string, line: string, id = 1): Effect => ({ id: `${code}:constant:${id}`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "LookAtStages", count: 2 }] });

// "Cannot have attachments." of a ship-enemy.
const noAttachments = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay" }] });

// "If the X is destroyed, its controller is eliminated from the game" / "the players lose the game" of a ship-objective: the ship leaves play destroyed.
const eliminated = (code: string, line: string, id: number, lose = false): Effect => ({
  id: `${code}:triggered:${id}`,
  cardCode: code,
  lines: [line],
  timing: "triggered",
  trigger: "characterDestroyed",
  subject: "self",
  instructions: [{ verb: lose ? "LoseGame" : "EliminatePlayer" }],
});

// "Draw 1 additional card during the resource phase."
const extraCard = (code: string, line: string): Effect => ({ id: `${code}:constant:2`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "extraDraw", amount: 1, until: "whileSourceInPlay", target: "actorSeat" }] });

// "Raise your starting threat by 3." / "Reduce your starting threat by 3": resolved when the fleet is prepared (rules/families/sea-fleet.ts).
const startingThreat = (code: string, line: string, id: number, raise: boolean, amount: number): Effect => ({
  id: `${code}:setup:${id}`,
  cardCode: code,
  lines: [line],
  timing: "setup",
  instructions: [raise ? { verb: "RaiseThreat", amount } : { verb: "LowerThreat", amount, who: "actor" }],
});

// "Reduce the cost of the first ally (card) you play each round by 1."
const firstCheaper = (code: string, line: string, cardType?: "ally"): Effect => ({
  id: `${code}:constant:2`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  instructions: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", ...(cardType ? { cardType } : {}) }, amount: 1, firstEachRound: true }],
});

// "Each hero you control gets +1 Attack."
const heroesAttack = (code: string, line: string): Effect => ({ id: `${code}:constant:2`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "you" } }] });

// "Response: After you play a card with an odd printed cost, add 1 resource to a hero's resource pool."
const oddCostResource = (code: string, line: string, limit: "oncePerRound" | "twicePerRound"): Effect => ({
  id: `${code}:response:1`,
  cardCode: code,
  lines: [line],
  timing: "response",
  trigger: "played",
  subject: { type: "card", control: "you", oddCost: true },
  limit,
  instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "AddResources", amount: 1, to: "picked" }],
});

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 11016 Departure from the Havens. Setup: the Corsair deck is prepared, each player takes a ship, the four stage 2 cards are put in a random order above stage 3,
  // and the encounter deck is shuffled. Rolling Seas and Scouting Ship are added to the staging area by the scenario's staging pile (data/scenarios), as the
  // Setup's search finds them. On-course (Sun) each Ship objective gets +2 Willpower.
  { id: "11016:setup:1", cardCode: "11016", lines: ["11016:A:1"], timing: "setup", instructions: [{ verb: "PrepareCorsairDeck" }, { verb: "PrepareFleet" }, { verb: "ShuffleStages", codes: ["11017", "11018", "11019", "11020"] }, { verb: "ShuffleEncounterDeck" }] },
  { id: "11016:constant:1", cardCode: "11016", lines: ["11016:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 2, until: "whileSourceInPlay", holders: SHIP_OBJECTIVE, when: ON_COURSE }] },
  lookAtStages("11016", "11016:B:3", 2),

  // 11017 Into the Storm: Waterspout; off-course, each player distributes 5 damage among his characters at the end of the quest phase.
  stageSearch("11017", "11054"),
  { id: "11017:forced:1", cardCode: "11017", lines: ["11017:B:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, OFF_COURSE] }, instructions: [{ verb: "AssignDamage", amount: 5, pick: { type: "character", control: "you" }, who: "eachSeat" }] },
  lookAtStages("11017", "11017:B:3"),

  // 11018 Cursed Mists: Fog Bank; off-course, each non-Ship ally gets -2 Willpower.
  stageSearch("11018", "11024"),
  { id: "11018:constant:1", cardCode: "11018", lines: ["11018:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -2, until: "whileSourceInPlay", holders: { type: "ally", control: "any", notTraits: ["Ship"] }, when: OFF_COURSE }] },
  lookAtStages("11018", "11018:B:3", 2),

  // 11019 Calphon's Divination: Scouting Ship; off-course, each Ship enemy gains Boarding 1.
  stageSearch("11019", "11022"),
  { id: "11019:constant:1", cardCode: "11019", lines: ["11019:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "boarding", amount: 1, until: "whileSourceInPlay", holders: SHIP_ENEMY, when: OFF_COURSE }] },
  lookAtStages("11019", "11019:B:3", 2),

  // 11020 The Star's Guidance: Starlit Sea; off-course, each Ocean location gets +1 Threat.
  stageSearch("11020", "11023"),
  { id: "11020:constant:1", cardCode: "11020", lines: ["11020:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", trait: "Ocean", staging: true }, when: OFF_COURSE }] },
  lookAtStages("11020", "11020:B:3", 2),

  // 11021 Corsair Pursuit. When Revealed: the Ship enemy with the highest Threat joins the staging area (the two highest with 3 or more players). Progress cannot be placed
  // off-course; with no Ship enemy in play, or 10 or more progress on the stage, the players win (the constants are read once no effect is resolving).
  {
    id: "11021:whenRevealed:1",
    cardCode: "11021",
    lines: ["11021:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "SearchShips", count: 1, when: { kind: "not", condition: { kind: "count", pick: ALL_PLAYERS, min: 3 } } },
      { verb: "SearchShips", count: 2, when: { kind: "count", pick: ALL_PLAYERS, min: 3 } },
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  { id: "11021:constant:1", cardCode: "11021", lines: ["11021:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table", when: OFF_COURSE }] },
  { id: "11021:constant:2", cardCode: "11021", lines: ["11021:B:3"], timing: "constant", condition: { kind: "enemyInPlay", trait: "Ship", is: false }, instructions: [{ verb: "WinGame" }] },
  { id: "11021:constant:3", cardCode: "11021", lines: ["11021:B:4"], timing: "constant", condition: { kind: "stageProgress", min: 10 }, instructions: [{ verb: "WinGame" }] },

  // 11022 Scouting Ship: no attachments; -15 engagement cost off-course.
  noAttachments("11022", "11022:A:2"),
  { id: "11022:constant:2", cardCode: "11022", lines: ["11022:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -15, until: "whileSourceInPlay", target: "self", when: OFF_COURSE }] },

  // 11023 Starlit Sea: off-course it gains "Travel: Raise each player's threat by 3."
  { id: "11023:travel:1", cardCode: "11023", lines: ["11023:A:1"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eachSeat", when: OFF_COURSE }] },
  { id: "11023:shadow:1", cardCode: "11023", lines: ["11023:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: NOT_OFF_COURSE }, { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: OFF_COURSE }] },

  // 11024 Fog Bank: while it is the active location, Ship enemies make no engagement checks, cannot attack and cannot be attacked. Shadow: at the worst heading the
  // attacking enemy attacks again.
  {
    id: "11024:constant:1",
    cardCode: "11024",
    lines: ["11024:A:1"],
    timing: "constant",
    condition: ACTIVE,
    instructions: [
      { verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", holders: SHIP_ENEMY },
      { verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", holders: SHIP_ENEMY },
      { verb: "ModifyStat", stat: "cannotBeAttacked", amount: 1, until: "whileSourceInPlay", holders: SHIP_ENEMY },
    ],
  },
  { id: "11024:shadow:1", cardCode: "11024", lines: ["11024:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: WORST, instructions: [{ verb: "ImmediateAttack" }] }] },

  // 11050 Calm Waters: while it is the active location the Sailing test looks at 2 additional cards. Shadow: +1 Attack, +3 against a Ship enemy.
  { id: "11050:constant:1", cardCode: "11050", lines: ["11050:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "sailingLook", amount: 2, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "11050:shadow:1",
    cardCode: "11050",
    lines: ["11050:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: ATTACKER_IS_SHIP } },
      { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: ATTACKER_IS_SHIP },
    ],
  },

  // 11051 Rolling Seas: shift off-course to travel here. Shadow: damage to a Ship objective shifts the heading off-course.
  { id: "11051:travel:1", cardCode: "11051", lines: ["11051:A:1"], timing: "travel", instructions: [{ verb: "ShiftHeading", direction: "offCourse" }] },
  {
    id: "11051:shadow:1",
    cardCode: "11051",
    lines: ["11051:A:2"],
    timing: "shadow",
    instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ShiftHeading", direction: "offCourse", when: { kind: "all", conditions: [{ kind: "dealt" }, { kind: "matches", card: "other", pick: SHIP_OBJECTIVE }] } }] }],
  },

  // 11052 Thrown Off Course: the players remove all progress from the quest and each raises threat by 4, or shift the heading off-course. Shadow: a destroyed character
  // shifts it.
  {
    id: "11052:whenRevealed:1",
    cardCode: "11052",
    lines: ["11052:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "progress", instructions: [{ verb: "RemoveAllQuestProgress" }, { verb: "RaiseThreat", amount: 4, who: "eachSeat" }] },
          { id: "heading", instructions: [{ verb: "ShiftHeading", direction: "offCourse" }] },
        ],
      },
    ],
  },
  { id: "11052:shadow:1", cardCode: "11052", lines: ["11052:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ShiftHeading", direction: "offCourse", when: { kind: "x", min: 1 } }] }] },

  // 11053 Rough Waters: in the staging area it cancels the first Sailing success symbol of each test. Shadow: +2 Attack off-course.
  { id: "11053:constant:1", cardCode: "11053", lines: ["11053:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "sailingCancel", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "11053:shadow:1", cardCode: "11053", lines: ["11053:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: OFF_COURSE }] },

  // 11054 Waterspout: at the worst heading the players must travel to it, if able; after traveling to it, 4 damage to each Ship objective.
  { id: "11054:constant:1", cardCode: "11054", lines: ["11054:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "travelOnly", when: WORST }] },
  { id: "11054:forced:1", cardCode: "11054", lines: ["11054:A:2"], timing: "forced", trigger: "traveled", subject: "self", instructions: [{ verb: "DamageEach", amount: 4, pick: SHIP_OBJECTIVE }] },

  // 11055 Sudden Storms: shift the heading off-course, or 1 damage to each exhausted character. Shadow: the excess damage goes to a Ship objective you control.
  {
    id: "11055:whenRevealed:1",
    cardCode: "11055",
    lines: ["11055:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "heading", instructions: [{ verb: "ShiftHeading", direction: "offCourse" }] },
          { id: "damage", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", state: "exhausted" } }] },
        ],
      },
    ],
  },
  {
    id: "11055:shadow:1",
    cardCode: "11055",
    lines: ["11055:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "excessToShip", amount: 1, until: "endOfAttack", target: "attacker" },
      { verb: "AfterAttack", instructions: [{ verb: "Pick", pick: YOUR_SHIP, when: { kind: "excess", min: 1 } }, { verb: "DamageShip", amount: { excess: true }, when: { kind: "excess", min: 1 } }] },
    ],
  },

  // 11056 Winds of Wrath: off-course, 1 damage to each character in play, and at the worst heading it cannot be canceled. Shadow: shift off-course, or the attack is undefended.
  { id: "11056:whenRevealed:1", cardCode: "11056", lines: ["11056:A:1"], timing: "whenRevealed", uncancelable: WORST, instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any" }, when: OFF_COURSE }] },
  {
    id: "11056:shadow:1",
    cardCode: "11056",
    lines: ["11056:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "heading", instructions: [{ verb: "ShiftHeading", direction: "offCourse" }] },
          { id: "undefended", instructions: [{ verb: "ConsiderUndefended" }] },
        ],
      },
    ],
  },

  // 11057 Light Cruiser: no attachments; a Raider its Boarding reveals enters play with 1 resource.
  noAttachments("11057", "11057:A:2"),
  { id: "11057:constant:2", cardCode: "11057", lines: ["11057:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "boardingResource", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 11058 Corsair Warship: no attachments; in the staging area it cannot be damaged and gains archery 4.
  noAttachments("11058", "11058:A:2"),
  {
    id: "11058:constant:2",
    cardCode: "11058",
    lines: ["11058:A:3"],
    timing: "constant",
    condition: IN_STAGING,
    instructions: [
      { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "archery", amount: 4, until: "whileSourceInPlay", target: "self" },
    ],
  },

  // 11059 Boarding Party: each player reveals the top card of the Corsair deck into play engaged with him. Shadow: +1 Attack, +2 if you control an exhausted Ship objective.
  { id: "11059:whenRevealed:1", cardCode: "11059", lines: ["11059:A:1"], timing: "whenRevealed", instructions: [{ verb: "RevealCorsair", who: "eachSeat" }] },
  {
    id: "11059:shadow:1",
    cardCode: "11059",
    lines: ["11059:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "count", pick: { ...YOUR_SHIP, state: "exhausted" }, min: 1 } } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "count", pick: { ...YOUR_SHIP, state: "exhausted" }, min: 1 } },
    ],
  },

  // 11060 Southron Sailor: while engaged with you, each Ship enemy engaged with you contributes its Threat to the staging area's.
  { id: "11060:constant:1", cardCode: "11060", lines: ["11060:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "engagedThreat", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", engaged: "you", trait: "Ship" } }] },

  // 11061 Cunning Pirate: +1 Attack and +1 Defense for each resource on it. Forced: when it engages you, discard an attachment you control and place resources on it
  // equal to that attachment's printed cost.
  {
    id: "11061:constant:1",
    cardCode: "11061",
    lines: ["11061:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "defense", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  {
    id: "11061:forced:1",
    cardCode: "11061",
    lines: ["11061:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    eventSeat: "you",
    instructions: [
      { verb: "Pick", pick: { type: "attachment", control: "you" }, when: { kind: "canPick", pick: { type: "attachment", control: "you" } } },
      { verb: "AddResources", amount: { stat: "cost", of: "picked" }, to: "self", when: { kind: "canPick", pick: { type: "attachment", control: "you" } } },
      { verb: "DiscardPicked", when: { kind: "canPick", pick: { type: "attachment", control: "you" } } },
    ],
  },

  // 11062 Vicious Marauder: when it engages you, discard a random card from your hand and place resources on it equal to that card's printed cost; when it attacks you,
  // distribute damage among characters you control equal to the number of resources on it.
  { id: "11062:forced:1", cardCode: "11062", lines: ["11062:A:1"], timing: "forced", trigger: "engaged", subject: "self", eventSeat: "you", instructions: [{ verb: "PlunderHand" }] },
  { id: "11062:forced:2", cardCode: "11062", lines: ["11062:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "AssignDamage", amount: { stat: "resources", of: "self" }, pick: { type: "character", control: "you" } }] },

  // 11063 Umbar Captain: while you are engaged with it, characters you control cannot attack Ship enemies.
  { id: "11063:constant:1", cardCode: "11063", lines: ["11063:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "cannotAttackShips", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "you" } }] },

  // The six ship-objectives. Immune and Sentinel are keywords; the ledger's "Campaign Mode only." is inert. Side A is the original card (11080 to 11083) or its reprint (110136 to
  // 110141), side B the Upgraded side a campaign deals once every box is marked.
  // 11080 Dream-chaser (the Sailing line is in authored/families/sea.ts).
  eliminated("11080", "11080:A:4", 2, true),
  // 110136 Dream-chaser: A:3 is in authored/families/sea.ts; the Upgraded side can be committed to any Sailing test and counts as 3 characters.
  eliminated("110136", "110136:A:4", 2, true),
  { id: "110136:constant:2", cardCode: "110136", lines: ["110136:B:4"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "sailsAnyTest", amount: 1, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "sailingExtra", amount: 2, until: "whileSourceInPlay" }] },
  eliminated("110136", "110136:B:5", 3, true),

  // 11081 Dawn Star, and 110137 with its Upgraded side (which drops the starting threat line).
  startingThreat("11081", "11081:A:3", 1, true, 3),
  extraCard("11081", "11081:A:4"),
  eliminated("11081", "11081:A:5", 3),
  startingThreat("110137", "110137:A:3", 1, true, 3),
  extraCard("110137", "110137:A:4"),
  eliminated("110137", "110137:A:5", 3),
  { id: "110137:constant:3", cardCode: "110137", lines: ["110137:B:4"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "extraDraw", amount: 1, until: "whileSourceInPlay", target: "actorSeat" }] },
  eliminated("110137", "110137:B:5", 4),

  // 110138 Duskbringer (new in the Campaign Expansion).
  oddCostResource("110138", "110138:A:3", "oncePerRound"),
  eliminated("110138", "110138:A:4", 2),
  { ...oddCostResource("110138", "110138:B:4", "twicePerRound"), id: "110138:response:2" },
  eliminated("110138", "110138:B:5", 3),

  // 110139 Glórinaith (new): discard the top cards of any deck to deal damage to a non-unique enemy; the Upgraded side names a card first.
  {
    id: "110139:action:1",
    cardCode: "110139",
    lines: ["110139:A:4"],
    timing: "action",
    limit: "oncePerRound",
    condition: { kind: "canPick", pick: { type: "enemy", control: "any", nonUnique: true } },
    instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", nonUnique: true } }, { verb: "DiscardFromAnyDeck", count: 2 }, { verb: "DamageCard", amount: 1, target: "picked" }],
  },
  eliminated("110139", "110139:A:5", 2),
  {
    id: "110139:action:2",
    cardCode: "110139",
    lines: ["110139:B:5"],
    timing: "action",
    limit: "oncePerRound",
    condition: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true } },
    instructions: [
      { verb: "NameCard" },
      { verb: "Pick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true } },
      { verb: "DiscardFromAnyDeck", count: 3 },
      { verb: "DamageCard", amount: 1, target: "picked", when: { kind: "not", condition: { kind: "x", min: 1 } } },
      { verb: "DamageCard", amount: 2, target: "picked", when: { kind: "x", min: 1 } },
    ],
  },
  eliminated("110139", "110139:B:6", 3),

  // 11082 Nárelenya, and 110140 with its Upgraded side (the first card, not only the first ally).
  firstCheaper("11082", "11082:A:3", "ally"),
  eliminated("11082", "11082:A:4", 3),
  firstCheaper("110140", "110140:A:3", "ally"),
  eliminated("110140", "110140:A:4", 3),
  { ...firstCheaper("110140", "110140:B:4"), id: "110140:constant:3" },
  eliminated("110140", "110140:B:5", 4),

  // 11083 Silver Wing, and 110141 with its Upgraded side (the starting threat falls by 6).
  startingThreat("11083", "11083:A:4", 1, false, 3),
  heroesAttack("11083", "11083:A:5"),
  eliminated("11083", "11083:A:6", 3),
  startingThreat("110141", "110141:A:4", 1, false, 3),
  heroesAttack("110141", "110141:A:5"),
  eliminated("110141", "110141:A:6", 3),
  startingThreat("110141", "110141:B:5", 2, false, 6),
  { ...heroesAttack("110141", "110141:B:6"), id: "110141:constant:3" },
  eliminated("110141", "110141:B:7", 4),

  // 11171 Voyage Across Belegaer (campaign card). Setup (Campaign Mode): the four Modification boons are set aside and the ships are fitted once the fleet is prepared
  // (rules/families/sea-campaign.ts, ScenarioDefinition.afterSetup); a player may trade 2 damage on a ship for a resource; Ominous Fate and Thunderstruck are shuffled into the
  // encounter deck and Crowley into the Corsair deck. Resolution: Ominous Fate joins the Campaign Pool, and the XP list.
  {
    id: "11171:campaignSetup:1",
    cardCode: "11171",
    lines: ["11171:A:2"],
    timing: "campaignSetup",
    instructions: [
      { verb: "SetAside", code: "11172" },
      { verb: "SetAside", code: "11173" },
      { verb: "SetAside", code: "11174" },
      { verb: "SetAside", code: "11175" },
      { verb: "ShuffleIntoEncounterDeck", code: "11176" },
      { verb: "ShuffleIntoEncounterDeck", code: "11177" },
      { verb: "ShuffleIntoCorsairDeck", code: "11178" },
      { verb: "FitShips", codes: ["11172", "11173", "11174", "11175"] },
      { verb: "TradeShipDamage", damage: 2, resources: 1 },
    ],
  },
  { id: "11171:resolution:1", cardCode: "11171", lines: ["11171:B:1"], timing: "resolution", instructions: [{ verb: "Earn", codes: ["11176"] }] },
  { id: "11171:resolution:2", cardCode: "11171", lines: ["11171:B:2", "11171:B:3"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "survivingPlayer" } }] },
  {
    id: "11171:resolution:3",
    cardCode: "11171",
    lines: ["11171:B:4"],
    timing: "resolution",
    instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: { type: "card", control: "any", from: "victory", names: ["Into the Storm", "Cursed Mists", "Calphon's Divination", "The Star's Guidance"] }, min: 4 } }],
  },
  { id: "11171:resolution:4", cardCode: "11171", lines: ["11171:B:5"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: ON_COURSE }] },
  { id: "11171:resolution:5", cardCode: "11171", lines: ["11171:B:6"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "enemyInPlay", trait: "Ship", is: false } }] },
  { id: "11171:resolution:6", cardCode: "11171", lines: ["11171:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "inVictory", codes: ["11058"] } }] },
  { id: "11171:resolution:7", cardCode: "11171", lines: ["11171:B:8"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "inVictory", codes: ["11178"] }, max: 1 }] },
  { id: "11171:resolution:8", cardCode: "11171", lines: ["11171:B:9"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 2, each: { kind: "inVictory", codes: ["11177"] }, max: 2 }] },
  { id: "11171:resolution:9", cardCode: "11171", lines: ["11171:B:10"], timing: "resolution", instructions: [{ verb: "GainXp", amount: -1, each: { kind: "inVictory", codes: ["11176"] }, max: 1 }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
