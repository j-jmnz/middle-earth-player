import type { Condition, Effect, Instruction } from "../../catalog/boundary.ts";

// Records for Lost in Mirkwood (Ered Mithrin part 2, campaign card 12168): the encounter cards no template reads, the Objective-Locations of Searching for a Way Out, the seven quest stages and the campaign card. Melanwar (12169) is in pool/EMCE.ts. Every line is read from the scan ledger
// (data/printed/ered-mithrin.json); a line a template already writes (pnpm data build) needs no record here. The piles place the cards set aside (the Spiders of Mirkwood and Dol Guldur Orcs sets, Haldan) and the staging area; stage 1A's Setup takes control of Haldan.
// Rules: emce.setup-lost-in-mirkwood, emce.guarded-x, emce.immune, emce.treasure, emce.haldan, rr.victory, rr.guarded, rr.travel, rr.quest-advancement, rr.explored, rr.surge (data/rules/entries.json).
const MY_CHARACTER = { type: "character", control: "you" } as const;
const MY_ALLY = { type: "ally", control: "you" } as const;
// The quest's stages by number, each level its A stage and its C stage (the letters the Objective-Locations name).
const LEVELS: string[][] = [["18071"], ["18072", "18073"], ["18074", "18075"], ["18076", "18077"]];
const ADVANCE_A = { verb: "AdvanceToLetterStage", letter: "A", levels: LEVELS } as const satisfies Instruction;
const ADVANCE_C = { verb: "AdvanceToLetterStage", letter: "C", levels: LEVELS } as const satisfies Instruction;
// Each player discards the top card of the encounter deck: the discarded card is the one the lines after it read.
const DISCARD_TOP = { verb: "MoveEncounterCard", card: "deckTop", to: "discard" } as const;
const DISCARDED_IS = (type: "enemy" | "location") => ({ kind: "matches", card: "picked", pick: { type, control: "any" }, inPlay: false }) as const;
// "If this attack destroys a character" (12154:A:2): the attack's X is the characters it destroyed.
const DESTROYED_A_CHARACTER = { kind: "x", min: 1 } as const;
// "If it is guarding a card" (18036:A:2): the attacker guards an objective (isGuard) or a hero (Carried Away's guard).
const GUARDING_A_CARD: Condition = { kind: "any", conditions: [{ kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", isGuard: true } }, { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", guardsHero: true } }] };
const FOREST_LOCATION = { type: "location", control: "any", trait: "Forest" } as const;
const NEMESIS = { type: "enemy", control: "any", staging: true, nemesis: true } as const;
const NON_OBJECTIVE_STAGED_LOCATION = { type: "location", control: "any", stagingOnly: true, nonObjective: true } as const;

