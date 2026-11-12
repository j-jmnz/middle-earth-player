import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for Escape from Mount Gram (angmar-awakened part 5, campaign card 10174). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// Rules: mec108.setup-escape-from-mount-gram, mec108.captured-deck, mec108.captured-cards, mec108.capture-x, mec108.create-staging-area, mec108.joining-another-player, mec108.side-quests-in-play, mec108.time-x, rr.travel, rr.replacement-effects, rr.first-player,
// rr.doomed-x, rr.active-location, rr.player-elimination, faq.progress-without-advancing, easy-mode.easy-mode (data/rules/entries.json).
// The vocabulary is src/catalog/families/captured.ts; the stage cards are 10038 to 10040 and the encounter cards 10041 to 10053; the campaign card (10174) and Loot the Dungeons (10175) are placed by the campaign; the boons 10176 to 10181 are Loot's rewards.

const STAGE_2 = "10039";
const STAGE_3 = "10040";
const SOUTHERN_GATE = "10042";
const PRISON_CELL = "10046";
const LOOT = "10175";
const DETERMINATION = "10172";
const BOONS = ["10176", "10177", "10178", "10179", "10180", "10181"];

const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const MY_ALLY: PickSpec = { type: "ally", control: "you" };
const MY_EXHAUSTED: PickSpec = { type: "character", control: "you", state: "exhausted" };
const ANY_CARD: PickSpec = { type: "card", control: "any" };
const FIRST_PLAYERS_CAPTURED_HERE: PickSpec = { type: "card", control: "any", captured: "underSelf", who: "firstPlayer" };

