import type { Effect, PickSpec } from "../../catalog/boundary.ts";

import { copyLine, copyLines, withCopies } from "./reprint.ts";

// Records for Flight of the Stormcaller (Dream-chaser part 4, campaign card 11191): the four quest stages and the Stormcaller's own stages 2C to 4C, the Stormcaller on both sides, the Flight of the
// Stormcaller encounter cards, and the campaign card. Black Key (burden) and Calaerion, which the campaign card places, are in pool/DCCE.ts; the ships, the Heading card and the Vast Oceans, Stormy
// Weather and Corsair Pirates cards are the earlier scenarios' records. Every line is read from the scan ledger (data/printed/dream-chaser.json).
// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.sailing, dcce.sailing-tests, dcce.heading, dcce.boarding, dcce.immune, dcce.archery, dcce.setup-flight-of-the-stormcaller,
// dcce.campaign-setup-flight-of-the-stormcaller, dcce.campaign-mode, dcce.gaining-xp, dcce.scalable-upgradable, rr.search (data/rules/entries.json).
const STORMCALLER_STAGES = ["12016", "12017", "12018"];
const ON_COURSE = { kind: "heading", is: "onCourse" } as const;
const OFF_COURSE = { kind: "heading", is: "offCourse" } as const;
const WORST = { kind: "heading", is: "worst" } as const;
const NOT_OFF_COURSE = { kind: "not", condition: OFF_COURSE } as const;
const SAME_STAGE = { kind: "stormcaller", is: "sameStage" } as const;
const IN_STAGING = { kind: "sourceIn", zone: "staging" } as const;
const SHIP_OBJECTIVE: PickSpec = { type: "character", control: "any", trait: "Ship" };
const SHIP_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Ship", staging: true };
// A condition that always holds, for the "cannot be canceled" of a card that prints no condition (`uncancelable` takes one).
const ALWAYS = { kind: "count", pick: { type: "hero", control: "any" }, min: 0 } as const;
const A_HERO: PickSpec = { type: "hero", control: "you" };
const SUBJECT_HAS_RESOURCES = { kind: "matches", card: "subject", pick: { type: "hero", control: "any", hasResources: true } } as const;

// "Forced: At the end of the round, discard the top card of the encounter deck. The Stormcaller places progress on this stage equal to its Threat plus the Threat of the discarded card."
const stormcallerProgress = (code: string, line: string, id = 1): Effect => ({ id: `${code}:forced:${id}`, cardCode: code, lines: [line], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "StormcallerProgress" }] });

