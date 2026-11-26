import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { copyLines, withCopies } from "../reprint.ts";
import { AUTHORED_EFFECTS as TROUBLE } from "./trouble-in-tharbad.ts";

// Records for The Nîn-in-Eilph (the-ring-maker cycle part 7, no campaign card): the eight quest stages (the stages 2 and 3 are played in a random order and come back to the quest deck, Time X), Nalir, the Ancient Marsh-dweller that attacks as the counters come off, and the encounter cards no
// template reads. Every line is read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. Time X is the angmar family's; the trigger `timeCountersRemoved`, the table flags
// `cannotGainResourcesByPlayerCard`, `cannotDrawByPlayerCard` and `commitDiscardsRandom` are in src/catalog/families/ring-maker.ts; `AdvanceToRandomStage` (wilderland family) names the stage's own set with `onDefeat` and a set of its own without it.
// Rules: rm.time-x, rm.parallel-stages, rr.cannot, rr.effects, rr.player-deck, rr.immune, rr.forced, rr.quest-cards-quest-deck, rr.reveal, rr.search, rr.setup, rr.first-player, rr.ownership-and-control, rr.staging, rr.engaged, rr.in-play-and-out-of-play, rr.in-player-order, rr.defending-player,
// rr.shadow-effects, rr.play-and-put-into-play, rr.explored, rr.travel, rr.current-quest, rr.modifiers, rr.destroy, rr.cancel (data/rules/entries.json).
const STAGE_1 = "08094";
const STAGE_2: readonly string[] = ["08095", "08096", "08097"];
const STAGE_3: readonly string[] = ["08098", "08099", "08100"];
const STAGE_4 = "08101";
const NALIR = "08102";
const MARSH_DWELLER = "08103";
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const SELF_ENGAGED: Condition = { kind: "sourceIn", zone: "engaged" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const MARSH: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Ancient Marsh-dweller"] };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const OWN_ALLY: PickSpec = { type: "ally", control: "you" };
// "Each location in play": the active location and every location in the staging area.
const LOCATION_IN_PLAY: PickSpec = { type: "location", control: "any", staging: true };
const ENGAGED_WITH_ACTOR: Condition = { kind: "engagedWithActor" };
const HAS_OWN_ALLY: Condition = { kind: "all", conditions: [ENGAGED_WITH_ACTOR, { kind: "canPick", pick: OWN_ALLY }] };
const HAS_READY_CHARACTER: Condition = { kind: "canPick", pick: READY_CHARACTER };
// "Add Ancient Marsh-dweller to the staging area (from out of play or engaged with a player) and heal all damage from it" (08098:A:1 to 08101:A:1): the copy out of play (set aside, in the victory display or in the encounter discard pile) joins the staging area, a copy engaged with a player returns to it, and its damage (not its resource tokens) is healed.
const MARSH_TO_STAGING: Instruction[] = [
  { verb: "AddSetAsideToStaging", code: MARSH_DWELLER, outOfPlay: true },
  { verb: "Pick", pick: MARSH },
  { verb: "ReturnToStaging", target: { kind: "picked" } },
  { verb: "Heal", all: true, target: "picked" },
];
// "Ancient Marsh-dweller makes an attack against each player in player order" (08101:A:1, B:2): an attack outside the combat phase on each player, the first player first, wherever the enemy is (staged or engaged); it does not move (agent recommendation, scenario file).
const MARSH_ATTACKS: Instruction[] = [{ verb: "Pick", pick: MARSH }, EACH_PLAYER([{ verb: "AttackFromStaging", orEngaged: true }])];

// The three stages 2 print the same When Revealed, Time, last-counter and defeat lines; each has its own third line (B:3).
const stageTwo = (code: string, bar: Instruction[]): Effect[] => [
  { id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:B:1`], timing: "constant", instructions: [{ verb: "Time", amount: 3 }] },
  { id: `${code}:forced:1`, cardCode: code, lines: [`${code}:B:2`], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [{ verb: "AdvanceToRandomStage", codes: [...STAGE_2], different: true }] },
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:B:3`], timing: "constant", instructions: bar },
  { id: `${code}:forced:2`, cardCode: code, lines: [`${code}:B:4`], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "AdvanceToRandomStage", codes: [...STAGE_3], onDefeat: true }] },
];

