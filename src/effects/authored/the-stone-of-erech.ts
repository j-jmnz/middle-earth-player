import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

// Records for The Stone of Erech (standalone-scenarios cycle part 3, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// The Night objectives (Eventide, Dusk, Midnight) lie one at a time beside the current quest (the zone nightObjective, src/rules/families/erech/): "Dusk." lines are live only while Dusk is in play and "Midnight." lines only while Midnight is, and Midnight's values replace
// Dusk's ("instead"), so a card with both writes a record for each. Rules: rr.forced, rr.blank, rr.cost, rr.action, rr.surge, rr.keywords, rr.first-player, rr.active-location, rr.immune, faq.lasting-effects (data/rules/entries.json); the readings are in docs/brief.md (The Stone of Erech).
const DUSK: Condition = { kind: "night", is: "dusk" };
const MIDNIGHT: Condition = { kind: "night", is: "midnight" };
const LATE: Condition = { kind: "night", is: "duskOrMidnight" };
const NOT_LATE: Condition = { kind: "not", condition: LATE };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const A_CHARACTER = (maxWillpower: number): PickSpec => ({ type: "character", control: "any", maxWillpower });
const OATHBREAKER: PickSpec = { type: "enemy", control: "any", trait: "Oathbreaker" };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const SELF_ENEMY: PickSpec = { type: "enemy", control: "any", isSource: true };
const STONE = "The Stone of Erech";