// "If the players are off-course (Cloud, Rain, or Storm), the Stormcaller gets +2 Threat." and "No more than N damage may be placed on the Stormcaller each round."
const stormcallerThreat = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "stormcaller", when: OFF_COURSE }] });
const stormcallerDamageCap = (code: string, line: string, cap: number): Effect => ({ id: `${code}:constant:2`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageCap", amount: cap, until: "whileSourceInPlay", target: "stormcaller" }] });

// The Stormcaller (12019, and 110042 on each of its sides): the players win when it leaves play (it is destroyed), and it goes back to its area when its stage advances. The advance is announced once per
// player; the Stormcaller hears the one of its controller, or the first player's while it stands in the area, so it returns once.
const stormcallerRules = (code: string, advance: string, leaves: string): Effect[] => [
  { id: `${code}:triggered:1`, cardCode: code, lines: [leaves], timing: "triggered", trigger: "enemyDestroyed", subject: "self", instructions: [{ verb: "WinGame" }] },
  { id: `${code}:triggered:2`, cardCode: code, lines: [advance], timing: "triggered", trigger: "stormcallerAdvanced", eventSeat: "you", instructions: [{ verb: "MoveToStormcallerArea" }] },
];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 12012 Swift Departure. Setup: the Corsair deck and the fleet are prepared, the Stormcaller's area is prepared (stages 2C to 4C, the Stormcaller), Rolling Seas is added to the staging area by the scenario's
  // staging pile (1 copy, 2 with 3 or more players), and the encounter deck is shuffled. Side B: Sailing; off-course, 2 progress moves from this stage to the Stormcaller's stage at the end of the quest phase.
  {
    id: "12012:setup:1",
    cardCode: "12012",
    lines: ["12012:A:1"],
    timing: "setup",
    // The Stormcaller starts at stage 2 on its D side: the C side is passed through only by an advance ("first advancing to the C side of the next stage, resolving its effects, and then advancing to the
    // D side", dcce.stormcallers-area-stages), and stage 2C prints no When Revealed to resolve.
    instructions: [{ verb: "PrepareCorsairDeck" }, { verb: "PrepareFleet" }, { verb: "PrepareStormcallerArea", stages: STORMCALLER_STAGES, number: 2 }, { verb: "ShuffleEncounterDeck" }],
  },
  {
    id: "12012:forced:1",
    cardCode: "12012",
    lines: ["12012:B:2"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, OFF_COURSE] },
    instructions: [{ verb: "MoveProgressToStormcaller", amount: 2 }],
  },

  // 12013 Full Sail Ahead. When Revealed: Swift Raider joins the staging area. Side B: no more than 8 progress a round (4 off-course); defeating it at the Stormcaller's stage 2 wins the game.
  { id: "12013:whenRevealed:1", cardCode: "12013", lines: ["12013:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", code: "12021", to: "staging" }, { verb: "ShuffleEncounterDeck" }] },
  { id: "12013:constant:1", cardCode: "12013", lines: ["12013:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 8, until: "whileSourceInPlay", target: "table", when: NOT_OFF_COURSE }] },
  { id: "12013:constant:2", cardCode: "12013", lines: ["12013:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 4, until: "whileSourceInPlay", target: "table", when: OFF_COURSE }] },
  { id: "12013:constant:3", cardCode: "12013", lines: ["12013:B:3"], timing: "constant", instructions: [{ verb: "CatchUpWins", stage: 2 }] },

  // 12014 The Weather Turns Foul. Side B: off-course, an additional encounter card is revealed at the end of the staging step; defeating it at the Stormcaller's stage 3 wins the game.
  { id: "12014:forced:1", cardCode: "12014", lines: ["12014:B:2"], timing: "forced", trigger: "stagingStepEnds", condition: OFF_COURSE, instructions: [{ verb: "RevealEncounter" }] },
  { id: "12014:constant:1", cardCode: "12014", lines: ["12014:B:3"], timing: "constant", instructions: [{ verb: "CatchUpWins", stage: 3 }] },

  // 12015 The Cape of Andrast. When Revealed: cards are discarded from the top of the encounter deck until a Weather treachery is, and its When Revealed effects resolve; they cannot be canceled. Side B: after a
  // Weather treachery is revealed, 1 damage to each Ship objective and Ship enemy; defeating it wins the game.
  {
    id: "12015:whenRevealed:1",
    cardCode: "12015",
    lines: ["12015:A:1"],
    timing: "whenRevealed",
    uncancelable: ALWAYS,
    instructions: [{ verb: "DiscardUntil", type: "treachery", trait: "Weather" }, { verb: "ResolveWhenRevealed", when: { kind: "matches", card: "picked", pick: { type: "treachery", control: "any", trait: "Weather" } } }],
  },
  {
    id: "12015:forced:1",
    cardCode: "12015",
    lines: ["12015:B:2"],
    timing: "forced",
    trigger: "revealed",
    subject: { type: "treachery", control: "any", trait: "Weather" },
    instructions: [{ verb: "DamageEach", amount: 1, pick: SHIP_OBJECTIVE }, { verb: "DamageEach", amount: 1, pick: SHIP_ENEMY }],
  },
  { id: "12015:constant:1", cardCode: "12015", lines: ["12015:B:3"], timing: "constant", instructions: [{ verb: "CatchUpWins", stage: 4 }] },

  // 12016 Full Sail Ahead (the Stormcaller's stage 2C / 2D): off-course the Stormcaller gets +2 Threat; no more than 4 damage a round on it; at the end of the round it makes progress.
  stormcallerThreat("12016", "12016:B:1"),
  stormcallerDamageCap("12016", "12016:B:2", 4),
  stormcallerProgress("12016", "12016:B:3"),

  // 12017 The Weather Turns Foul (3C / 3D). When Revealed: a Sahír's Escort joins the Stormcaller's area. Side D: as 2D with 8 damage a round.
  { id: "12017:whenRevealed:1", cardCode: "12017", lines: ["12017:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", code: "12020", to: "stormcallerArea" }, { verb: "ShuffleEncounterDeck" }] },
  stormcallerThreat("12017", "12017:B:1"),
  stormcallerDamageCap("12017", "12017:B:2", 8),
  stormcallerProgress("12017", "12017:B:3"),

  // 12018 The Cape of Andrast (4C / 4D): the Stormcaller makes progress at the end of the round; if it defeats this stage, the players lose.
  stormcallerProgress("12018", "12018:B:1"),
  {
    id: "12018:triggered:1",
    cardCode: "12018",
    lines: ["12018:B:2"],
    timing: "triggered",
    trigger: "stormcallerStageDefeated",
    instructions: [{ verb: "LoseGame", reason: "The Stormcaller has defeated stage 4: Captain Sahír has gotten away with the key" }],
  },

  // 12019 Stormcaller, and 110042 with its Campaign Mode only side (Boarding 2 is a keyword). It cannot have attachments (player attachments, on the Campaign Expansion's side A; the campaign attaches Black Key).
  ...stormcallerRules("12019", "12019:A:3", "12019:A:4"),
  copyLines("12019", "110042", "A:3", "A:4"),
  {
    id: "110042:constant:2",
    cardCode: "110042",
    lines: ["110042:B:3"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 9, until: "whileSourceInPlay", target: "table", when: SAME_STAGE }],
  },
  copyLine("12019:A:3", "110042:B:4"),
  copyLine("12019:A:4", "110042:B:5"),

  // 12020 Sahír's Escort (Boarding 1 is a keyword). In the Stormcaller's area it contributes its Threat to the Stormcaller's progress. When Revealed: it is added to the Stormcaller's area.
  { id: "12020:constant:2", cardCode: "12020", lines: ["12020:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "stormcallerThreat", amount: 1, until: "whileSourceInPlay", target: "self", when: { kind: "sourceIn", zone: "stormcallerArea" } }] },
  { id: "12020:whenRevealed:1", cardCode: "12020", lines: ["12020:A:4"], timing: "whenRevealed", instructions: [{ verb: "MoveToStormcallerArea", target: "self" }] },

  // 12021 Swift Raider (Boarding 2 is a keyword). In the staging area it engages a player who commits 4 or more characters to a Sailing test or the quest.
  { id: "12021:forced:1", cardCode: "12021", lines: ["12021:A:3"], timing: "forced", trigger: "commitmentMade", condition: IN_STAGING, instructions: [{ verb: "Engage", target: "self", when: { kind: "x", min: 4 } }] },

  // 12022 Corsair Skiff (Surge is a keyword). Forced: when it engages you from the staging area, you raise your threat by 3 or it gains Boarding 1 (Boarding then resolves with the value it has).
  {
    id: "12022:forced:1",
    cardCode: "12022",
    lines: ["12022:A:3"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    eventSeat: "you",
    condition: { kind: "fromStaging" },
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3 }] },
          // Boarding reveals from the Corsair deck: with no card in it or its discard pile the option changes nothing and is not offered (rr.effects), so the threat is raised.
          { id: "boarding", requires: { kind: "corsairHas" }, instructions: [{ verb: "ModifyStat", stat: "boarding", amount: 1, until: "whileSourceInPlay", target: "self" }] },
        ],
      },
    ],
  },

  // 12023 Corsair Seafarer. +1 Attack for each resource on it. Forced: after the engaged player commits a hero to a Sailing test or to the quest, a resource moves from that hero's pool to it.
  { id: "12023:constant:1", cardCode: "12023", lines: ["12023:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  ...(["committed", "committedToSailing"] as const).map(
    (trigger, at): Effect => ({
      id: `12023:forced:${at + 1}`,
      cardCode: "12023",
      lines: ["12023:A:2"],
      timing: "forced",
      trigger,
      subject: A_HERO,
      eventSeat: "you",
      condition: { kind: "sourceIn", zone: "engaged" },
      instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self", when: SUBJECT_HAS_RESOURCES }, { verb: "DiscardResources", amount: 1, target: "subject", when: SUBJECT_HAS_RESOURCES }],
    }),
  ),

  // 12024 Serpent's Blade. Forced: when the Stormcaller advances to the next quest stage, it makes an immediate attack against the engaged player.
  { id: "12024:forced:1", cardCode: "12024", lines: ["12024:A:1"], timing: "forced", trigger: "stormcallerAdvanced", eventSeat: "you", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "AttackActor" }] },

  // 12025 Jagged Reef (Surge is a keyword). Forced: at the beginning of the travel phase, on-course 2 progress on it; off-course 2 damage to each Ship objective instead.
  {
    id: "12025:forced:1",
    cardCode: "12025",
    lines: ["12025:A:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Travel" },
    instructions: [{ verb: "PlaceProgressOn", amount: 2, target: "self", when: ON_COURSE }, { verb: "DamageEach", amount: 2, pick: SHIP_OBJECTIVE, when: OFF_COURSE }],
  },

  // 12026 Hidden Cove. Travel: 2 progress moves from the main quest to the Stormcaller's stage. Response: after it becomes the active location, 4 damage is healed from each Ship objective.
  { id: "12026:travel:1", cardCode: "12026", lines: ["12026:A:1"], timing: "travel", instructions: [{ verb: "MoveProgressToStormcaller", amount: 2 }] },
  {
    id: "12026:response:1",
    cardCode: "12026",
    lines: ["12026:A:2"],
    timing: "response",
    trigger: "becameActive",
    subject: "self",
    instructions: [{ verb: "Each", pick: SHIP_OBJECTIVE, instructions: [{ verb: "Heal", amount: 4, target: "picked" }] }],
  },

  // 12027 Vast Coastland. When Revealed: it is added to the Stormcaller's area. Shadow: +2 Attack if you are at the same stage as the Stormcaller.
  { id: "12027:whenRevealed:1", cardCode: "12027", lines: ["12027:A:1"], timing: "whenRevealed", instructions: [{ verb: "MoveToStormcallerArea", target: "self" }] },
  { id: "12027:shadow:1", cardCode: "12027", lines: ["12027:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: SAME_STAGE }] },

  // 12028 Man Overboard!. When Revealed: each player contributing at least 8 Willpower to the quest discards a questing character; at the worst heading it cannot be canceled. Shadow: +X Attack, X the Stormcaller's stage.
  {
    id: "12028:whenRevealed:1",
    cardCode: "12028",
    lines: ["12028:A:1"],
    timing: "whenRevealed",
    uncancelable: WORST,
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          { verb: "Pick", pick: { type: "character", control: "you", committed: true }, when: { kind: "committedWillpower", min: 8 } },
          { verb: "Discard", target: { kind: "picked" }, when: { kind: "committedWillpower", min: 8 } },
        ],
      },
    ],
  },
  { id: "12028:shadow:1", cardCode: "12028", lines: ["12028:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stormcallerStage: true }, until: "endOfAttack", target: "attacker" }] },

  // 12029 Raging Squall (Doomed 2 is a keyword). When Revealed: it is attached to the current quest, as a Condition attachment; Forced: after an ally is committed to the quest, 1 damage to it if off-course.
  { id: "12029:whenRevealed:1", cardCode: "12029", lines: ["12029:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToQuest" }] },
  { id: "12029:constant:1", cardCode: "12029", lines: ["12029:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  { id: "12029:forced:1", cardCode: "12029", lines: ["12029:A:2"], timing: "forced", trigger: "committed", subject: { type: "ally", control: "any" }, condition: OFF_COURSE, instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }] },

  // 11191 Flight of the Stormcaller (campaign card). Setup (Campaign Mode): the Modification boons and Black Key (burden) and Calaerion are set aside; the Stormcaller shows its Campaign Mode only side and Black Key
  // is attached to it, the ships are fitted and Calaerion comes into play under the player with the Dream-chaser, once the quest card's Setup has prepared the fleet and the Stormcaller's area
  // (ScenarioDefinition.afterSetup); Thunderstruck is shuffled into the encounter deck and Crowley into the Corsair deck. Resolution: the XP list.
  {
    id: "11191:campaignSetup:1",
    cardCode: "11191",
    lines: ["11191:A:2"],
    timing: "campaignSetup",
    instructions: [
      { verb: "SetAside", code: "11172" },
      { verb: "SetAside", code: "11173" },
      { verb: "SetAside", code: "11174" },
      { verb: "SetAside", code: "11175" },
      { verb: "SetAside", code: "11192" },
      { verb: "SetAside", code: "11193" },
      { verb: "ShuffleIntoEncounterDeck", code: "11177" },
      { verb: "ShuffleIntoCorsairDeck", code: "11178" },
      { verb: "FlipStormcaller" },
      { verb: "AttachSetAsideTo", code: "11192", to: "Stormcaller" },
      { verb: "FitShips", codes: ["11172", "11173", "11174", "11175"] },
      { verb: "PutSetAsideInPlay", name: "Calaerion", withCard: "Dream-chaser" },
    ],
  },
  { id: "11191:resolution:2", cardCode: "11191", lines: ["11191:B:3"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: ON_COURSE }] },
  { id: "11191:resolution:3", cardCode: "11191", lines: ["11191:B:4"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "onStage", stage: 2 } }] },
  { id: "11191:resolution:4", cardCode: "11191", lines: ["11191:B:5"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 2, when: { kind: "inVictory", code: "110042", is: true } }] },
  { id: "11191:resolution:5", cardCode: "11191", lines: ["11191:B:6"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "inVictory", codes: ["11178"] }, max: 1 }] },
  { id: "11191:resolution:6", cardCode: "11191", lines: ["11191:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 2, each: { kind: "inVictory", codes: ["11177"] }, max: 2 }] },
  { id: "11191:resolution:7", cardCode: "11191", lines: ["11191:B:8"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: { type: "hero", control: "any", damaged: true }, max: 0 } }] },
]);

// The played goldens store the each/max form of these XP lines; the generated twin writes a count of the victory display.
export const AUTHORED_REPLACES: readonly string[] = ["11191:resolution:5", "11191:resolution:6"];
