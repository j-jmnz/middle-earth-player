import type { Effect } from "../../catalog/boundary.ts";

// Records for the cards of Breaking of the Fellowship (scenario 6, campaign card 142060; 142060's Setup and Resolution are in fellowship-of-the-ring.ts): the stages,
// Frodo's Choice, the locations and the encounter cards that no template in scripts/data/effects/templates.ts reads in full. Every line is read from the scan ledger
// (data/printed/fellowship-of-the-ring.json). The breaking family (src/catalog/families/breaking.ts) is the vocabulary the scenario adds: removing the Ring-bearer from
// the game, skipping the travel phase, the staging area, quest stage and active location each player has from stage 2B, progress that discards cards, archery that
// counts players, and a hero that falls into evil. 142061:B:2 (the players cannot advance while The Argonath is in play) is read by the template
// (src/effects/generated/fellowship-of-the-ring.ts).
// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules, rr.removed-from-game, rr.quest-advancement, rr.engagement-check, rr.travel, rr.step-4-2,
// rr.first-player, rr.the-word-choose, rr.active-location, rr.explored, rr.step-6-4b, mec109.archery (data/rules/entries.json).
const SEAT_OF_SEEING = "142074";
const FRODOS_CHOICE = "142068";
const STAGES_3A = ["142063", "142064", "142065", "142066"] as const;
const STAGE_4 = "142067";
const PARTH_GALEN = "142073";
const SARN_GEBIR = "142076";
const FALLEN_INTO_EVIL = "142083";
const ENEMIES_AT_STAGE = { type: "enemy", control: "any", staging: true, atStage: true } as const;
const ALLIES_AT_STAGE = { type: "ally", control: "any", atStage: true } as const;
// "If the defending character has fewer printed hit points than the attacking enemy" (142079:A:2, 142081:A:2, 142082:A:2).
const DEFENDER_FEWER_HP = { kind: "matches", card: "defender", pick: { type: "character", control: "any", fewerHitPointsThan: "attackingEnemy" } } as const;
const SEARCH_ENEMY_TO_STAGING = [{ verb: "SearchMove", type: "enemy", to: "staging" }, { verb: "ShuffleEncounterDeck" }] as const;

// Each stage 3B prints the same two lines and one Response of its own. "If Frodo's Choice is not in play, any time players would place progress on this quest,
// discard an equal number of cards from the encounter deck instead" holds the flag progressDiscards; "Forced: After Frodo's Choice is revealed at this stage, advance to
// stage 4A" hears the reveal of the seat whose stage it is (the stage is that seat's controller, rules/families/breaking/index.ts).
const STAGE_3B = (code: string, response: Omit<Effect, "id" | "cardCode" | "lines" | "timing" | "trigger" | "eventSeat">): readonly Effect[] => [
  {
    id: `${code}:constant:1`,
    cardCode: code,
    lines: [`${code}:B:1`],
    timing: "constant",
    condition: { kind: "inPlay", code: FRODOS_CHOICE, is: false },
    instructions: [{ verb: "ModifyStat", stat: "progressDiscards", amount: 1, until: "whileSourceInPlay" }],
  },
  {
    id: `${code}:forced:2`,
    cardCode: code,
    lines: [`${code}:B:2`],
    timing: "forced",
    trigger: "revealed",
    subject: { type: "objective", control: "any", names: ["Frodo's Choice"] },
    eventSeat: "you",
    instructions: [{ verb: "AdvanceToStage", code: STAGE_4 }],
  },
  { id: `${code}:response:1`, cardCode: code, lines: [`${code}:B:3`], timing: "response", trigger: "questSucceeded", eventSeat: "you", ...response },
];