// A Capture X keyword and the encounter cards that print it.
const capture = (code: string, line: string, amount: number): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "Capture", amount }] });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 10038 Unexpected Rescue (stage 1). Setup: each player shuffles their hand into their deck, chooses a starting hero and prepares a captured deck, the encounter deck is shuffled and each player draws a new hand of 3 (the piles set Southern Gate, Jailor Gornákh and
  // the Angmar Orcs aside). When Revealed: each player, in turn, gets a staging area of their own and a different stage 2A (the quest deck holds a copy for each player), which is revealed for them.
  {
    id: "10038:setup:1",
    cardCode: "10038",
    lines: ["10038:A:1"],
    timing: "setup",
    instructions: [
      EACH_PLAYER([{ verb: "ShuffleHandIntoDeck" }, { verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "PrepareCapturedDeck" }]),
      { verb: "ShuffleEncounterDeck" },
      EACH_PLAYER([{ verb: "Draw", amount: 3 }]),
    ],
  },
  { id: "10038:whenRevealed:1", cardCode: "10038", lines: ["10038:B:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "StartSeparateStage", code: STAGE_2, reveal: true }])] },

  // 10039 Gornákh's Dungeons (stage 2). Capture 7. When Revealed: the player searches the encounter deck for a Prison Cell, reveals it (staging area, Capture 1) and captures 2 more cards underneath it. 2B: progress placed on it rescues that many captured cards at random
  // instead (the active location takes it first); Forced: at the beginning of the travel phase, with no captured card underneath it, the player joins another player, or all players advance to stage 3A together.
  capture(STAGE_2, "10039:A:1", 7),
  {
    id: "10039:whenRevealed:1",
    cardCode: STAGE_2,
    lines: ["10039:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "SearchReveal", code: PRISON_CELL, who: "actor", deckOnly: true }, { verb: "CaptureFromDeck", amount: 2, end: "top", under: { code: PRISON_CELL } }],
  },
  { id: "10039:constant:2", cardCode: STAGE_2, lines: ["10039:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressRescues", amount: 1, until: "whileSourceInPlay" }] },
  {
    id: "10039:forced:1",
    cardCode: STAGE_2,
    lines: ["10039:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Travel" }, { kind: "captured", is: "noneUnderSelf" }] },
    instructions: [{ verb: "JoinAnotherPlayer", advanceTo: STAGE_3 }],
  },

  // 10040 The Southern Gate (stage 3). When Revealed: Southern Gate and Jailor Gornákh join the staging area, the Angmar Orcs are shuffled into the encounter deck and each player reveals a card. The players cannot travel to Southern Gate without 16 progress on this stage,
  // and cannot defeat the stage while Southern Gate is in play (defeating it wins the game).
  {
    id: "10040:whenRevealed:1",
    cardCode: STAGE_3,
    lines: ["10040:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "AddSetAsideToStaging", code: SOUTHERN_GATE },
      { verb: "AddSetAsideToStaging", code: "10041" },
      { verb: "ShuffleSetAsideSet", set: "Angmar Orcs" },
      { verb: "ShuffleEncounterDeck" },
      EACH_PLAYER([{ verb: "RevealEncounter" }]),
    ],
  },
  { id: "10040:constant:1", cardCode: STAGE_3, lines: ["10040:B:1"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 16 } }, instructions: [{ verb: "Restrict", what: "travel", location: SOUTHERN_GATE }] },
  { id: "10040:constant:2", cardCode: STAGE_3, lines: ["10040:B:2"], timing: "constant", condition: { kind: "inPlay", code: SOUTHERN_GATE, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 10041 Jailor Gornákh. Forced: after captured cards are rescued, he engages the player with the highest threat (the first player chooses among those tied) and makes an immediate attack against them.
  {
    id: "10041:forced:1",
    cardCode: "10041",
    lines: ["10041:A:1"],
    timing: "forced",
    trigger: "capturedRescued",
    subject: ANY_CARD,
    instructions: [{ verb: "Pick", pick: { type: "player", control: "any", highestThreat: true, who: "firstPlayer" } }, { verb: "EngageSelfWithPicked" }, { verb: "SwitchActor", to: "picked" }, { verb: "ImmediateAttack" }],
  },

  // 10042 Southern Gate (location). While it is the active location each Orc enemy gets +2 Attack; Forced: when it becomes the active location each player with less than 35 threat raises it to 35 (the verb runs for each player, in turn).
  {
    id: "10042:constant:1",
    cardCode: SOUTHERN_GATE,
    lines: ["10042:A:2"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "activeLocation" },
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceActive", holders: { type: "enemy", control: "any", staging: true, trait: "Orc" } }],
  },
  { id: "10042:forced:1", cardCode: SOUTHERN_GATE, lines: ["10042:A:3"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [EACH_PLAYER([{ verb: "RaiseThreatTo", amount: 35 }])] },

  // 10043 Cruel Torturer. Capture 1. A marker the damage step reads: the ally its attack would damage is captured underneath it instead.
  capture("10043", "10043:A:1", 1),
  { id: "10043:forced:1", cardCode: "10043", lines: ["10043:A:2"], timing: "forced", trigger: "wouldDamageAlly", subject: "self", instructions: [{ verb: "CaptureInsteadOfDamage" }] },

  // 10044 Dungeon Guard. Capture 1. Response: after the cards captured underneath it are rescued, the first player may put 1 of them into play at no cost.
  capture("10044", "10044:A:1", 1),
  {
    id: "10044:response:1",
    cardCode: "10044",
    lines: ["10044:A:2"],
    timing: "response",
    trigger: "capturedRescued",
    subject: "self",
    // The event is about the first player of the area the guard was in: that player answers (mec108.create-staging-area).
    answeredBy: "eventSeat",
    condition: { kind: "canPick", pick: { type: "card", control: "any", captured: "rescued", who: "firstPlayer" } },
    instructions: [{ verb: "Pick", pick: { type: "card", control: "any", captured: "rescued", who: "firstPlayer" } }, { verb: "PutCapturedIntoPlay" }],
  },

  // 10045 Goblin Tormentor. Capture 1. Its Attack is the number of cards in play with captured cards underneath them. Shadow: +1 Attack to the attacking enemy, +2 instead if it has no captured cards underneath it.
  capture("10045", "10045:A:1", 1),
  { id: "10045:constant:2", cardCode: "10045", lines: ["10045:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { captured: "cardsWith" }, until: "whileSourceInPlay" }] },
  {
    id: "10045:shadow:1",
    cardCode: "10045",
    lines: ["10045:A:3"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "captured", is: "noneUnderAttacker" } },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "captured", is: "noneUnderAttacker" } } },
    ],
  },

  // 10046 Prison Cell (location). Capture 1. Response: after the players travel to it, the first player looks at the cards captured underneath it and chooses 1 to put into play at no cost; the others stay underneath.
  capture(PRISON_CELL, "10046:A:1", 1),
  {
    id: "10046:response:1",
    cardCode: PRISON_CELL,
    lines: ["10046:A:2"],
    timing: "response",
    trigger: "traveled",
    subject: "self",
    condition: { kind: "canPick", pick: FIRST_PLAYERS_CAPTURED_HERE },
    instructions: [{ verb: "Pick", pick: FIRST_PLAYERS_CAPTURED_HERE }, { verb: "PutCapturedIntoPlay" }],
  },

  // 10047 Patrol Room (location). Capture 2. Travel: each player sharing the staging area raises their threat by 3 to travel here.
  capture("10047", "10047:A:1", 2),
  { id: "10047:travel:1", cardCode: "10047", lines: ["10047:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "RaiseThreat", amount: 3, who: "actor" }])] },

  // 10048 Tunnels of Mount Gram (location). Capture 1. Its Threat is the number of captured cards underneath it. Shadow: the attacking enemy captures each attachment attached to the defending character.
  capture("10048", "10048:A:1", 1),
  { id: "10048:constant:2", cardCode: "10048", lines: ["10048:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { captured: "under" }, until: "whileSourceInPlay" }] },
  { id: "10048:shadow:1", cardCode: "10048", lines: ["10048:A:3"], timing: "shadow", instructions: [{ verb: "CaptureAttachments" }] },

  // 10049 Sound the Alarm. When Revealed: until the end of the round each enemy (in its staging area, and arriving later: an encounter card's lasting effect) gets -10 engagement cost and +1 Attack; with no enemy in play there, an enemy found in the encounter deck or discard pile is added to the staging area.
  {
    id: "10049:whenRevealed:1",
    cardCode: "10049",
    lines: ["10049:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "endOfRound", target: "enemies" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "enemies" },
      { verb: "SearchMove", type: "enemy", to: "staging", when: { kind: "enemyInPlay", is: false } },
    ],
  },

  // 10050 Feeble and Weary. When Revealed: each player chooses for themselves: 1 damage to each exhausted character they control, or remove each exhausted character they control from the quest. Shadow: the defending player exhausts a character they control.
  {
    id: "10050:whenRevealed:1",
    cardCode: "10050",
    lines: ["10050:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "damage", requires: { kind: "canPick", pick: MY_EXHAUSTED }, instructions: [{ verb: "Each", pick: MY_EXHAUSTED, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] }] },
            { id: "remove", requires: { kind: "canPick", pick: { ...MY_EXHAUSTED, committed: true } }, instructions: [{ verb: "Each", pick: { ...MY_EXHAUSTED, committed: true }, instructions: [{ verb: "RemoveFromQuest" }] }] },
          ],
        },
      ]),
    ],
  },
  {
    id: "10050:shadow:1",
    cardCode: "10050",
    lines: ["10050:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }],
  },

  // 10051 Captives of Gornákh. When Revealed: each player chooses one of their allies and captures it underneath the encounter card with the highest Threat in play in their area (the first player chooses among those tied). Shadow: the ally the attack would damage is captured instead.
  {
    id: "10051:whenRevealed:1",
    cardCode: "10051",
    lines: ["10051:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        { verb: "Pick", pick: MY_ALLY },
        { verb: "Pick", pick: { type: "card", control: "any", captured: "hosts", highestThreat: true, who: "firstPlayer" }, when: { kind: "canPick", pick: MY_ALLY } },
        { verb: "CapturePicked" },
      ]),
    ],
  },
  { id: "10051:shadow:1", cardCode: "10051", lines: ["10051:A:2"], timing: "shadow", instructions: [{ verb: "CaptureInsteadOfDamage" }] },

  // 10052 Interrogation. When Revealed: each player discards the top card of their captured deck and raises their threat by its printed resource cost; if any player had none to discard it gains Doomed 2. Shadow: discard a random card from your hand and raise your threat by its printed cost.
  {
    id: "10052:whenRevealed:1",
    cardCode: "10052",
    lines: ["10052:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "DiscardCapturedTop", raiseByCost: true }, { verb: "Doomed", amount: 2, when: { kind: "captured", is: "someoneEmpty" } }],
  },
  {
    id: "10052:shadow:1",
    cardCode: "10052",
    lines: ["10052:A:2"],
    timing: "shadow",
    instructions: [{ verb: "DiscardRandomFromHand", raiseByCost: true }],
  },

  // 10053 Stop the Executioners! (encounter side quest, 6 quest points). Capture 5, Time 4. Forced: when the last time counter is removed, its captured cards are discarded and it is removed from the game; each player raises their threat by 3 for each of their characters so discarded.
  capture("10053", "10053:A:1", 5),
  { id: "10053:constant:2", cardCode: "10053", lines: ["10053:A:2"], timing: "constant", instructions: [{ verb: "Time", amount: 4 }] },
  { id: "10053:forced:1", cardCode: "10053", lines: ["10053:A:3"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [{ verb: "DiscardCapturedUnder", threat: 3 }, { verb: "RemoveFromGame", self: true }] },

  // 10174 Escape from Mount Gram (campaign card). Setup (after the quest card's, before stage 2A is revealed): the permanent boons of the heroes in the captured decks are set aside, Loot the Dungeons joins the staging area and each player's bottom 5 captured cards are captured underneath it.
  // Forced: the refresh phase raises each player's threat by the completed quest cards plus the side quests in the victory display instead of 1; after a hero enters play it gets its set-aside boons. Resolution: the unique cards still in each captured deck are recorded as stolen.
  {
    id: "10174:campaignSetup:1",
    cardCode: "10174",
    lines: ["10174:A:2"],
    timing: "campaignSetup",
    instructions: [{ verb: "SetAsideCapturedBoons" }, { verb: "AddToStaging", code: LOOT }, { verb: "CaptureFromDeck", amount: 5, end: "bottom", under: { code: LOOT }, who: "eachSeat" }],
  },
  {
    id: "10174:forced:1",
    cardCode: "10174",
    lines: ["10174:B:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Refresh" },
    instructions: [{ verb: "RaiseThreat", amount: { captured: "questsAndSides" }, who: "eachSeat" }],
  },
  { id: "10174:forced:2", cardCode: "10174", lines: ["10174:B:2"], timing: "forced", trigger: "heroEnteredPlay", subject: { type: "hero", control: "any" }, instructions: [{ verb: "AttachHeroBoons" }] },
  { id: "10174:resolution:1", cardCode: "10174", lines: ["10174:B:3"], timing: "resolution", instructions: [{ verb: "RecordStolenCards" }, { verb: "RecordDetermined", code: DETERMINATION }] },

  // 10175 Loot the Dungeons (encounter side quest, in every player's staging area). 4 quest points and 4 more for each player in the game. Forced: when it is defeated each player, in turn, may choose one of the boons and add it to their hand and the Campaign Pool.
  { id: "10175:constant:1", cardCode: LOOT, lines: ["10175:A:1"], timing: "constant", instructions: [{ verb: "InEveryArea" }, { verb: "ModifyStat", stat: "questPoints", amount: { captured: "players", times: 4 }, until: "whileSourceInPlay" }] },
  { id: "10175:forced:1", cardCode: LOOT, lines: ["10175:A:2"], timing: "forced", trigger: "questDefeated", subject: "self", instructions: [{ verb: "ChooseBoonToHand", codes: BOONS }] },

  // 10176 Berelind (ally boon). Response: after she attacks and destroys an enemy, 1 progress is placed on a quest card in play (the player chooses it).
  { id: "10176:response:1", cardCode: "10176", lines: ["10176:A:1"], timing: "response", trigger: "attackDestroyed", subject: "self", instructions: [{ verb: "Pick", pick: { type: "card", control: "any", questCard: true } }, { verb: "PlaceProgressOnQuestCard", amount: 1 }] },
  // 10177 Chieftain's Brooch (attachment boon). Each ally that shares a Trait with the attached hero gets +1 Willpower.
  { id: "10177:constant:2", cardCode: "10177", lines: ["10177:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", holders: { type: "ally", control: "any", sharesTrait: "host" } }] },
  // 10178 Coruhaer (ally boon). Response: after he defends an attack, spend 1 resource to deal 2 damage to the attacking enemy.
  { id: "10178:response:1", cardCode: "10178", lines: ["10178:A:1"], timing: "response", trigger: "declaredDefender", subject: "self", cost: { kind: "resources", amount: 1 }, instructions: [{ verb: "DamageCard", amount: 2, target: "other" }] },
  // 10179 Laermuin (ally boon). Response: after he commits to a quest, 1 damage is healed from a character.
  {
    id: "10179:response:1",
    cardCode: "10179",
    lines: ["10179:A:1"],
    timing: "response",
    trigger: "committed",
    subject: "self",
    condition: { kind: "canPick", pick: { type: "character", control: "any", damaged: true } },
    instructions: [{ verb: "Pick", pick: { type: "character", control: "any", damaged: true } }, { verb: "Heal", amount: 1, target: "picked" }],
  },
  // 10180 Mail of Eärnur (attachment boon). The attached hero gets +2 hit points; Response: after a player's threat is reduced, 1 damage is healed from the attached hero.
  { id: "10180:constant:2", cardCode: "10180", lines: ["10180:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: 2, until: "whileSourceInPlay", target: "host" }] },
  { id: "10180:response:1", cardCode: "10180", lines: ["10180:A:3"], timing: "response", trigger: "threatLowered", condition: { kind: "matches", card: "host", pick: { type: "hero", control: "any", damaged: true } }, instructions: [{ verb: "Heal", amount: 1, target: "host" }] },
  // 10181 Silverthorn (attachment boon). The attached hero gets +1 Attack and +1 Defense against an enemy that shares a Trait with an enemy in the victory display; Response (once per game): after it attacks and destroys an enemy, that enemy is added to the victory display.
  {
    id: "10181:constant:2",
    cardCode: "10181",
    lines: ["10181:A:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host", when: { kind: "versusVictoryTrait" } },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host", when: { kind: "versusVictoryTrait" } },
    ],
  },
  { id: "10181:response:1", cardCode: "10181", lines: ["10181:A:3"], timing: "response", trigger: "attackDestroyed", subject: "host", limit: "oncePerGame", instructions: [{ verb: "AddToVictory", target: "other" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