// A stat of the source card that holds while the Night objective is `when` ("Dusk. Whisperer gets +1 Threat").
const SELF_STAT = (stat: "attack" | "defense" | "threat" | "questPoints" | "willpower" | "gainsSurge", amount: number): Instruction => ({ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "self" });
const NIGHT_STATS = (code: string, line: string, id: number, when: Condition, ...stats: Instruction[]): Effect => ({ id: `${code}:constant:${id}`, cardCode: code, lines: [line], timing: "constant", condition: when, instructions: stats });
// "Attacking enemy gets +1 Attack (Dusk. +2 Attack instead. Midnight. +3 Attack instead)": the value of the Night in play, never summed.
const ATTACK_BY_NIGHT = (base: number, dusk: number, midnight: number): Instruction[] => [
  { verb: "ModifyStat", stat: "attack", amount: base, until: "endOfAttack", target: "attacker", when: NOT_LATE },
  { verb: "ModifyStat", stat: "attack", amount: dusk, until: "endOfAttack", target: "attacker", when: DUSK },
  { verb: "ModifyStat", stat: "attack", amount: midnight, until: "endOfAttack", target: "attacker", when: MIDNIGHT },
];
const SEARCH_UNDEAD: Instruction = { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchReveal", trait: "Undead", type: "enemy", who: "actor" }] };
// The Night objective's own Forced effect: at the end of the round it places 1 progress on itself (the limit is NightAdvance, a passive check).
const NIGHT_FORCED = (code: string, line: string): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "self" }] });
const NIGHT_ADVANCE = (code: string, line: string, next: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "NightAdvance", at: 4, next }] });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 50301 The Disappearance. Setup: Eventide comes into play beside the quest (the set aside cards and the active location are dealt by the piles). Stage 1B: 1 encounter card per player is revealed and added to the staging area; the players cannot defeat the stage
  // while Tarlang's Neck is in play (anywhere; the quest progress that would have advanced it is lost, as it is for any stage that cannot advance).
  { id: "50301:setup:1", cardCode: "50301", lines: ["50301:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }, { verb: "PutNightObjective", code: "50308" }] },
  { id: "50301:whenRevealed:1", cardCode: "50301", lines: ["50301:B:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }] },
  { id: "50301:constant:1", cardCode: "50301", lines: ["50301:B:2"], timing: "constant", condition: { kind: "inPlay", code: "50307", is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 50302 Terror of the Dead. Stage 2A: the Stone (set aside) is added to the staging area and Derufin (set aside) attached to it, not revealed. Stage 2B: at the beginning of each round the first player chooses for the players: everyone skips the next planning phase, or
  // no hero collects resources in the resource phase this round (effects that add resources still work). The choice is per round.
  { id: "50302:whenRevealed:1", cardCode: "50302", lines: ["50302:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "50306" }, { verb: "AttachSetAsideToStaged", code: "50304", to: STONE }] },
  {
    id: "50302:forced:1",
    cardCode: "50302",
    lines: ["50302:B:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Beginning of round" },
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "skipPlanning", instructions: [{ verb: "ModifyStat", stat: "skipPlanning", amount: 1, until: "endOfRound", target: "table" }] },
          { id: "noCollect", instructions: [{ verb: "ModifyStat", stat: "noCollect", amount: 1, until: "endOfRound", target: "table" }] },
        ],
      },
    ],
  },

  // 50303 The Shadow Host. Stage 3A: starting with the first player each player searches the encounter deck and discard pile for 1 Oathbreaker enemy, reveals it and adds it to the staging area; the Lord of the Dead (set aside) is added (not revealed) and the encounter deck
  // shuffled. Stage 3B: Midnight. Battle (characters quest with their Attack); no progress at all goes on the stage unless a player controls Derufin; defeating it wins.
  {
    id: "50303:whenRevealed:1",
    cardCode: "50303",
    lines: ["50303:A:1", "50303:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchReveal", trait: "Oathbreaker", type: "enemy", who: "actor" }] }, { verb: "AddSetAsideToStaging", code: "50305" }, { verb: "ShuffleEncounterDeck" }],
  },
  { id: "50303:constant:1", cardCode: "50303", lines: ["50303:B:1"], timing: "constant", condition: MIDNIGHT, instructions: [{ verb: "ModifyStat", stat: "battle", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "50303:constant:2",
    cardCode: "50303",
    lines: ["50303:B:2"],
    timing: "constant",
    condition: { kind: "not", condition: { kind: "playersControl", code: "50304" } },
    instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }],
  },
  { id: "50303:triggered:1", cardCode: "50303", lines: ["50303:B:3"], timing: "triggered", trigger: "questDefeated", instructions: [{ verb: "WinGame" }] },

  // 50304 Derufin (objective ally, attached to the Stone while nobody controls him). After the players travel to the Stone the first player gains control of him: he leaves the Stone and joins that player's area, ready. Dusk -1 Willpower, Midnight -2 (the value of the Night
  // in play). If he leaves play the players lose (the generated record).
  {
    id: "50304:forced:1",
    cardCode: "50304",
    lines: ["50304:A:1"],
    timing: "forced",
    trigger: "traveled",
    subject: { type: "location", control: "any", names: [STONE] },
    instructions: [{ verb: "FreeAttachedObjective", who: "firstPlayer" }],
  },
  NIGHT_STATS("50304", "50304:A:2", 2, DUSK, SELF_STAT("willpower", -1)),
  NIGHT_STATS("50304", "50304:A:3", 3, MIDNIGHT, SELF_STAT("willpower", -2)),

  // 50305 The Lord of the Dead (Spectral and no attachments are the keyword and the generated record). While a player is engaged with him, every printed text box of the characters that player controls is blank except Traits: abilities and keywords alike (rr.blank), the
  // moment the engagement begins; text an attachment gives is not printed on the character.
  { id: "50305:constant:2", cardCode: "50305", lines: ["50305:A:2"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "engagedSeatCharacters" }] },

  // 50306 The Stone of Erech. Threat X: twice the number of players (the data row prints none). Immune to player card effects is the keyword. While it is the active location, characters (heroes and allies of every player) with less than 2 Willpower cannot ready.
  // Travel: each such character exhausts.
  { id: "50306:constant:1", cardCode: "50306", lines: ["50306:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true, times: 2 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "50306:constant:2", cardCode: "50306", lines: ["50306:A:2"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "doesNotReady", amount: 1, until: "whileSourceInPlay", holders: A_CHARACTER(1) }] },
  { id: "50306:travel:1", cardCode: "50306", lines: ["50306:A:3"], timing: "travel", instructions: [{ verb: "ExhaustEach", pick: A_CHARACTER(1) }] },

  // 50307 Tarlang's Neck. While it is the active location it gains a Forced effect: at the beginning of the encounter phase the players choose (the first player decides, as for stage 2B) to end the encounter phase at once, or the first player engages every enemy in the staging area.
  {
    id: "50307:forced:1",
    cardCode: "50307",
    lines: ["50307:A:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Encounter" }, ACTIVE] },
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "endPhase", instructions: [{ verb: "EndPhase" }] }, { id: "engageAll", instructions: [{ verb: "EngageAll", who: "firstPlayer" }] }] }],
  },

  // 50308-50310 The Night objectives. At the end of the round each places 1 progress on itself (Midnight then raises each player's threat by its progress); at 4 progress Eventide gives way to Dusk and Dusk to Midnight (NightAdvance: the card goes to the victory display with its
  // progress, the next comes into play with none; a passive check made whenever progress lands). Midnight has no limit.
  NIGHT_FORCED("50308", "50308:A:1"),
  NIGHT_ADVANCE("50308", "50308:A:2", "50309"),
  NIGHT_FORCED("50309", "50309:A:1"),
  NIGHT_ADVANCE("50309", "50309:A:2", "50310"),
  { id: "50310:forced:1", cardCode: "50310", lines: ["50310:A:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "self" }, { verb: "RaiseThreat", amount: { stat: "progress", of: "self" }, who: "eachSeat" }] },

  // 50311 Relic from the Dark Years (objective). Midnight. Action: any player claims it (it must be free of encounters) and attaches it to a hero he controls. It counts as an Artifact attachment with the text: when the attached hero attacks an Oathbreaker, that enemy loses
  // Spectral until the end of the phase (for that attack too: it is lost as the attack is declared, before its strength is set).
  {
    id: "50311:action:1",
    cardCode: "50311",
    lines: ["50311:A:1"],
    timing: "action",
    anyPlayer: true,
    condition: { kind: "all", conditions: [MIDNIGHT, IN_STAGING, { kind: "freeOfEncounters" }, { kind: "canPick", pick: { type: "hero", control: "you" } }] },
    instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "ClaimObjective" }],
  },
  { id: "50311:constant:1", cardCode: "50311", lines: ["50311:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Artifact" }] },
  {
    id: "50311:forced:1",
    cardCode: "50311",
    lines: ["50311:A:1"],
    timing: "forced",
    trigger: "declaredAttacker",
    subject: "host",
    condition: { kind: "all", conditions: [{ kind: "matches", card: "host", pick: { type: "hero", control: "any" } }, { kind: "matches", card: "other", pick: OATHBREAKER }] },
    instructions: [{ verb: "ModifyStat", stat: "losesSpectral", amount: 1, until: "endOfPhase", target: "other" }],
  },

  // 50312 Shadow-man (Spectral). When Revealed: no player plays an event until the end of the round. Shadow: +1 Attack (+2 at Dusk, +3 at Midnight).
  { id: "50312:whenRevealed:1", cardCode: "50312", lines: ["50312:A:2"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "cannotPlayEvents", amount: 1, until: "endOfRound", target: "table" }] },
  { id: "50312:shadow:1", cardCode: "50312", lines: ["50312:A:3"], timing: "shadow", instructions: ATTACK_BY_NIGHT(1, 2, 3) },

  // 50313 Restless Dead (Spectral). When Revealed: the topmost Undead enemy of the encounter discard pile goes to the staging area, not revealed.
  { id: "50313:whenRevealed:1", cardCode: "50313", lines: ["50313:A:2"], timing: "whenRevealed", instructions: [{ verb: "ReturnFromDiscard", trait: "Undead", count: 1 }] },

  // 50314 Whisperer (Spectral). Dusk +1 Threat; Midnight +2 Threat and doomed 2 (counted when it is revealed).
  NIGHT_STATS("50314", "50314:A:2", 2, DUSK, SELF_STAT("threat", 1)),
  NIGHT_STATS("50314", "50314:A:3", 3, MIDNIGHT, SELF_STAT("threat", 2), { verb: "GainsDoomed", amount: 2, pick: SELF_ENEMY }),

  // 50315 Shadow Host Captain (Spectral). Dusk +1 Attack and +1 Defense; Midnight +2 and +2.
  NIGHT_STATS("50315", "50315:A:2", 2, DUSK, SELF_STAT("attack", 1), SELF_STAT("defense", 1)),
  NIGHT_STATS("50315", "50315:A:3", 3, MIDNIGHT, SELF_STAT("attack", 2), SELF_STAT("defense", 2)),

  // 50316 Regretful Shade (Spectral, Surge). Shadow: the attacking enemy is dealt 1 additional shadow card (2 at Dusk, 3 at Midnight).
  { id: "50316:shadow:1", cardCode: "50316", lines: ["50316:A:2"], timing: "shadow", instructions: [{ verb: "DealShadow", additional: true }, { verb: "DealShadow", additional: true, when: LATE }, { verb: "DealShadow", additional: true, when: MIDNIGHT }] },

  // 50317 Banks of Morthond. While it is the active location each location in the staging area gets -1 Threat. Shadow: if this attack destroys a character, add 1 progress to the current Night objective.
  { id: "50317:constant:1", cardCode: "50317", lines: ["50317:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "threat", amount: -1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
  { id: "50317:shadow:1", cardCode: "50317", lines: ["50317:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "PlaceNightProgress", amount: 1, when: { kind: "x", min: 1 } }] }] },

  // 50318 Vale of Shadows. When Revealed: it becomes the active location, the previous one returning to the staging area with its progress. Dusk +2 quest points, Midnight +4.
  { id: "50318:whenRevealed:1", cardCode: "50318", lines: ["50318:A:1"], timing: "whenRevealed", instructions: [{ verb: "MakeActive", target: "self" }] },
  NIGHT_STATS("50318", "50318:A:2", 2, DUSK, SELF_STAT("questPoints", 2)),
  NIGHT_STATS("50318", "50318:A:3", 3, MIDNIGHT, SELF_STAT("questPoints", 4)),

  // 50319 Blackroot Graves. Forced: when it is explored the topmost Undead enemy of the encounter discard pile is put into play engaged with the first player, not revealed. Shadow: if the defending character has 0 Willpower it takes 2 damage (an undefended attack has none).
  { id: "50319:forced:1", cardCode: "50319", lines: ["50319:A:1"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [{ verb: "ReturnFromDiscard", trait: "Undead", count: 1, to: "engagedFirstPlayer" }] },
  { id: "50319:shadow:1", cardCode: "50319", lines: ["50319:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 2, target: "defender", when: { kind: "matches", card: "defender", pick: A_CHARACTER(0) } }] },

  // 50320 Shadow of Dwimorberg. Dusk +2 Threat, Midnight +4.
  NIGHT_STATS("50320", "50320:A:1", 1, DUSK, SELF_STAT("threat", 2)),
  NIGHT_STATS("50320", "50320:A:2", 2, MIDNIGHT, SELF_STAT("threat", 4)),

  // 50321 Haunted Valley. While it is in the staging area every ready hero loses its Lore, Leadership, Spirit and Tactics icons (an exhausted hero keeps them). Planning Action, any player: he exhausts a hero he controls (the cost of the action, rr.cost).
  { id: "50321:constant:1", cardCode: "50321", lines: ["50321:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "losesIcons", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any", state: "ready" } }] },
  {
    id: "50321:action:1",
    cardCode: "50321",
    lines: ["50321:A:2"],
    timing: "action",
    anyPlayer: true,
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Planning" }, { kind: "canPick", pick: READY_HERO }] },
    instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }],
  },

  // 50322 Midnight Throng. When Revealed: starting with the first player each player searches the encounter deck and discard pile for an Undead enemy, reveals it and adds it to the staging area; the deck is shuffled. At Midnight this effect cannot be canceled. Shadow: +1 Attack (+2, +3).
  { id: "50322:whenRevealed:1", cardCode: "50322", lines: ["50322:A:1", "50322:A:2"], timing: "whenRevealed", uncancelable: MIDNIGHT, instructions: [SEARCH_UNDEAD, { verb: "ShuffleEncounterDeck" }] },
  { id: "50322:shadow:1", cardCode: "50322", lines: ["50322:A:3"], timing: "shadow", instructions: ATTACK_BY_NIGHT(1, 2, 3) },

  // 50323 Murmurs of Dread. When Revealed: all characters get -1 Willpower until the end of the round (a lasting effect: characters that enter play later get it too, faq.lasting-effects); at Midnight it cannot be canceled. Shadow (Dusk or Midnight): an additional attack after this one.
  { id: "50323:whenRevealed:1", cardCode: "50323", lines: ["50323:A:1", "50323:A:3"], timing: "whenRevealed", uncancelable: MIDNIGHT, instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfRound", target: "characters" }] },
  { id: "50323:shadow:1", cardCode: "50323", lines: ["50323:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true, when: LATE }] },

  // 50324 Groping Horror. When Revealed: the first player chooses: skip the next travel phase, or each player passes his hand to the player on his left (the only player discards his hand). Midnight: it gains surge.
  { id: "50324:whenRevealed:1", cardCode: "50324", lines: ["50324:A:1"], timing: "whenRevealed", instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "skipTravel", instructions: [{ verb: "SkipTravelPhase" }] }, { id: "passHands", instructions: [{ verb: "PassHand", direction: "left" }] }] }] },
  NIGHT_STATS("50324", "50324:A:2", 2, MIDNIGHT, SELF_STAT("gainsSurge", 1)),

  // 50325 Driven by Fear. When Revealed: the first player attaches it to a hero he controls. A Condition attachment: the hero's Willpower is 0 (no modifier raises it) and its text box is blank except Traits.
  { id: "50325:whenRevealed:1", cardCode: "50325", lines: ["50325:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "firstPlayer", unlimited: true } }] },
  { id: "50325:constant:1", cardCode: "50325", lines: ["50325:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  {
    id: "50325:constant:2",
    cardCode: "50325",
    lines: ["50325:A:1"],
    timing: "constant",
    condition: { kind: "matches", card: "host", pick: { type: "hero", control: "any" } },
    instructions: [{ verb: "SetStat", stat: "willpower", value: 0, target: "host" }, { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "host" }],
  },

  // 50326 The Dead Ride Behind. When Revealed: 1 damage to each character with less than 2 Willpower (3 at Dusk, 4 at Midnight), every player's characters, by current Willpower.
  {
    id: "50326:whenRevealed:1",
    cardCode: "50326",
    lines: ["50326:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "DamageEach", amount: 1, pick: A_CHARACTER(1), when: NOT_LATE },
      { verb: "DamageEach", amount: 1, pick: A_CHARACTER(2), when: DUSK },
      { verb: "DamageEach", amount: 1, pick: A_CHARACTER(3), when: MIDNIGHT },
    ],
  },

  // 50327 The Gloaming (Surge). When Revealed: 1 progress on the current Night objective.
  { id: "50327:whenRevealed:1", cardCode: "50327", lines: ["50327:A:2"], timing: "whenRevealed", instructions: [{ verb: "PlaceNightProgress", amount: 1 }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
