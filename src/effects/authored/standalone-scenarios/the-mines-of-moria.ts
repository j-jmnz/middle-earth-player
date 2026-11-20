import type { Amount, Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { consideredEngaged } from "../considered-engaged.ts";

// Records for The Mines of Moria (standalone-scenarios cycle part 12, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// The scenario is a kit like The Wizard's Quest and The Woodland Realm (src/effects/authored/standalone-scenarios/the-wizards-quest.ts, the-woodland-realm.ts): the quest card 51201's Setup gives each hero a resource, the Setup builds the Quick-build as the other two kits do (7 of the 14 sets, the first player's stage 2 and stage 3: docs/brief.md, The Mines of Moria, reading 2), and The Watcher lies in the staging area from the deal. "The opposing team" chooses and searches in the manner that gives the players the greatest challenge: the engine's fixed policy, never a prompt (docs/brief.md, The Mines of Moria, readings 1 and 3).
// Rules: rr.search, rr.reveal, rr.cancel, rr.explored, rr.forced, rr.travel, rr.engaged, rr.staging, rr.first-player, rr.guarded, rr.victory, rr.quest-advancement, rr.attachment-cards, rr.blank, rr.surge, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json).
const STAGE_1 = "51201";
const WATCHER = "51210";
const CHAMBER = "51211";
const STAGES_2 = ["51203", "51204", "51205"] as const;
const STAGES_3 = ["51207", "51208", "51209"] as const;
const SETS = Array.from({ length: 14 }, (_, at) => `The Mines of Moria ${1 + at}`);

const EACH_PLAYER = (instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions } as Instruction);
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ENEMY_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const ENEMY_STAGED_OR_ENGAGED: PickSpec = { type: "enemy", control: "any", staging: true };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const MY_HERO: PickSpec = { type: "hero", control: "you" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you" };
const THE_WATCHER: PickSpec = { type: "enemy", control: "any", staging: true, names: ["The Watcher"] };
const CHAMBER_IN_STAGING: PickSpec = { type: "location", control: "any", stagingOnly: true, names: ["Chamber of Mazarbul"] };
const ANY_CHARACTER: PickSpec = { type: "character", control: "any" };
const STAGED_LOCATIONS: PickSpec = { type: "location", control: "any", stagingOnly: true };
// "X is 1 more than the stage number of the main quest" (51211:A:1).
const STAGE_PLUS_1: Amount = { stage: true, plus: 1 };
const KILLED = { kind: "x", min: 1 } as const;
const ATTACKER_IS = (pick: PickSpec): Extract<Condition, { kind: "matches" }> => ({ kind: "matches", card: "attacker", pick });

// "When <location> is explored": the trigger `locationExplored` hears the exploring of a location in the staging area and of the active location (triggerHears), so one record serves both.
const explored = (code: string, line: string, instructions: Instruction[]): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "locationExplored", subject: "self", instructions });
// "The opposing team searches the top 5 cards of the encounter deck for a card with cost N or less (cost M or less instead if there are two or more players) ..." (the A side of every stage 2 and stage 3 card).
const topSearch = (code: string, maxCost: number): Effect => ({ id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "SearchTopReveal", top: 5, maxCost, maxCostMulti: maxCost + 1 }] });
// "When this stage is defeated, the players win the game." (the stage 3 cards).
const wins = (code: string, line: string): Effect => ({ id: `${code}:questResolution:1`, cardCode: code, lines: [line], timing: "questResolution", instructions: [{ verb: "WinGame" }] });
// "This stage cannot be defeated while Chamber of Mazarbul is in play." (51208:B:2, 51209:B:3).
const chamberBars = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", condition: { kind: "inPlay", code: CHAMBER, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] });
// "Shadow: Attacking enemy gets +N Attack (+M Attack instead if <condition>)".
const plusAttack = (amount: number, instead: number, when: Extract<Condition, { kind: "matches" | "canPick" }>): Instruction[] => [
  { verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: when } },
  { verb: "ModifyStat", stat: "attack", amount: instead, until: "endOfAttack", target: "attacker", when },
];
// "Cannot have non-objective player card attachments or take non-combat damage." (51233, 51242: the records of 51012:A:1).
const armoured = (code: string): Effect[] => [
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", condition: { kind: "sourceIn", zone: "play" }, instructions: [{ verb: "Restrict", what: "attach", exceptTrait: "objective player card" }] },
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
];
// "Forced: When <location> is explored, the opposing team searches the encounter deck and discard pile for a Goblin / Spider enemy with cost 1 or less and adds it to the staging area. Shuffle the encounter deck." (51219:A:2, 51252:A:2).
const exploredSearch = (code: string, line: string, trait: string): Effect => explored(code, line, [{ verb: "SearchMove", trait, type: "enemy", maxCost: 1, to: "staging", byChallenge: true }, { verb: "ShuffleEncounterDeck" }]);
// "Shadow: If this attack destroys a character, <instruction>".
const afterKill = (code: string, line: string, extra: Instruction[], instruction: Instruction): Effect => ({ id: `${code}:shadow:1`, cardCode: code, lines: [line], timing: "shadow", instructions: [...extra, { verb: "AfterAttack", instructions: [instruction] } as Instruction] });
const exhaustOne: Instruction[] = [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }];
// "Each player discards 1 random card from his hand." / "Travel: Each player deals 1 damage to a hero he controls."
const discardRandom = (): Instruction => EACH_PLAYER([{ verb: "DiscardRandomFromHand" }]);

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 51201 To the West-door (stage 1). Setup: each hero gains 1 resource (The Watcher lies in the staging area from the deal). Side B: while this stage holds 5 progress The Watcher is considered engaged with each player (it attacks each in turn order with a shadow card for each attack, any character may attack it, it adds no Threat there: rr.engaged, reading 7);
  // it cannot leave the staging area but by its defeat; when it is defeated the one two-sided card turns over and Chamber of Mazarbul enters the staging area (reading 7); the stage cannot be defeated while The Watcher is in play.
  { id: "51201:setup:1", cardCode: STAGE_1, lines: ["51201:A:1"], timing: "setup", instructions: [
      { verb: "BuildQuickDeck", sets: SETS, keep: 7 },
      { verb: "ChooseQuestStage", codes: [...STAGES_2] },
      { verb: "ChooseQuestStage", codes: [...STAGES_3] },
      EACH_PLAYER([{ verb: "HeroesGainResources", amount: 1 }]),
    ],
  },
  { id: "51201:constant:1", cardCode: STAGE_1, lines: ["51201:B:1"], timing: "constant", condition: { kind: "stageProgress", min: 5 }, instructions: consideredEngaged(THE_WATCHER) },
  {
    id: "51201:constant:3",
    cardCode: STAGE_1,
    lines: ["51201:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", holders: THE_WATCHER },
      { verb: "ModifyStat", stat: "leavesStagingWhenDefeated", amount: 1, until: "whileSourceInPlay", holders: THE_WATCHER },
    ],
  },
  { id: "51201:forced:1", cardCode: STAGE_1, lines: ["51201:B:2"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", names: ["The Watcher"] }, instructions: [{ verb: "FlipOver", into: CHAMBER, target: "subject" }] },
  { id: "51201:constant:2", cardCode: STAGE_1, lines: ["51201:B:3"], timing: "constant", condition: { kind: "inPlay", code: WATCHER, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 51203 A Presence in the Dark (stage 2): at the beginning of the staging step the weaker of the top two cards goes to the bottom of the encounter deck, the other stays on top (reading 9).
  topSearch("51203", 1),
  { id: "51203:forced:1", cardCode: "51203", lines: ["51203:B:1"], timing: "forced", trigger: "stagingStepBegins", instructions: [{ verb: "ArrangeTopByChallenge" }] },

  // 51204 The Long Dark of Moria (stage 2): the opposing team finds one different 0 cost location for each player in the deck or discard pile and adds them to the staging area.
  topSearch("51204", 1),
  { id: "51204:whenRevealed:2", cardCode: "51204", lines: ["51204:B:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", maxCost: 0, to: "staging", different: true, byChallenge: true }]), { verb: "ShuffleEncounterDeck" }] },

  // 51205 Narrow Paths (stage 2). The attachment of highest printed cost each player controls lies faceup under the stage (reading 10); no copy of its title can be played or put into play (the bar and the return are the engine's: a held card bars its title while it lies there, and returns to its owner's hand once the stage has left the quest: families/wizards-quest/held.ts).
  topSearch("51205", 1),
  { id: "51205:whenRevealed:2", cardCode: "51205", lines: ["51205:B:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "attachment", control: "you", highestCost: true, challenge: true } }, { verb: "HoldPickedUnder", barsPutting: true }])] },

  // 51207 Drums in the Deep (stage 3): enemies cannot take damage while Chamber of Mazarbul is in the staging area; the opposing team finds an enemy in the deck or discard pile (the highest Threat, then Attack, reading 3); the stage cannot be defeated while an enemy is in play; defeating it wins the game.
  topSearch("51207", 2),
  { id: "51207:constant:1", cardCode: "51207", lines: ["51207:B:1"], timing: "constant", condition: { kind: "canPick", pick: CHAMBER_IN_STAGING }, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: ENEMY_STAGED_OR_ENGAGED }] },
  { id: "51207:whenRevealed:2", cardCode: "51207", lines: ["51207:B:2"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", type: "enemy", to: "staging", byChallenge: true }, { verb: "ShuffleEncounterDeck" }] },
  { id: "51207:constant:2", cardCode: "51207", lines: ["51207:B:3"], timing: "constant", condition: { kind: "canPick", pick: ENEMY_STAGED_OR_ENGAGED }, instructions: [{ verb: "Restrict", what: "advance" }] },
  wins("51207", "51207:B:3"),

  // 51208 The Fate of Balin (stage 3): at the beginning of the staging step the first player chooses either to reveal one more encounter card or that no more than 5 progress can be placed on this stage this phase (reading 12); the stage cannot be defeated while Chamber of Mazarbul is in play.
  topSearch("51208", 2),
  {
    id: "51208:forced:1",
    cardCode: "51208",
    lines: ["51208:B:1"],
    timing: "forced",
    trigger: "stagingStepBegins",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
          { id: "cap", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "endOfPhase", target: "table" }] },
        ],
      },
    ],
  },
  chamberBars("51208", "51208:B:2"),
  wins("51208", "51208:B:2"),

  // 51209 Continuing Eastward (stage 3): each location in the staging area gets +1 Threat and +3 quest points; exploring the active location reveals the top card; the stage cannot be defeated while Chamber of Mazarbul is in play.
  topSearch("51209", 2),
  {
    id: "51209:constant:2",
    cardCode: "51209",
    lines: ["51209:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: STAGED_LOCATIONS },
      { verb: "ModifyStat", stat: "questPoints", amount: 3, until: "whileSourceInPlay", holders: STAGED_LOCATIONS },
    ],
  },
  { id: "51209:forced:1", cardCode: "51209", lines: ["51209:B:2"], timing: "forced", trigger: "activeExplored", instructions: [{ verb: "RevealEncounter" }] },
  chamberBars("51209", "51209:B:3"),
  wins("51209", "51209:B:3"),

  // 51210 The Watcher: cannot be optionally engaged; +2 Threat and +4 hit points for each player.
  { id: "51210:constant:1", cardCode: WATCHER, lines: ["51210:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "51210:constant:2",
    cardCode: WATCHER,
    lines: ["51210:A:3"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: { players: true, times: 2 }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "hitPoints", amount: { players: true, times: 4 }, until: "whileSourceInPlay", target: "self" },
    ],
  },

  // 51211 Chamber of Mazarbul: X (Threat) is 1 more than the stage number; the players cannot travel here before stage 3 (reading 8); Travel: each player discards 1 random card from his hand.
  { id: "51211:constant:1", cardCode: CHAMBER, lines: ["51211:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: STAGE_PLUS_1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51211:constant:2", cardCode: CHAMBER, lines: ["51211:A:3"], timing: "constant", condition: { kind: "not", condition: { kind: "onStage", stage: 3 } }, instructions: [{ verb: "Restrict", what: "travel", location: CHAMBER }] },
  { id: "51211:travel:1", cardCode: CHAMBER, lines: ["51211:A:4"], timing: "travel", instructions: [discardRandom()] },

  // 51212 Savage Werewolf: dealt a shadow card with no effect it makes an additional attack, dealt no shadow card (the records of 18022:A:1). Shadow: the attacker attacks again.
  { id: "51212:forced:1", cardCode: "51212", lines: ["51212:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "ImmediateAttack", shadow: false }] },
  { id: "51212:shadow:1", cardCode: "51212", lines: ["51212:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack" }] }] },

  // 51213 Many-pillared Hall: +1 Threat for each copy in the staging area. Shadow: an attachment of the defender is discarded.
  { id: "51213:constant:1", cardCode: "51213", lines: ["51213:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "location", control: "any", stagingOnly: true, names: ["Many-pillared Hall"] } }, until: "whileSourceInPlay", target: "self" }] },
  { id: "51213:shadow:1", cardCode: "51213", lines: ["51213:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "any", attachedTo: "defender" } }, { verb: "Discard", target: { kind: "picked" } }] },

  // 51214 Shadow of Fear: the opposing team attaches it to the hero with the highest Willpower (reading 3); the hero's text box is blank, its Traits kept (reading 16).
  { id: "51214:whenRevealed:1", cardCode: "51214", lines: ["51214:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", highestWillpower: true, challenge: true } }, { verb: "AttachSelfToPicked" }] },
  { id: "51214:constant:1", cardCode: "51214", lines: ["51214:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "host" }] },

  // 51215 Deep-dweller: each engaged Spider enemy returns to the staging area. Shadow: +1 Attack, +2 for a Spider.
  { id: "51215:whenRevealed:1", cardCode: "51215", lines: ["51215:A:1"], timing: "whenRevealed", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", trait: "Spider", who: "each", pick: "all" } }] },
  { id: "51215:shadow:1", cardCode: "51215", lines: ["51215:A:2"], timing: "shadow", instructions: plusAttack(1, 2, ATTACKER_IS({ type: "enemy", control: "any", trait: "Spider" })) },

  // 51216 Darkened Stairway: while in the staging area it gains a Forced effect after a When Revealed effect is canceled: reveal the top card. Travel: discard the top card; a treachery so discarded resolves its When Revealed effects.
  { id: "51216:forced:1", cardCode: "51216", lines: ["51216:A:1"], timing: "forced", trigger: "whenRevealedCanceled", condition: IN_STAGING, instructions: [{ verb: "RevealEncounter" }] },
  {
    id: "51216:travel:1",
    cardCode: "51216",
    lines: ["51216:A:2"],
    timing: "travel",
    instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "ResolveWhenRevealed", card: "picked", when: { kind: "matches", card: "picked", pick: { type: "treachery", control: "any" }, inPlay: false } }],
  },

  // 51217 We Cannot Get Out: until the end of the phase the staging area adds the most characters any one player controls as Threat. Shadow: assign X damage among your characters, X the enemies engaged with you.
  { id: "51217:whenRevealed:1", cardCode: "51217", lines: ["51217:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseStagingThreat", amount: { mostPerPlayer: { type: "character", control: "you" } }, until: "endOfPhase" }] },
  { id: "51217:shadow:1", cardCode: "51217", lines: ["51217:A:2"], timing: "shadow", instructions: [{ verb: "AssignDamage", amount: { count: ENGAGED_WITH_YOU }, pick: MY_CHARACTER }] },

  // 51218 Spider Broodling: after it engages you, remove 2 progress from the main quest. Shadow: +1 Attack; a destroyed character removes 2 progress from the main quest.
  { id: "51218:forced:1", cardCode: "51218", lines: ["51218:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "RemoveProgressFromQuest", amount: 2 }] },
  afterKill("51218", "51218:A:2", [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }], { verb: "RemoveProgressFromQuest", amount: 2, when: KILLED }),

  // 51219 Spider Burrow: each Spider enemy gets +1 Defense while it is in the staging area; explored, the opposing team finds a Spider enemy with cost 1 or less.
  { id: "51219:constant:1", cardCode: "51219", lines: ["51219:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: { ...ENEMY_STAGED_OR_ENGAGED, trait: "Spider" } }] },
  exploredSearch("51219", "51219:A:2", "Spider"),

  // 51220 Grabbed by Spiders: the first player removes a questing character from the quest for each Spider enemy in play (surge with none). Shadow: the defender cannot ready until the end of the round.
  {
    id: "51220:whenRevealed:1",
    cardCode: "51220",
    lines: ["51220:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "enemyInPlay", trait: "Spider", is: true } } },
      { verb: "Repeat", times: { count: { ...ENEMY_STAGED_OR_ENGAGED, trait: "Spider" } }, instructions: [{ verb: "Pick", pick: { type: "character", control: "any", committed: true, highestWillpower: true, challenge: true } }, { verb: "RemoveFromQuest" }] },
    ],
  },
  { id: "51220:shadow:1", cardCode: "51220", lines: ["51220:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },

  // 51221 Moria Bats: Shadow: it is shuffled into the encounter deck.
  { id: "51221:shadow:1", cardCode: "51221", lines: ["51221:A:2"], timing: "shadow", instructions: [{ verb: "ShuffleSelfIntoEncounterDeck" }] },

  // 51222 Ancient Guardroom: +1 Threat for each resource on it; after an event is played a resource goes on it; Travel: assign X damage among characters in play, X its Threat.
  { id: "51222:constant:1", cardCode: "51222", lines: ["51222:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  { id: "51222:forced:1", cardCode: "51222", lines: ["51222:A:2"], timing: "forced", trigger: "played", subject: { type: "card", control: "any", cardType: "event" }, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },
  { id: "51222:travel:1", cardCode: "51222", lines: ["51222:A:3"], timing: "travel", instructions: [{ verb: "AssignDamage", amount: { stat: "threat", of: "self" }, pick: ANY_CHARACTER }] },

  // 51223 Denizen of the Deep: attached to the non-unique enemy with the highest Attack (then Threat), which returns to the staging area; surge with none (reading 15); the Condition gives the enemy +1 Threat, +1 Attack, +1 Defense and immunity to player card effects.
  {
    id: "51223:whenRevealed:1",
    cardCode: "51223",
    lines: ["51223:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { ...ENEMY_STAGED_OR_ENGAGED, nonUnique: true, highestAttack: true, challenge: true } },
      { verb: "AttachSelfToPicked" },
      { verb: "ReturnToStaging", target: { kind: "picked" } },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { ...ENEMY_STAGED_OR_ENGAGED, nonUnique: true } } } },
    ],
  },
  {
    id: "51223:constant:1",
    cardCode: "51223",
    lines: ["51223:A:1"],
    timing: "constant",
    instructions: [
      { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "host" },
    ],
  },

  // 51224 Werewolf: -10 engagement cost while there is an active location.
  { id: "51224:constant:1", cardCode: "51224", lines: ["51224:A:1"], timing: "constant", condition: { kind: "canPick", pick: { type: "location", control: "any", active: true } }, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", target: "self" }] },

  // 51225 Fouled Well: while in the staging area no player card effect readies a character. Travel: each player exhausts a character.
  { id: "51225:constant:1", cardCode: "51225", lines: ["51225:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "whileSourceInPlay", holders: ANY_CHARACTER }] },
  { id: "51225:travel:1", cardCode: "51225", lines: ["51225:A:2"], timing: "travel", instructions: [EACH_PLAYER(exhaustOne)] },

  // 51226 Cave In: the active location returns to the staging area and each player assigns X damage among his characters, X its Threat; surge when none returned. Shadow: a destroyed character returns the active location to the staging area.
  {
    id: "51226:whenRevealed:1",
    cardCode: "51226",
    lines: ["51226:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "location", control: "any", active: true } },
      { verb: "ReturnToStaging", target: { kind: "activeLocation" } },
      { verb: "AssignDamage", amount: { stat: "threat", of: "picked" }, pick: MY_CHARACTER, who: "eachSeat" },
      { verb: "GainSurge", when: { kind: "noneReturned" } },
    ],
  },
  afterKill("51226", "51226:A:2", [], { verb: "ReturnToStaging", target: { kind: "activeLocation" }, when: KILLED }),

  // 51227 Hive Guardian: after it destroys an ally it returns to the staging area.
  { id: "51227:forced:1", cardCode: "51227", lines: ["51227:A:1"], timing: "forced", trigger: "characterDestroyedByAttack", subject: { type: "ally", control: "any" }, condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } }, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] },

  // 51228 Abandoned Mines: no progress can be placed on it while it is in the staging area. Shadow: an attacker that was engaged this round cannot take damage this phase.
  { id: "51228:constant:1", cardCode: "51228", lines: ["51228:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51228:shadow:1", cardCode: "51228", lines: ["51228:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfPhase", target: "attacker", when: ATTACKER_IS({ type: "enemy", control: "any", engagedThisRound: true }) }] },

  // 51229 Sudden Pitfall: the opposing team discards the ally of highest printed cost in play (surge with none). Shadow: either discard an ally you control or the attacker cannot take damage this phase.
  {
    id: "51229:whenRevealed:1",
    cardCode: "51229",
    lines: ["51229:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { type: "ally", control: "any" } } } },
      { verb: "Pick", pick: { type: "ally", control: "any", highestCost: true, challenge: true } },
      { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "ally", control: "any" } } },
    ],
  },
  {
    id: "51229:shadow:1",
    cardCode: "51229",
    lines: ["51229:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "ally", requires: { kind: "canPick", pick: { type: "ally", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },
          { id: "damage", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfPhase", target: "attacker" }] },
        ],
      },
    ],
  },

  // 51230 Web-spinner: the first player chooses either that no more than 4 progress can be placed on the current quest this phase or that the card gains surge. Shadow: a destroyed character returns the attacker to the staging area.
  {
    id: "51230:whenRevealed:1",
    cardCode: "51230",
    lines: ["51230:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "cap", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 4, until: "endOfPhase", target: "table" }] },
          { id: "surge", instructions: [{ verb: "GainSurge" }] },
        ],
      },
    ],
  },
  afterKill("51230", "51230:A:2", [], { verb: "ReturnToStaging", target: { kind: "self" }, when: KILLED }),

  // 51231 Cobwebbed Cavern: Travel and Shadow: remove 2 progress from the main quest.
  { id: "51231:travel:1", cardCode: "51231", lines: ["51231:A:1"], timing: "travel", instructions: [{ verb: "RemoveProgressFromQuest", amount: 2 }] },
  { id: "51231:shadow:1", cardCode: "51231", lines: ["51231:A:2"], timing: "shadow", instructions: [{ verb: "RemoveProgressFromQuest", amount: 2 }] },

  // 51232 Foul Air: the first player chooses either 1 damage to each character committed to the quest, or each player raises his threat by 1 and the quest phase ends without resolving the quest. Shadow: 1 damage to the defender.
  {
    id: "51232:whenRevealed:1",
    cardCode: "51232",
    lines: ["51232:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "damage", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", committed: true } }] },
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }, { verb: "EndQuestPhase" }] },
        ],
      },
    ],
  },
  { id: "51232:shadow:1", cardCode: "51232", lines: ["51232:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

  // 51233 Brood Mother: no non-objective player card attachments, no non-combat damage; while in the staging area no more than 5 progress can be placed on the main quest each round.
  ...armoured("51233"),
  { id: "51233:constant:3", cardCode: "51233", lines: ["51233:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "whileSourceInPlay", target: "table" }] },

  // 51234 Lightless Passage: while in the staging area no more than 1 progress goes on each location there each round. Travel: each player discards 1 random card from his hand.
  { id: "51234:constant:1", cardCode: "51234", lines: ["51234:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "progressCap", amount: 1, until: "whileSourceInPlay", holders: STAGED_LOCATIONS }] },
  { id: "51234:travel:1", cardCode: "51234", lines: ["51234:A:2"], timing: "travel", instructions: [discardRandom()] },

  // 51235 Lurking Malice: each hero's resources are discarded and the staging area adds 1 Threat for each (surge with none). Shadow: a resource of a hero you control is discarded.
  {
    id: "51235:whenRevealed:1",
    cardCode: "51235",
    lines: ["51235:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "less", left: { resourcesOn: { type: "hero", control: "any" } }, right: 1 } },
      { verb: "RaiseStagingThreat", amount: { resourcesOn: { type: "hero", control: "any" } }, until: "endOfPhase" },
      { verb: "Each", pick: { type: "hero", control: "any" }, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] },
    ],
  },
  { id: "51235:shadow:1", cardCode: "51235", lines: ["51235:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", hasResources: true } }, { verb: "DiscardResources", amount: 1, target: "picked" }] },

  // 51236 Great Cave-troll: while in the staging area it gains a Forced effect at the end of the encounter phase: raise each player's threat by 2.
  { id: "51236:forced:1", cardCode: "51236", lines: ["51236:A:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [IN_STAGING, { kind: "phase", is: "Encounter" }] }, instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

  // 51237 Zigil Mineshaft: Quest Action: the first player raises each player's threat by 1 to lower this location's Threat by 1 until the end of the phase (reading 17).
  { id: "51237:action:1", cardCode: "51237", lines: ["51237:A:1"], timing: "action", condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "firstPlayer" }] }, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }, { verb: "ModifyStat", stat: "threat", amount: -1, until: "endOfPhase", target: "self" }] },

  // 51238 Dark and Dreadful: each player discards 1 random card from his hand; until the end of the phase the staging area adds the total printed cost of the discarded cards as Threat. Shadow: discard 1 random card from your hand.
  { id: "51238:whenRevealed:1", cardCode: "51238", lines: ["51238:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardRandomFromHand", who: "eachSeat", raiseStagingByCost: true }] },
  { id: "51238:shadow:1", cardCode: "51238", lines: ["51238:A:2"], timing: "shadow", instructions: [{ verb: "DiscardRandomFromHand" }] },

  // 51239 Goblin Follower: cannot be optionally engaged; while in the staging area it gains a Forced effect: after an enemy engages a player, it engages that player (the records of 18021:A:1 and 18021:A:2).
  { id: "51239:constant:1", cardCode: "51239", lines: ["51239:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51239:forced:1", cardCode: "51239", lines: ["51239:A:2"], timing: "forced", trigger: "engaged", subject: { type: "enemy", control: "any", other: true }, condition: IN_STAGING, instructions: [{ verb: "Engage", target: "self" }] },

  // 51240 Stairs of Náin: while in the staging area the first treachery revealed each round gains surge and its When Revealed effects cannot be canceled (reading 13). Explored: raise each player's threat by 4.
  { id: "51240:constant:1", cardCode: "51240", lines: ["51240:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "UncancelableWhenRevealed", firstRevealedEachRound: true, surge: true }] },
  explored("51240", "51240:A:2", [{ verb: "RaiseThreat", amount: 4, who: "eachSeat" }]),

  // 51241 Hidden Threat: the opposing team lays the card of cost at most the stage number nearest the top of the top 5 facedown under the main quest; it is revealed after the next successful quest (reading 11).
  { id: "51241:whenRevealed:1", cardCode: "51241", lines: ["51241:A:1"], timing: "whenRevealed", instructions: [{ verb: "HideUnderQuest", top: 5, maxCostStage: true }] },

  // 51242 Goblin Warlord: no non-objective player card attachments, no non-combat damage; after it enters play the opposing team finds a 0 cost Goblin enemy in the deck or discard pile and adds it to the staging area.
  ...armoured("51242"),
  { id: "51242:forced:1", cardCode: "51242", lines: ["51242:A:2"], timing: "forced", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "SearchMove", trait: "Goblin", type: "enemy", maxCost: 0, to: "staging", byChallenge: true }, { verb: "ShuffleEncounterDeck" }] },

  // 51243 Dwarven Forge: while it is the active location it gains a Response after it is explored: each player draws 1 card.
  { id: "51243:response:1", cardCode: "51243", lines: ["51243:A:1"], timing: "response", trigger: "activeExplored", subject: "self", instructions: [EACH_PLAYER([{ verb: "Draw", amount: 1 }])] },

  // 51244 Signs of Conflict: each enemy and location in the staging area gets +1 Threat until the end of the phase. Shadow: +1 Attack, +2 when you are engaged with another enemy.
  {
    id: "51244:whenRevealed:1",
    cardCode: "51244",
    lines: ["51244:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: ENEMY_IN_STAGING },
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: STAGED_LOCATIONS },
    ],
  },
  { id: "51244:shadow:1", cardCode: "51244", lines: ["51244:A:2"], timing: "shadow", instructions: plusAttack(1, 2, { kind: "canPick", pick: { ...ENGAGED_WITH_YOU, attackingEnemy: false } }) },

  // 51245 Goblin Archer: while in the staging area it gains a Forced effect at the end of the encounter phase: assign X damage among characters in play, X the enemies in play.
  { id: "51245:forced:1", cardCode: "51245", lines: ["51245:A:1"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [IN_STAGING, { kind: "phase", is: "Encounter" }] }, instructions: [{ verb: "AssignDamage", amount: { count: ENEMY_STAGED_OR_ENGAGED }, pick: ANY_CHARACTER }] },

  // 51246 Narrow Fissure: while in the staging area no player card effect heals a character. Travel: each player deals 1 damage to a hero he controls.
  { id: "51246:constant:1", cardCode: "51246", lines: ["51246:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "whileSourceInPlay", holders: ANY_CHARACTER }] },
  { id: "51246:travel:1", cardCode: "51246", lines: ["51246:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "Pick", pick: MY_HERO }, { verb: "DamageCard", amount: 1, target: "picked" }])] },

  // 51247 Crumbling Ruin: each player assigns X damage among his characters, X the characters he controls. Shadow: exhaust a character you control.
  { id: "51247:whenRevealed:1", cardCode: "51247", lines: ["51247:A:1"], timing: "whenRevealed", instructions: [{ verb: "AssignDamage", amount: { count: MY_CHARACTER }, pick: MY_CHARACTER, who: "eachSeat" }] },
  { id: "51247:shadow:1", cardCode: "51247", lines: ["51247:A:2"], timing: "shadow", instructions: exhaustOne },

  // 51248 Goblin Sneak: the opposing team finds a Goblin enemy with cost 1 or less among the top 5 cards and adds it to the staging area (the deck is shuffled, reading 14).
  { id: "51248:whenRevealed:1", cardCode: "51248", lines: ["51248:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", trait: "Goblin", type: "enemy", maxCost: 1, top: 5, to: "staging", byChallenge: true }, { verb: "ShuffleEncounterDeck" }] },

  // 51249 Plundered Armoury: the top card of the encounter deck is discarded; an enemy so discarded is added to the staging area.
  { id: "51249:whenRevealed:1", cardCode: "51249", lines: ["51249:A:1"], timing: "whenRevealed", instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" } } }] },

  // 51250 They Are Coming!: the opposing team finds one different 0 cost enemy for each player. Shadow: the opposing team shuffles the enemy of the encounter discard pile with the highest Threat into the encounter deck.
  { id: "51250:whenRevealed:1", cardCode: "51250", lines: ["51250:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", maxCost: 0, to: "staging", different: true, byChallenge: true }]), { verb: "ShuffleEncounterDeck" }] },
  { id: "51250:shadow:1", cardCode: "51250", lines: ["51250:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", from: "encounterDiscard", highestThreat: true, challenge: true } }, { verb: "MoveEncounterCard", card: "picked", to: "shuffle" }] },

  // 51251 Swarming Goblins: each copy in the encounter discard pile returns to the staging area. Shadow: with a Goblin attacker it enters play engaged with you.
  { id: "51251:whenRevealed:1", cardCode: "51251", lines: ["51251:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", code: "51251", discardOnly: true, each: true, to: "staging" }] },
  { id: "51251:shadow:1", cardCode: "51251", lines: ["51251:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "engaged", when: ATTACKER_IS({ type: "enemy", control: "any", trait: "Goblin" }) }] },

  // 51252 Goblin Tunnels: each Goblin enemy gets +1 Attack while it is in the staging area; explored, the opposing team finds a Goblin enemy with cost 1 or less.
  { id: "51252:constant:1", cardCode: "51252", lines: ["51252:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { ...ENEMY_STAGED_OR_ENGAGED, trait: "Goblin" } }] },
  exploredSearch("51252", "51252:A:2", "Goblin"),

  // 51253 Massing in the Deep: each engaged enemy makes an attack (surge when none did). Shadow: each enemy engaged with you gets +1 Attack.
  { id: "51253:whenRevealed:1", cardCode: "51253", lines: ["51253:A:1"], timing: "whenRevealed", instructions: [{ verb: "ImmediateAttackEach" }, { verb: "GainSurge", when: { kind: "noneReturned" } }] },
  { id: "51253:shadow:1", cardCode: "51253", lines: ["51253:A:2"], timing: "shadow", instructions: [{ verb: "Each", pick: ENGAGED_WITH_YOU, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfPhase", target: "picked" }] }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