// Guarded (location) / Guarded (enemy) on an Objective-Location (emce.guarded-x): its When Revealed record, which the cards that put one into play run as well.
const guarded = (code: string, type: "enemy" | "location"): Effect => ({ id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "GuardObjective", types: [type] }] });
// "Shuffle the encounter discard pile into the encounter deck." opens each Travel line.
const OBJECTIVE_TRAVEL = (code: string, then: Effect["instructions"]): Effect => ({ id: `${code}:travel:1`, cardCode: code, lines: [`${code}:A:2`], timing: "travel", instructions: [{ verb: "ShuffleEncounterDiscard" }, ...then] });
const advance = (code: string, letter: typeof ADVANCE_A | typeof ADVANCE_C): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:3`], timing: "forced", trigger: "traveled", subject: "self", instructions: [letter] });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 12168 Lost in Mirkwood (campaign card). Setup: Melanwar comes under the first player's control; the first player may search the encounter deck for a Twilight Hall, which guards a random treasure; once the treasure is free of encounters the first player claims it and chooses the
  // character it attaches to (the engine's rule, emce.treasure: families/wilderland/mirkwood.ts freeTreasures). Resolution: Melanwar joins the pool or the guidance line is written; each treasure the players control is discovered; X Spiders of Mirkwood or Dol Guldur Orcs cards discarded from the encounter deck join the pool (X the number of players).
  { id: "12168:campaignSetup:1", cardCode: "12168", lines: ["12168:A:2"], timing: "campaignSetup", instructions: [{ verb: "PutObjectiveAllyIntoPlay", code: "12169" }, { verb: "SearchGuardForTreasure", code: "18033" }] },
  { id: "12168:resolution:1", cardCode: "12168", lines: ["12168:B:1"], timing: "resolution", instructions: [{ verb: "BoonAllyOrLogLine", ally: "12169", line: "melanwar" }] },
  { id: "12168:resolution:2", cardCode: "12168", lines: ["12168:B:2"], timing: "resolution", instructions: [{ verb: "DiscoverTreasure" }] },
  { id: "12168:resolution:3", cardCode: "12168", lines: ["12168:B:3"], timing: "resolution", instructions: [{ verb: "DiscardToPoolFromSets", sets: ["Spiders of Mirkwood", "Dol Guldur Orcs"], count: { players: true } }] },

  // 18028 Searching for a Way Out. Each Objective-Location and each card guarding one is immune to player card effects. While no Objective-Location is in play, progress on the main quest is discarded from the encounter deck instead (the flag progressDiscards on the
  // quest stage), and then the topmost Objective-Location in the encounter discard pile enters play.
  {
    id: "18028:constant:1",
    cardCode: "18028",
    lines: ["18028:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "card", control: "any", objectiveLocation: true } },
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "card", control: "any", guardsObjectiveLocation: true } },
    ],
  },
  {
    id: "18028:constant:2",
    cardCode: "18028",
    lines: ["18028:A:1"],
    timing: "constant",
    condition: { kind: "not", condition: { kind: "canPick", pick: { type: "card", control: "any", objectiveLocation: true } } },
    instructions: [{ verb: "ModifyStat", stat: "progressDiscards", amount: 1, until: "whileSourceInPlay", target: "currentQuest" }],
  },
  // The Forced effect of the line is the flag above and this marker: the engine discards the cards when the progress would be placed (rules/families/breaking/progress.ts payOwed) and then puts the topmost Objective-Location of the discard pile into play (families/wilderland/mirkwood.ts). Nothing triggers it.
  { id: "18028:forced:1", cardCode: "18028", lines: ["18028:A:2"], timing: "forced", trigger: "progressReplaced", instructions: [{ verb: "PutObjectiveLocationAfterDiscard" }] },

  // 18029 Overgrown Path, 18030 Abandoned Village, 18031 Bare Hilltop, 18032 Forest Clearing (Objective-Locations, Victory 4, 4 quest points). Guarded; Travel: the encounter discard pile is shuffled into the deck and each player discards the top card, whose effect is the line's; after the players
  // travel here the quest advances to the next stage A (Overgrown Path, Bare Hilltop) or C (Abandoned Village, Forest Clearing).
  guarded("18029", "location"),
  OBJECTIVE_TRAVEL("18029", [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [DISCARD_TOP, { verb: "AssignDamage", amount: { stat: "threat", of: "discardTop", printed: true }, pick: MY_CHARACTER }] }]),
  advance("18029", ADVANCE_A),
  guarded("18030", "location"),
  OBJECTIVE_TRAVEL("18030", [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [DISCARD_TOP, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: DISCARDED_IS("enemy") }] }]),
  advance("18030", ADVANCE_C),
  guarded("18031", "enemy"),
  OBJECTIVE_TRAVEL("18031", [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [DISCARD_TOP, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: DISCARDED_IS("location") }] }]),
  advance("18031", ADVANCE_A),
  guarded("18032", "enemy"),
  OBJECTIVE_TRAVEL("18032", [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [DISCARD_TOP, { verb: "RaiseThreat", amount: { stat: "threat", of: "discardTop", printed: true }, who: "actor" }] }]),
  advance("18032", ADVANCE_C),

  // 18033 Twilight Hall: +2 Threat for each resource on it; after a Forest location is explored a resource goes on it; traveling here raises each player's threat by 1 for each resource, and with none the players cannot travel here.
  { id: "18033:constant:1", cardCode: "18033", lines: ["18033:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self", times: 2 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "18033:forced:1", cardCode: "18033", lines: ["18033:A:2"], timing: "forced", trigger: "locationExplored", subject: FOREST_LOCATION, instructions: [{ verb: "PlaceToken", amount: 1 }] },
  { id: "18033:travel:1", cardCode: "18033", lines: ["18033:A:3"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: { stat: "resources", of: "self" }, who: "eachSeat" }] },
  // The second sentence of the Travel line is a rule the engine checks while the card is in play, so its record is a constant (it names the card's constant line: the check allows no other).
  { id: "18033:constant:2", cardCode: "18033", lines: ["18033:A:1"], timing: "constant", condition: { kind: "not", condition: { kind: "less", left: 0, right: { stat: "resources", of: "self" } } }, instructions: [{ verb: "Restrict", what: "travel" }] },

  // 18034 Mirkwood Patrol: at the end of the encounter phase, in the staging area with an unguarded Objective-Location there, it guards that Objective-Location; the Shadow keeps the defender from readying this round.
  {
    id: "18034:forced:1",
    cardCode: "18034",
    lines: ["18034:A:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Encounter" }, { kind: "sourceIn", zone: "staging" }, { kind: "canPick", pick: { type: "objective", control: "any", stagingOnly: true, objectiveLocation: true, hasGuard: false } }] },
    instructions: [{ verb: "Pick", pick: { type: "objective", control: "any", stagingOnly: true, objectiveLocation: true, hasGuard: false } }, { verb: "AttachGuard", guard: "self", to: "picked" }],
  },
  { id: "18034:shadow:1", cardCode: "18034", lines: ["18034:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "doesNotReady", amount: 1, until: "endOfRound", target: "defender" }] },

  // 18035 Ravenous Spider: after it engages you it makes an immediate attack; the Shadow gives the attacker an additional attack against you after this one, dealt a new shadow card (faq.additional-attacks).
  { id: "18035:forced:1", cardCode: "18035", lines: ["18035:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "ImmediateAttack" }] },
  { id: "18035:shadow:1", cardCode: "18035", lines: ["18035:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack" }] }] },

  // 18036 Unseen Danger: each player removes a character they control from the quest and discards the top card of the encounter deck; the character is discarded when that card's printed Threat is above its Willpower. The Shadow gives an attacker guarding a card +2 Attack and +2 Defense for the phase.
  {
    id: "18036:whenRevealed:1",
    cardCode: "18036",
    lines: ["18036:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          { verb: "Pick", pick: { ...MY_CHARACTER, committed: true } },
          { verb: "RemoveFromQuest" },
          DISCARD_TOP,
          // The discard step makes the encounter card the last picked card: the removed character is the one picked before it.
          { verb: "Discard", target: { kind: "previous" }, when: { kind: "less", left: { stat: "willpower", of: "previous" }, right: { stat: "threat", of: "discardTop", printed: true } } },
        ],
      },
    ],
  },
  {
    id: "18036:shadow:1",
    cardCode: "18036",
    lines: ["18036:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", target: "attacker", when: GUARDING_A_CARD },
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "attacker", when: GUARDING_A_CARD },
    ],
  },

  // 18037 Vastness of Mirkwood: until the end of the phase each non-objective location in the staging area gets +1 Threat (+2 with a progress token on it); with fewer such locations than players it gains surge.
  {
    id: "18037:whenRevealed:1",
    cardCode: "18037",
    lines: ["18037:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: { ...NON_OBJECTIVE_STAGED_LOCATION, progress: false } },
      { verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfPhase", holders: { ...NON_OBJECTIVE_STAGED_LOCATION, progress: true } },
      { verb: "GainSurge", when: { kind: "less", left: { count: NON_OBJECTIVE_STAGED_LOCATION }, right: { players: true } } },
    ],
  },

  // 18038 Accursed Forest: while in the staging area 'when revealed' effects cannot be canceled; Travel: reveal the top card of the encounter deck.
  { id: "18038:constant:1", cardCode: "18038", lines: ["18038:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "UncancelableWhenRevealed" }] },
  { id: "18038:travel:1", cardCode: "18038", lines: ["18038:A:2"], timing: "travel", instructions: [{ verb: "RevealEncounter" }] },

  // 18039 Dark Black Woods: while in the staging area no more than 1 progress goes on each Forest location there each round; Travel: each player discards the top card and each enemy so discarded is added to the staging area.
  { id: "18039:constant:1", cardCode: "18039", lines: ["18039:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "progressCap", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, trait: "Forest" } }] },
  { id: "18039:travel:1", cardCode: "18039", lines: ["18039:A:2"], timing: "travel", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [DISCARD_TOP, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: DISCARDED_IS("enemy") }] }] },

  // 18040 Gathering Gloom (Doomed 1): each player raises their threat by 1 for each ally they control or reveals an encounter card; the Shadow gives the attacker +1 Attack and, if the attack destroys a character, the defender's controller discards an ally.
  {
    id: "18040:whenRevealed:1",
    cardCode: "18040",
    lines: ["18040:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: MY_ALLY }, who: "actor" }] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
      },
    ],
  },
  { id: "18040:shadow:1", cardCode: "18040", lines: ["18040:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "Pick", pick: MY_ALLY, when: DESTROYED_A_CHARACTER }, { verb: "Discard", target: { kind: "picked" }, when: DESTROYED_A_CHARACTER }] }] },

  // 18041 Swarm of Bats: each player discards each resource from each hero's pool and raises their threat by 1 for each; with none discarded it gains surge. The Shadow gives the attacker +1 Attack (+2 when the defender has an attachment).
  {
    id: "18041:whenRevealed:1",
    cardCode: "18041",
    lines: ["18041:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "less", left: { resourcesOn: { type: "hero", control: "any" } }, right: 1 } },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RaiseThreat", amount: { resourcesOn: { type: "hero", control: "you" } }, who: "actor" }] },
      { verb: "Each", pick: { type: "hero", control: "any" }, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] },
    ],
  },
  {
    id: "18041:shadow:1",
    cardCode: "18041",
    lines: ["18041:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "character", control: "any", hasAttachment: {} } } } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", hasAttachment: {} } } },
    ],
  },

  // 18071 Ambushed at Night. Setup: the Spiders of Mirkwood and Dol Guldur Orcs sets are set aside (the piles), Haldan is dealt set aside and comes under the first player's control, Searching for a Way Out and a Forest Spider for each player are added to the staging area (the piles), and the encounter deck is shuffled.
  // Side B: player threat cannot be reduced by player card effects; after an enemy engages a player that player raises their threat by 1.
  { id: "18071:setup:1", cardCode: "18071", lines: ["18071:A:1"], timing: "setup", instructions: [{ verb: "AddToStaging", code: "18028" }, { verb: "AddToStaging", code: "01096" }, { verb: "ShuffleEncounterDeck" }] },
  { id: "18071:setup:2", cardCode: "18071", lines: ["18071:A:1"], timing: "setup", instructions: [{ verb: "TakeControlOfSetAside", code: "18070" }] },
  { id: "18071:constant:1", cardCode: "18071", lines: ["18071:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noThreatReduction", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "18071:forced:1", cardCode: "18071", lines: ["18071:B:2"], timing: "forced", trigger: "engaged", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }] },

  // 18072 Spiders of Mirkwood and 18073 Dol Guldur Orcs (stages 2A and 2C): the set swaps into the encounter deck and each player's worth of cards is revealed. The first Spider (Orc) enemy revealed each quest phase gains surge; when a Spider damages a character with an attack that character cannot ready until the end of
  // the round (an Orc: its controller chooses and discards a card from hand).
  { id: "18072:whenRevealed:1", cardCode: "18072", lines: ["18072:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShufflePileIntoEncounterDeck", pile: "spiders" }, { verb: "Repeat", times: { players: true }, instructions: [{ verb: "RevealEncounter" }] }] },
  { id: "18072:forced:1", cardCode: "18072", lines: ["18072:B:1"], timing: "forced", trigger: "revealed", byEncounterDeck: true, subject: { type: "enemy", control: "any", trait: "Spider" }, condition: { kind: "phase", is: "Quest" }, limit: "oncePerPhase", instructions: [{ verb: "GrantSurgeToSubject" }] },
  { id: "18072:forced:2", cardCode: "18072", lines: ["18072:B:2"], timing: "forced", trigger: "damagedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Spider" } }, instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "subject" }] },
  { id: "18073:whenRevealed:1", cardCode: "18073", lines: ["18073:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShufflePileIntoEncounterDeck", pile: "orcs" }, { verb: "Repeat", times: { players: true }, instructions: [{ verb: "RevealEncounter" }] }] },
  { id: "18073:forced:1", cardCode: "18073", lines: ["18073:B:1"], timing: "forced", trigger: "revealed", byEncounterDeck: true, subject: { type: "enemy", control: "any", trait: "Orc" }, condition: { kind: "phase", is: "Quest" }, limit: "oncePerPhase", instructions: [{ verb: "GrantSurgeToSubject" }] },
  { id: "18073:forced:2", cardCode: "18073", lines: ["18073:B:2"], timing: "forced", trigger: "damagedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Orc" } }, instructions: [{ verb: "DiscardFromHand", amount: 1 }] },

  // 18074 Carried Away (stage 3A). Each player chooses a hero, which loses its tokens and attachments; the encounter cards discarded until an enemy is discarded, and that enemy enters the staging area and guards the hero: the hero lies under it, in play and controlled by no one
  // (CarryAwayHero). Side B: the enemies guarding a hero cannot take non-combat damage (the second sentence, the hero in play under no one's control, is the engine's: the captive zone); when one leaves play in any way its hero returns exhausted; leaving the stage discards the heroes still held.
  {
    id: "18074:whenRevealed:1",
    cardCode: "18074",
    lines: ["18074:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }, { verb: "CarryAwayHero" }] }],
  },
  { id: "18074:constant:1", cardCode: "18074", lines: ["18074:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, guardsHero: true } }] },
  { id: "18074:forced:1", cardCode: "18074", lines: ["18074:B:2"], timing: "forced", trigger: "leftPlay", subject: { type: "card", control: "any", guardsHero: true }, instructions: [{ verb: "ReleaseGuardedHero" }] },
  { id: "18074:forced:2", cardCode: "18074", lines: ["18074:B:3"], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "DiscardGuardedHeroes" }] },

  // 18075 Truly Lost (stage 3C). Each player discards until a non-objective location is discarded and adds it to the staging area (an Objective-Location has the Objective type, so DiscardUntil location skips it); then each places their hand facedown under a different location there.
  // Side B: a location gets +1 quest point for each facedown player card under it (an Objective-Location is a location); the explored location returns them to their owners' hands (heard in the staging area and as the active location); leaving the stage discards the cards still under locations.
  {
    id: "18075:whenRevealed:1",
    cardCode: "18075",
    lines: ["18075:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardUntil", type: "location" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "PlaceHandUnderLocation" }] },
    ],
  },
  {
    id: "18075:constant:1",
    cardCode: "18075",
    lines: ["18075:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "questPoints", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any" }, eachAttached: { type: "card", control: "any", facedownUnder: true } },
      { verb: "ModifyStat", stat: "questPoints", amount: 1, until: "whileSourceInPlay", holders: { type: "card", control: "any", objectiveLocation: true }, eachAttached: { type: "card", control: "any", facedownUnder: true } },
    ],
  },
  { id: "18075:forced:1", cardCode: "18075", lines: ["18075:B:2"], timing: "forced", trigger: "locationExplored", subject: { type: "card", control: "any", hasFacedownUnder: true }, instructions: [{ verb: "ReturnFacedownToHands" }] },
  { id: "18075:forced:2", cardCode: "18075", lines: ["18075:B:2"], timing: "forced", trigger: "activeExplored", subject: { type: "card", control: "any", hasFacedownUnder: true }, instructions: [{ verb: "ReturnFacedownToHands" }] },
  { id: "18075:forced:3", cardCode: "18075", lines: ["18075:B:3"], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "DiscardFacedownUnder" }] },

  // 18076 The Forest of Great Fear (stage 4A). Searching for a Way Out leaves the game; the set-aside set's enemy with the most hit points enters the staging area as the nemesis (SearchNemesis). Side B: the nemesis gets +2 Threat, +2 Attack, +2 Defense and is immune to player card effects; at the end of the round
  // it returns to the staging area and attacks the first player; the stage cannot be defeated while it is in play; it cannot take damage with less than 8 progress on the stage; defeating it wins the game.
  { id: "18076:whenRevealed:1", cardCode: "18076", lines: ["18076:A:1"], timing: "whenRevealed", instructions: [{ verb: "RemoveCodeFromGame", code: "18028" }, { verb: "SearchNemesis" }] },
  {
    id: "18076:constant:1",
    cardCode: "18076",
    lines: ["18076:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", holders: NEMESIS },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", holders: NEMESIS },
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", holders: NEMESIS },
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: NEMESIS },
    ],
  },
  { id: "18076:forced:1", cardCode: "18076", lines: ["18076:B:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "NemesisAttacks" }] },
  { id: "18076:constant:2", cardCode: "18076", lines: ["18076:B:3"], timing: "constant", condition: { kind: "canPick", pick: NEMESIS }, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "18076:constant:3", cardCode: "18076", lines: ["18076:B:3"], timing: "constant", condition: { kind: "less", left: { stat: "progress", of: "self" }, right: 8 }, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: NEMESIS }] },
  { id: "18076:triggered:1", cardCode: "18076", lines: ["18076:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: NEMESIS, instructions: [{ verb: "WinGame" }] },

  // 18077 Escape from Taur-nu-fuin (stage 4C). Searching for a Way Out leaves the game and, starting with the first player, each player discards cards until an enemy is discarded and puts it into play engaged with them. At the end of the round each player raises their threat by 1 for each enemy engaged with them;
  // the stage cannot be defeated while a player is engaged with an enemy, and defeating it wins the game.
  { id: "18077:whenRevealed:1", cardCode: "18077", lines: ["18077:A:1"], timing: "whenRevealed", instructions: [{ verb: "RemoveCodeFromGame", code: "18028" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "engaged" }] }] },
  { id: "18077:forced:1", cardCode: "18077", lines: ["18077:B:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "enemy", control: "any", engaged: "you" } }, who: "actor" }] }] },
  { id: "18077:constant:1", cardCode: "18077", lines: ["18077:B:2"], timing: "constant", condition: { kind: "any", conditions: [{ kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you" } }, { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "other" } }] }, instructions: [{ verb: "Restrict", what: "advance" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