// The three stages 3 print the same When Revealed, Time and last-counter lines (the defeat of a stage 3 goes on to stage 4: the quest's order skips the stages 3 that are alternatives).
const stageThree = (code: string): Effect[] => [
  { id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }, ...MARSH_TO_STAGING] },
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:B:1`], timing: "constant", instructions: [{ verb: "Time", amount: 3 }] },
  { id: `${code}:forced:1`, cardCode: code, lines: [`${code}:B:2`], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [{ verb: "AdvanceToRandomStage", codes: [...STAGE_3], different: true }] },
];

// "After any number of time counters are removed from the current quest" on a card in play (the Marsh-dweller, an engaged enemy).
const afterTimeRemoved = (id: string, code: string, line: string, instructions: Instruction[], condition?: Condition): Effect => ({ id, cardCode: code, lines: [line], timing: "forced", trigger: "timeCountersRemoved", ...(condition ? { condition } : {}), instructions });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 08094 Fleeing from Tharbad (stage 1). Setup: the first player controls Nalir, the Ancient Marsh-dweller lies aside (the pile), each player searches for a different location and adds it to the staging area, the deck is shuffled. B: the quest advances to a random stage 2A.
    { id: "08094:setup:1", cardCode: STAGE_1, lines: ["08094:A:1"], timing: "setup", instructions: [{ verb: "TakeControlOfSetAside", code: NALIR }, EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging", different: true }]), { verb: "ShuffleEncounterDeck" }] },
    { id: "08094:whenRevealed:1", cardCode: STAGE_1, lines: ["08094:B:1"], timing: "whenRevealed", instructions: [{ verb: "AdvanceToRandomStage", codes: [...STAGE_2] }] },

    // 08095 to 08097 Through the Marsh (stages 2). Time 3; after the last counter the quest advances to a different stage 2A and this stage returns to the quest deck; when the players defeat it, to a random stage 3A. B:3: no player card effect gains resources or draws; a player
    // discards a card at random from his hand to commit characters; each player plays at most 1 card each round.
    ...stageTwo("08095", [
      { verb: "ModifyStat", stat: "cannotGainResourcesByPlayerCard", amount: 1, until: "whileSourceInPlay", target: "table" },
      { verb: "ModifyStat", stat: "cannotDrawByPlayerCard", amount: 1, until: "whileSourceInPlay", target: "table" },
    ]),
    ...stageTwo("08096", [{ verb: "ModifyStat", stat: "commitDiscardsRandom", amount: 1, until: "whileSourceInPlay", target: "table" }]),
    ...stageTwo("08097", [{ verb: "LimitPlaysPerRound", max: 1 }]),

    // 08098 to 08100 Lost in the Swanfleet (stages 3). Raise each player's threat by 1 and bring the Marsh-dweller to the staging area, healed. Time 3; after the last counter a different stage 3A. B:3: +1 Threat on each location in play; at most 5 characters ready in the refresh
    // phase; -20 engagement cost on each enemy in the staging area.
    ...stageThree("08098"),
    { id: "08098:constant:2", cardCode: "08098", lines: ["08098:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: LOCATION_IN_PLAY }] },
    ...stageThree("08099"),
    { id: "08099:forced:2", cardCode: "08099", lines: ["08099:B:3"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Refresh" }, instructions: [EACH_PLAYER([{ verb: "CapRefresh", amount: 5 }])] },
    ...stageThree("08100"),
    { id: "08100:constant:2", cardCode: "08100", lines: ["08100:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -20, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } }] },

    // 08101 Out of the Swamp (stage 4). The Marsh-dweller joins the staging area, healed, and attacks each player in player order. Time 2; after the last counter it attacks each player again and 2 time counters go back on the stage. Its defeat wins the game.
    { id: "08101:whenRevealed:1", cardCode: STAGE_4, lines: ["08101:A:1"], timing: "whenRevealed", instructions: [...MARSH_TO_STAGING, ...MARSH_ATTACKS] },
    { id: "08101:constant:1", cardCode: STAGE_4, lines: ["08101:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 2 }] },
    { id: "08101:forced:1", cardCode: STAGE_4, lines: ["08101:B:2"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [...MARSH_ATTACKS, { verb: "PlaceResourceTokens", amount: 2, on: "self" }] },
    { id: "08101:triggered:1", cardCode: STAGE_4, lines: ["08101:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: MARSH, instructions: [{ verb: "WinGame" }] },

    // 08102 Nalir (objective ally): as in Trouble in Tharbad, the first player controls him as the first player token passes and raises his threat by the players at the beginning of the refresh phase (the build writes the loss when he leaves play).
    copyLines("08068", NALIR, "A:1", "A:2"),

    // 08103 Ancient Marsh-dweller. +1 Threat and +1 Attack for each resource token on it; after a removal of time counters from the current quest a token goes on it (wherever it is: staged or engaged).
    { id: "08103:constant:2", cardCode: MARSH_DWELLER, lines: ["08103:A:2"], timing: "constant", instructions: (["threat", "attack"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" })) },
    afterTimeRemoved("08103:forced:1", MARSH_DWELLER, "08103:A:3", [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }]),

    // 08104 Giant Swamp Adder. Engaged, it attacks the player it is engaged with after a removal of time counters (the loop reaches that player whoever acts first); staged it does nothing.
    afterTimeRemoved("08104:forced:1", "08104", "08104:A:2", [EACH_PLAYER([{ verb: "AttackActor", when: ENGAGED_WITH_ACTOR }])], SELF_ENGAGED),

    // 08105 Neekerbreekers. Engaged, the player it is engaged with deals 2 damage to one ally he controls (once, not for each player) after a removal of time counters (none to deal it to: nothing). Shadow: 1 damage to the defending character.
    afterTimeRemoved("08105:forced:1", "08105", "08105:A:1", [EACH_PLAYER([{ verb: "Pick", pick: OWN_ALLY, when: HAS_OWN_ALLY }, { verb: "DamageCard", amount: 2, target: "picked", when: HAS_OWN_ALLY }])], SELF_ENGAGED),
    { id: "08105:shadow:1", cardCode: "08105", lines: ["08105:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

    // 08106 Fen of Reeds. In the staging area it holds a Forced effect: after the players advance to a quest stage each player exhausts a character he controls (one with none ready exhausts none). Shadow: +1 Attack for each time counter on the quest.
    {
      id: "08106:forced:1",
      cardCode: "08106",
      lines: ["08106:A:1"],
      timing: "forced",
      trigger: "afterStageRevealed",
      condition: IN_STAGING,
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: READY_CHARACTER, when: HAS_READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" }, when: HAS_READY_CHARACTER }])],
    },
    { id: "08106:shadow:1", cardCode: "08106", lines: ["08106:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "questStage" }, until: "endOfAttack", target: "attacker" }] },

    // 08107 Finger of Glanduin. In the staging area it holds a Forced effect: at the end of each round 1 progress comes off each location in play. Shadow: an attack that destroys a character takes all progress off the current quest.
    { id: "08107:forced:1", cardCode: "08107", lines: ["08107:A:1"], timing: "forced", trigger: "endOfRound", condition: IN_STAGING, instructions: [{ verb: "RemoveProgressEach", amount: 1, pick: LOCATION_IN_PLAY }] },
    { id: "08107:shadow:1", cardCode: "08107", lines: ["08107:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RemoveAllQuestProgress", when: { kind: "x", min: 1 } }] }] },

    // 08108 Hidden Eyot. Response: after it leaves play explored, 2 time counters go on the current quest (a stage with none takes them too). Travel: each player exhausts a character he controls.
    { id: "08108:response:1", cardCode: "08108", lines: ["08108:A:1"], timing: "response", trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" }, instructions: [{ verb: "PlaceResourceTokens", amount: 2, on: "questStage" }] },
    { id: "08108:travel:1", cardCode: "08108", lines: ["08108:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }])] },

    // 08109 Sinking Bog. In the staging area each character gets -1 Willpower, -1 Attack and -1 Defense for each Item attached to it (copies do not stack). Shadow: the defending character gets -1 Defense for the attack for each attachment on it.
    {
      id: "08109:constant:1",
      cardCode: "08109",
      lines: ["08109:A:1"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: (["willpower", "attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: -1, until: "whileSourceInPlay", holders: { type: "character", control: "any" }, eachAttached: { type: "attachment", control: "any", trait: "Item" }, doesNotStack: true })),
    },
    { id: "08109:shadow:1", cardCode: "08109", lines: ["08109:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { stat: "attachments", of: "defender" }, subtract: true, until: "endOfAttack", target: "defender" }] },

    // 08110 Shifting Marshland. When Revealed: a time counter comes off the current quest.
    { id: "08110:whenRevealed:1", cardCode: "08110", lines: ["08110:A:2"], timing: "whenRevealed", instructions: [{ verb: "RemoveTimeFromQuest", amount: 1 }] },

    // 08111 Remnants of Elder Days. Each player searches the encounter deck and discard pile for a Creature enemy and puts it into play engaged with him; the deck is shuffled; the effect cannot be canceled.
    {
      id: "08111:whenRevealed:1",
      cardCode: "08111",
      lines: ["08111:A:1"],
      timing: "whenRevealed",
      uncancelable: IN_STAGING,
      instructions: [EACH_PLAYER([{ verb: "SearchMove", trait: "Creature", type: "enemy", to: "engaged" }]), { verb: "ShuffleEncounterDeck" }],
    },
  ],
  { pool: TROUBLE },
);

export const AUTHORED_REPLACES: readonly string[] = [];