// "Forced: After stage 2B is discarded, if the total Threat of encounter cards in this staging area is less than 4, reveal 1 encounter card." (the same line on
// each of the four stage 3A cards): the seat whose stage it is reveals.
const SMALL_AREA_REVEALS = (code: string): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "forced",
  trigger: "stageDiscarded",
  condition: { kind: "stagingThreat", max: 3 },
  instructions: [{ verb: "RevealEncounter" }],
});

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 142061 The Great River. Setup: the piles set Frodo's Choice, Seat of Seeing and Parth Galen aside and put The Argonath and Sarn Gebir in the staging area (the scenario
  // data's piles), so the record has nothing left to do. 1B: enemies get +2 Defense and cannot be engaged; the encounter phase is skipped (the table flag skipEncounter).
  { id: "142061:setup:1", cardCode: "142061", lines: ["142061:A:1"], timing: "setup", instructions: [] },
  {
    id: "142061:constant:2",
    cardCode: "142061",
    lines: ["142061:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", target: "enemies" },
      { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "enemies" },
      { verb: "ModifyStat", stat: "skipEncounter", amount: 1, until: "whileSourceInPlay", target: "table" },
    ],
  },

  // 142062 The Company Divided. 2A: the Ring-bearer and each card attached to it leave the game (The One Ring's text is blank, so its loss line does not fire), each
  // enemy's engagement cost is 0 until the end of the encounter phase, and the travel phase is skipped this round.
  {
    id: "142062:whenRevealed:1",
    cardCode: "142062",
    lines: ["142062:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "RemoveRingBearer" }, { verb: "ZeroEngagementCosts" }, { verb: "SkipTravelPhase" }],
  },
  // 2B: at the end of the refresh phase Seat of Seeing and Frodo's Choice are shuffled into the encounter discard pile, which goes under the encounter deck; each player,
  // first player first, creates a staging area and a stage of their own, a different one of the four stage 3A (one player has the choice of all four); in player order each
  // moves a card of the shared staging area to their own until none are left; then 2B is discarded and each stage 3A hears it.
  {
    id: "142062:forced:1",
    cardCode: "142062",
    lines: ["142062:B:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Refresh" },
    instructions: [
      { verb: "ShuffleSetAsideIntoDiscard", codes: [SEAT_OF_SEEING, FRODOS_CHOICE] },
      { verb: "PlaceDiscardUnderDeck" },
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [{ verb: "Choose", who: "actor", different: true, options: STAGES_3A.map((code) => ({ id: code, instructions: [{ verb: "StartSeparateStage", code }] })) }],
      },
      { verb: "DealOutStaging" },
      { verb: "DiscardSharedStage" },
    ],
  },

  // 142063 Searching the Woods, 142064 Guard the Hobbits, 142065 The Seat of Amon Hen, 142066 Orc Hunting: 3A reveals a card for its seat when its area is small.
  ...STAGES_3A.map(SMALL_AREA_REVEALS),

  // 3B. Response, after you quest successfully: Searching the Woods discards a non-unique location in any staging area; Guard the Hobbits readies each hero of a player;
  // The Seat of Amon Hen has a player draw 2 cards and lower their threat by 2; Orc Hunting discards an enemy engaged with a player.
  ...STAGE_3B("142063", {
    condition: { kind: "canPick", pick: { type: "location", control: "any", stagingOnly: true, stagingArea: "any", nonUnique: true } },
    instructions: [{ verb: "Pick", pick: { type: "location", control: "any", stagingOnly: true, stagingArea: "any", nonUnique: true } }, { verb: "Discard", target: { kind: "picked" } }],
  }),
  ...STAGE_3B("142064", {
    instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "Each", pick: { type: "hero", control: "any", controlledBy: "picked" }, instructions: [{ verb: "Ready", target: "picked" }] }],
  }),
  ...STAGE_3B("142065", {
    instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "Draw", amount: 2, who: "picked" }, { verb: "LowerThreat", amount: 2, who: "picked" }],
  }),
  ...STAGE_3B("142066", {
    condition: { kind: "canPick", pick: { type: "enemy", control: "any" } },
    instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any" } }, { verb: "Discard", target: { kind: "picked" } }],
  }),

  // 142067 The Ring-bearer Sets Out. 4A adds Parth Galen to the staging area of the seat that reveals it and, in the quest phase, ends the phase without resolving the
  // quest. 4B: one more card per player is revealed; after an enemy is revealed at this stage any player (at any stage) may, once a round, raise their threat by its
  // Threat to engage it; defeating the stage wins the game (rr.winning-the-game: the last stage, nothing to run).
  { id: "142067:whenRevealed:1", cardCode: STAGE_4, lines: ["142067:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: PARTH_GALEN }, { verb: "EndQuestPhase", when: { kind: "phase", is: "Quest" } }] },
  { id: "142067:constant:1", cardCode: STAGE_4, lines: ["142067:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "revealMore", amount: { players: true }, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "142067:response:1",
    cardCode: STAGE_4,
    lines: ["142067:B:2"],
    timing: "response",
    trigger: "revealed",
    byEncounterDeck: true,
    subject: { type: "enemy", control: "any" },
    eventSeat: "you",
    anyPlayer: true,
    limit: "oncePerRoundEachPlayer",
    condition: { kind: "matches", card: "subject", pick: { type: "enemy", control: "any" }, inStaging: true },
    instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", of: "subject" }, who: "actor" }, { verb: "Engage", target: "subject" }],
  },
  { id: "142067:constant:2", cardCode: STAGE_4, lines: ["142067:B:3"], timing: "constant", instructions: [] },

  // 142068 Frodo's Choice. If it is discarded it is revealed instead (stage 3B's discards, RevealIfDiscarded). When revealed its player takes the first player token and
  // can never lose it, and takes the Ring-bearer and what is attached to it and attaches to it: stage 2A removed the Ring-bearer from the game, so those two find none and
  // the card stays in the staging area, in play (docs/brief.md, Breaking of the Fellowship, stage 2B).
  { id: "142068:constant:1", cardCode: FRODOS_CHOICE, lines: ["142068:A:1"], timing: "constant", instructions: [{ verb: "RevealIfDiscarded" }] },
  {
    id: "142068:whenRevealed:1",
    cardCode: FRODOS_CHOICE,
    lines: ["142068:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "TakeFirstPlayer" }, { verb: "TakeRingBearer" }, { verb: "AttachSelfToRingBearer" }, { verb: "LockFirstPlayer" }],
  },

  // 142069 Uruk-hai Captain (Toughness 2 is a keyword; the Shadow is read by the template). No attachments; allies with fewer printed hit points cannot defend against it.
  { id: "142069:constant:1", cardCode: "142069", lines: ["142069:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay" }] },
  { id: "142069:constant:2", cardCode: "142069", lines: ["142069:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "defend", belowSourceHitPoints: true }] },

  // 142070 Uruk-hai Archer (Peril and Toughness 1 are keywords). Archery X, X the players at its stage; when revealed its player discards an ally they control.
  { id: "142070:constant:1", cardCode: "142070", lines: ["142070:A:1", "142070:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "archeryPlayers", amount: 1, until: "whileSourceInPlay" }] },
  { id: "142070:whenRevealed:1", cardCode: "142070", lines: ["142070:A:3"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" } }, { verb: "DiscardPicked" }] },

  // 142071 Uruk-hai Tracker (Surge, Toughness 1 and Archery 1 are keywords): +2 Attack against a defender with 2 or fewer printed hit points; the Shadow discards a
  // non-objective attachment of the defending player.
  { id: "142071:constant:1", cardCode: "142071", lines: ["142071:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", when: { kind: "versusDefender", maxHitPoints: 2 } }] },
  { id: "142071:shadow:1", cardCode: "142071", lines: ["142071:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", nonObjective: true } }, { verb: "DiscardPicked" }] },

  // 142072 Uruk-hai Hunter (Peril and Toughness 1 are keywords): the revealing player either chooses a player to reveal an encounter card or the Hunter attacks them.
  {
    id: "142072:whenRevealed:1",
    cardCode: "142072",
    lines: ["142072:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "reveal", instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "SwitchActor", to: "picked" }, { verb: "RevealEncounter" }] },
          { id: "attack", instructions: [{ verb: "AttackFromStaging", target: "self" }] },
        ],
      },
    ],
  },

  // 142073 Parth Galen (immune is a keyword): Travel adds an enemy found in the encounter deck or discard pile to the staging area; the players cannot win while it is in play.
  { id: "142073:travel:1", cardCode: PARTH_GALEN, lines: ["142073:A:2"], timing: "travel", instructions: [...SEARCH_ENEMY_TO_STAGING] },
  { id: "142073:constant:1", cardCode: PARTH_GALEN, lines: ["142073:A:3"], timing: "constant", instructions: [{ verb: "Restrict", what: "advance" }] },

  // 142074 Seat of Seeing (immune is a keyword): once explored, a burden card in play or in the encounter deck or discard pile leaves the game and the campaign pool.
  {
    id: "142074:response:1",
    cardCode: SEAT_OF_SEEING,
    lines: ["142074:A:2"],
    timing: "response",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "all", conditions: [{ kind: "subjectExplored" }, { kind: "canPick", pick: { type: "card", control: "any", burden: true } }] },
    instructions: [{ verb: "Pick", pick: { type: "card", control: "any", burden: true } }, { verb: "RemoveFromGame" }, { verb: "ShuffleEncounterDeck" }],
  },

  // 142075 The Argonath (immune is a keyword): Threat X, the players in the game. The players cannot travel here while Sarn Gebir is in play; while it is the active
  // location the combat phase is skipped.
  { id: "142075:constant:1", cardCode: "142075", lines: ["142075:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay" }] },
  { id: "142075:constant:2", cardCode: "142075", lines: ["142075:A:2"], timing: "constant", condition: { kind: "inPlay", code: SARN_GEBIR, is: true }, instructions: [{ verb: "Restrict", what: "travel" }] },
  { id: "142075:constant:3", cardCode: "142075", lines: ["142075:A:2"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "skipCombat", amount: 1, until: "whileSourceInPlay", target: "table" }] },

  // 142076 Sarn Gebir (immune is a keyword): explored, it deals 1 damage to each exhausted character.
  {
    id: "142076:forced:1",
    cardCode: SARN_GEBIR,
    lines: ["142076:A:2"],
    timing: "forced",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "subjectExplored" },
    instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", state: "exhausted" } }],
  },

  // 142077 River Anduin: in the staging area it gains a Forced effect at the end of the travel phase: each player at its stage raises their threat by 1, then it moves to
  // the staging area to the left, if able.
  {
    id: "142077:forced:1",
    cardCode: "142077",
    lines: ["142077:A:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Travel" }, { kind: "sourceIn", zone: "staging" }] },
    instructions: [{ verb: "RaiseThreatAtStage", amount: 1 }, { verb: "MoveToLeftArea" }],
  },

  // 142078 Wooded Shoreline: archery 2 in the staging area. Travel adds an enemy found in the encounter deck or discard pile to the staging area.
  { id: "142078:constant:1", cardCode: "142078", lines: ["142078:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "archeryBonus", amount: 2, until: "whileSourceInPlay" }] },
  { id: "142078:travel:1", cardCode: "142078", lines: ["142078:A:2"], timing: "travel", instructions: [...SEARCH_ENEMY_TO_STAGING] },

  // 142079 Slopes of Amon Hen: Travel, the traveling player engages an enemy in any staging area. The Shadow gives +1 Attack, +2 against a defender with fewer printed hit points.
  { id: "142079:travel:1", cardCode: "142079", lines: ["142079:A:1"], timing: "travel", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, stagingArea: "any" } }, { verb: "Engage", target: "picked" }] },

  // 142080 Growing Threat (Peril is a keyword): either an enemy engaged with the revealing player goes to the first player's staging area, or this card gains Doomed 2 and
  // Surge. The Shadow moves the attacking enemy there after the attack.
  {
    id: "142080:whenRevealed:1",
    cardCode: "142080",
    lines: ["142080:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "move", requires: { kind: "hasEngaged" }, instructions: [{ verb: "Pick", pick: { type: "enemy", control: "you", engaged: "you" } }, { verb: "MoveToFirstStaging", target: "picked" }] },
          { id: "doomed", instructions: [{ verb: "Doomed", amount: 2 }, { verb: "GainSurge" }] },
        ],
      },
    ],
  },
  { id: "142080:shadow:1", cardCode: "142080", lines: ["142080:A:3"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "MoveToFirstStaging" }] }] },

  // 142081 Orcs of the White Hand: each enemy at the revealing player's stage loses its damage and gets +1 Threat, Attack and Defense until the end of the round. The Shadow
  // makes the attack undefended against a defender with fewer printed hit points.
  {
    id: "142081:whenRevealed:1",
    cardCode: "142081",
    lines: ["142081:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Each",
        pick: ENEMIES_AT_STAGE,
        instructions: [
          { verb: "Heal", all: true, target: "picked" },
          { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfRound", target: "picked" },
          { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "picked" },
          { verb: "ModifyStat", stat: "defense", amount: 1, until: "endOfRound", target: "picked" },
        ],
      },
    ],
  },
  { id: "142081:shadow:1", cardCode: "142081", lines: ["142081:A:2"], timing: "shadow", instructions: [{ verb: "ConsiderUndefended", when: DEFENDER_FEWER_HP }] },

  // 142082 Black Feathered Arrows: until the end of the round the archery total at the revealing player's stage gains 1 for each ally there. The Shadow is 142079's.
  { id: "142082:whenRevealed:1", cardCode: "142082", lines: ["142082:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "archeryBonus", amount: { count: ALLIES_AT_STAGE }, until: "endOfRound", target: "actorSeat" }] },

  // 142083 Fallen Into Evil: attaches to a non-Fellowship hero, which becomes an enemy in the first player's staging area; discarded, the hero returns to its owner.
  { id: "142083:whenRevealed:1", cardCode: FALLEN_INTO_EVIL, lines: ["142083:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "any", exceptSphere: "fellowship" } }, { verb: "FallIntoEvil" }] },
  { id: "142083:constant:1", cardCode: FALLEN_INTO_EVIL, lines: ["142083:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  { id: "142083:triggered:1", cardCode: FALLEN_INTO_EVIL, lines: ["142083:A:1"], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "ReturnFallenHero" }] },

  // 142089 Followed by Night (Peril and Surge are keywords): the topmost enemy of the encounter discard pile is put into play engaged with the revealing player.
  { id: "142089:whenRevealed:1", cardCode: "142089", lines: ["142089:A:2"], timing: "whenRevealed", instructions: [{ verb: "PickDiscardTop", types: ["enemy"] }, { verb: "MoveEncounterCard", card: "picked", to: "engaged" }] },

  // 142090 Ill Fate (Peril and Surge are keywords): attaches to a hero the revealing player controls; after a character that player controls is destroyed, they raise their
  // threat by 2.
  { id: "142090:whenRevealed:1", cardCode: "142090", lines: ["142090:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "you" } }] },
  { id: "142090:constant:1", cardCode: "142090", lines: ["142090:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  { id: "142090:forced:1", cardCode: "142090", lines: ["142090:A:2"], timing: "forced", trigger: "characterDestroyed", subject: { type: "character", control: "any", controlledBy: "host" }, condition: { kind: "not", condition: { kind: "sourceIn", zone: "staging" } }, instructions: [{ verb: "RaiseThreat", amount: 2, who: "hostController" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
