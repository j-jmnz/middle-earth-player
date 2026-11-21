import type { Amount, Condition, Effect, Instruction, PickSpec, SimpleInstruction } from "../../../catalog/boundary.ts";

type AmountOfCity = Exclude<Amount, number>;

// Records for Attack on Dol Guldur (standalone-scenarios cycle part 9, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. Played in the Standard Game Mode only (docs/brief.md, Attack on Dol Guldur, reading 1): "each stage", "each team" and "at this stage" read as the one table. The mode card 50931 is the scenario's
// `modeCard`: its front Setup runs with the quest card's, then it is flipped and its back works all game. City strength is the resource tokens on Dol Guldur (reading 3); the Siege values of the enemies destroyed and the locations
// explored are added to a round tally as they happen (reading 4) and Dol Guldur's Forced effect takes the tally off at the end of the round. At the end of the round at stage 3 the stage's Forced effect (`early`) resolves first, then Dol Guldur's,
// then the mode card's win check and last its random stage (reading 5).
// Rules: rr.forced, rr.response, rr.then, rr.travel, rr.first-player, rr.victory, rr.the-word-choose, rr.engaged, rr.destroy, rr.explored, rr.in-play-and-out-of-play, rr.cancel, rr.damage, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json).
const MODE = "50931";
const DOL_GULDUR = "50907";
const POWER = "50908";
const HOST_LORIEN = "50909";
const STAGE_1 = "50901";
const STAGE_2 = "50902";
const STAGES_3 = ["50903", "50904", "50905", "50906"] as const;
const LIEUTENANTS = [
  { stage: "50903", code: "50910", name: "Bane of Amon Lanc", letter: "B" },
  { stage: "50904", code: "50911", name: "Sorcerer of Dol Guldur", letter: "D" },
  { stage: "50905", code: "50912", name: "Chieftain Morlug", letter: "F" },
  { stage: "50906", code: "50913", name: "Dungeon Dweller", letter: "H" },
] as const;

const EACH_PLAYER = (instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions } as Instruction);
const SOME_PROGRESS: Condition = { kind: "stageProgress", min: 1 };
const FIVE_PROGRESS: Condition = { kind: "stageProgress", min: 5 };
// "While the players are at stage 3": the quest stage's number is 3 or more (the stage 3s are the quest deck's third to sixth).
const AT_STAGE_3: Condition = { kind: "less", left: 2, right: { stage: true } };
// "If Dol Guldur's city strength is 5 or lower" and "is 0".
const CITY: AmountOfCity = { resourcesOn: { type: "objective", control: "any", names: ["Dol Guldur"] } };
const CITY_AT_MOST_5: Condition = { kind: "less", left: CITY, right: 6 };
const CITY_AT_0: Condition = { kind: "less", left: CITY, right: 1 };
const POWER_PICK: PickSpec = { type: "objective", control: "any", names: ["Power of Lórien"] };
const ALLY_YOU: PickSpec = { type: "ally", control: "you" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const ENEMY_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
// "either remove N progress from the main quest, or <other>" (reading 15): an option nobody can do is not offered.
type Option = Extract<Instruction, { verb: "Choose" }>["options"][number];
const progressOption = (amount: number): Option => ({ id: "progress", requires: SOME_PROGRESS, instructions: [{ verb: "RemoveProgressFromQuest", amount }] });
// "After <enemy> attacks and destroys a character" (50915:A:1).
const destroysCharacter = (code: string, line: string, instructions: Instruction[]): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "characterDestroyedByAttack",
  subject: { type: "character", control: "any" },
  condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } },
  instructions,
});
// "After <enemy> engages you, either remove N progress from the main quest or ..." (50917, 50919): the engaged player chooses.
const engagesYou = (code: string, line: string, options: Option[]): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "engaged",
  subject: "self",
  instructions: [{ verb: "Choose", who: "actor", options }],
});
// "When <enemy> attacks, either remove N progress from the main quest or ..." (50916, 50918): nobody is named, so the first player chooses (reading 15).
const attacksChoice = (code: string, line: string, options: Option[]): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "attacks",
  subject: "self",
  instructions: [{ verb: "Choose", who: "firstPlayer", options }],
});
// "The players cannot travel or place progress here unless they are at stage 3B (3D, 3F, 3H)" while the location is in the staging area (reading 12): the card gains the line only there.
const gate = (code: string, line: string, stage: string): Effect => ({
  id: `${code}:constant:1`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "inPlay", code: stage, is: false }] },
  instructions: [{ verb: "Restrict", what: "travel" }, { verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }],
});

// The stage 3 penalties of the Forced lines 50903:B:2 to 50906:B:2 (reading 8): `when` says when they apply, the option taken by the first player or the stage picked at random (50931:B:2, reading 6).
const penalty = (stage: (typeof STAGES_3)[number], applies: Extract<Condition, { kind: "optionTaken" }>): Instruction[] => {
  const when = (extra?: Extract<Condition, { kind: "matches" | "canPick" }>): { when: Condition } => ({ when: extra ? { kind: "all", conditions: [applies, extra] } : applies });
  switch (stage) {
    // 50903:B:2: Dol Guldur's city strength goes up by 3.
    case "50903":
      return [{ verb: "PlaceResourceTokens", amount: 3, code: DOL_GULDUR, ...when() }];
    // 50904:B:2: each player discards all but 1 card from his hand.
    case "50904":
      return [EACH_PLAYER([{ verb: "Each", pick: { type: "card", control: "you", from: "hand" }, upTo: 1, instructions: [], rest: [{ verb: "Discard", target: { kind: "picked" } }], ...when() }])];
    // 50905:B:2: each player discards cards from the top of the encounter deck until an enemy is discarded and puts it into play engaged with him; the discard pile goes back into the deck when the last card is discarded.
    case "50905":
      return [EACH_PLAYER([{ verb: "DiscardUntil", type: "enemy", reshuffle: true, ...when() }, { verb: "MoveEncounterCard", card: "picked", to: "engaged", ...when({ kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false }) }])];
    // 50906:B:2: each player discards an ally he controls.
    case "50906":
      return [EACH_PLAYER([{ verb: "Pick", pick: ALLY_YOU, ...when() }, { verb: "Discard", target: { kind: "picked" }, ...when({ kind: "canPick", pick: ALLY_YOU }) }])];
  }
};
// The "additional 5 progress" steps (reading 8), chosen by the first player: only after the first 5 came off, and only while 5 more are on the stage.
const FIRST_PLAYER_PICKS_PLAYER: SimpleInstruction = { verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } };
const extra = (stage: (typeof STAGES_3)[number]): { requires: Condition; instructions: SimpleInstruction[] } => {
  switch (stage) {
    case "50903":
      return { requires: FIVE_PROGRESS, instructions: [{ verb: "RemoveProgressFromQuest", amount: 5 }, { verb: "RemoveResourceTokens", amount: 3, code: DOL_GULDUR }] };
    case "50904":
      return {
        requires: FIVE_PROGRESS,
        instructions: [{ verb: "RemoveProgressFromQuest", amount: 5 }, FIRST_PLAYER_PICKS_PLAYER, { verb: "ActAs", who: "pickedPlayer" }, { verb: "Pick", pick: { type: "card", control: "you", from: "deck" } }, { verb: "MovePicked", to: "hand" }, { verb: "ShuffleDeck" }],
      };
    case "50905": {
      const enemy: PickSpec = { type: "enemy", control: "any", staging: true, nonUnique: true, who: "firstPlayer" };
      return { requires: { kind: "all", conditions: [FIVE_PROGRESS, { kind: "canPick", pick: enemy }] }, instructions: [{ verb: "RemoveProgressFromQuest", amount: 5 }, { verb: "Pick", pick: enemy }, { verb: "Destroy", target: { kind: "picked" } }] };
    }
    case "50906":
      return {
        requires: FIVE_PROGRESS,
        instructions: [
          { verb: "RemoveProgressFromQuest", amount: 5 },
          FIRST_PLAYER_PICKS_PLAYER,
          { verb: "ActAs", who: "pickedPlayer" },
          { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 10, cardType: "ally", intoPlay: true } },
          { verb: "PutIntoPlay", card: "picked", who: "actor" },
        ],
      };
  }
};
// "Forced: At the end of the round, remove 5 progress from this stage or <penalty>. The first player may remove an additional 5 progress ..." (reading 8). An option nobody can do is not offered; the penalty runs for each player after the choice.
const TOOK_PENALTY: Extract<Condition, { kind: "optionTaken" }> = { kind: "optionTaken", id: "penalty" };
const penaltyPossible = (stage: (typeof STAGES_3)[number]): Condition | undefined => {
  if (stage === "50904") return { kind: "anyHand", min: 2 };
  if (stage === "50906") return { kind: "canPick", pick: { type: "ally", control: "any" } };
  return undefined;
};
const stageForced = (stage: (typeof STAGES_3)[number]): Effect => {
  const more = extra(stage);
  const possible = penaltyPossible(stage);
  return {
    id: `${stage}:forced:1`,
    cardCode: stage,
    lines: [`${stage}:B:2`],
    timing: "forced",
    trigger: "endOfRound",
    early: true,
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        different: true,
        options: [
          {
            id: "progress",
            requires: FIVE_PROGRESS,
            instructions: [{ verb: "RemoveProgressFromQuest", amount: 5 }, { verb: "Choose", who: "firstPlayer", options: [{ id: "extra", requires: more.requires, instructions: more.instructions }, { id: "decline", instructions: [] }] }],
          },
          { id: "penalty", ...(possible ? { requires: possible } : {}), instructions: [] },
        ],
      },
      ...penalty(stage, TOOK_PENALTY),
    ],
  };
};
// "Remove all tokens from the Lieutenant enemy at this stage and set it aside, out of play. Add the set aside <Lieutenant> to the staging area, unless it is in a victory display. If Dol Guldur's city strength is 5 or lower, <Lieutenant> makes an immediate
// attack against each player in turn order" (reading 7). The Lieutenant of the stage left is the one in play; the new one is added unless it lies in the victory display, where it is not set aside.
const stageRevealed = (stage: (typeof STAGES_3)[number]): Effect => {
  const own = LIEUTENANTS.find((entry) => entry.stage === stage);
  if (!own) throw new Error(`no Lieutenant for stage ${stage}`);
  const found: PickSpec = { type: "enemy", control: "any", staging: true, names: [own.name] };
  return {
    id: `${stage}:whenRevealed:1`,
    cardCode: stage,
    lines: [`${stage}:A:1`],
    timing: "whenRevealed",
    instructions: [
      ...LIEUTENANTS.filter((entry) => entry.stage !== stage).map((entry): Instruction => ({ verb: "SetAsideInPlay", code: entry.code })),
      { verb: "AddSetAsideToStaging", code: own.code },
      { verb: "Pick", pick: found, when: { kind: "all", conditions: [CITY_AT_MOST_5, { kind: "canPick", pick: found }] } },
      EACH_PLAYER([{ verb: "AttackFromStaging", when: { kind: "all", conditions: [CITY_AT_MOST_5, { kind: "canPick", pick: found }] } }]),
    ],
  };
};
// "<Lieutenant> gets -1 engagement cost for each progress token on this stage."
const stageEngagement = (stage: (typeof STAGES_3)[number]): Effect => {
  const own = LIEUTENANTS.find((entry) => entry.stage === stage);
  return {
    id: `${stage}:constant:1`,
    cardCode: stage,
    lines: [`${stage}:B:1`],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: { stat: "progress", of: "self", negative: true }, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: [own?.name ?? ""] } }],
  };
};
// 50931:B:2 resolves the penalty of the stage 3 picked at random, then discards all progress and lets the first player advance to a stage 3 of his choice (readings 6 and 11): any of the four but the stage in play.
const advanceToStage3: Instruction = {
  verb: "Choose",
  who: "firstPlayer",
  options: STAGES_3.map((code) => ({ id: code, requires: { kind: "inPlay", code, is: false } as Condition, instructions: [{ verb: "AdvanceToStage", code, again: true } as SimpleInstruction] })),
};

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 50901 Assault on the Golden Wood (1A/1B). The piles stage Power of Lórien, the Marauders and Dol Guldur and set Host of Lórien and the Lieutenants aside; the Setup shuffles. Side B: a resource each round, all progress moves to Power of Lórien (a card in the
  // staging area that holds it, reading 9) and at 3 resources the quest advances; the Response costs each player 1 threat and gives each a card and a resource, and the stage's own advance comes first (reading 9).
  { id: "50901:setup:1", cardCode: STAGE_1, lines: ["50901:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
  {
    id: "50901:forced:1",
    cardCode: STAGE_1,
    lines: ["50901:B:1"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [
      { verb: "PlaceResourceTokens", amount: 1, on: "self" },
      { verb: "Pick", pick: POWER_PICK },
      { verb: "PlaceProgressOn", amount: { stat: "progress", of: "questStage" }, target: "picked" },
      { verb: "RemoveProgressFromQuest", amount: { stat: "progress", of: "questStage" } },
      { verb: "AdvanceStage", when: { kind: "tokens", code: STAGE_1, min: 3 } },
    ],
  },
  {
    id: "50901:response:1",
    cardCode: STAGE_1,
    lines: ["50901:B:2"],
    timing: "response",
    trigger: "endOfRound",
    instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }, EACH_PLAYER([{ verb: "Draw", amount: 1 }, { verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "AddResources", amount: 1, to: "picked" }])],
  },

  // 50902 Crossing the Anduin (2A/2B). A: the first player may pay 10 progress from Power of Lórien for Host of Lórien, and only then 20 more to keep Power; in every other case Power is discarded (reading 10). B: each player searches for a Dol Guldur
  // location, the first player advances to a stage 3 of his choice (reading 11).
  {
    id: "50902:whenRevealed:1",
    cardCode: STAGE_2,
    lines: ["50902:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          {
            id: "host",
            requires: { kind: "canPick", pick: { ...POWER_PICK, minProgress: 10 } },
            instructions: [
              { verb: "RemoveProgressFrom", amount: 10, named: "Power of Lórien" },
              { verb: "TakeControlOfSetAside", code: HOST_LORIEN },
              {
                verb: "Choose",
                who: "firstPlayer",
                options: [
                  { id: "power", requires: { kind: "canPick", pick: { ...POWER_PICK, minProgress: 20 } }, instructions: [{ verb: "RemoveProgressFrom", amount: 20, named: "Power of Lórien" }, { verb: "TakeControlOfStaged", code: POWER }] },
                  { id: "discard", instructions: [{ verb: "Pick", pick: POWER_PICK }, { verb: "Discard", target: { kind: "picked" } }] },
                ],
              },
            ],
          },
          { id: "discard", instructions: [{ verb: "Pick", pick: POWER_PICK }, { verb: "Discard", target: { kind: "picked" } }] },
        ],
      },
    ],
  },
  {
    id: "50902:whenRevealed:2",
    cardCode: STAGE_2,
    lines: ["50902:B:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([{ verb: "SearchMove", type: "location", trait: "Dol Guldur", to: "staging" }]),
      { verb: "ShuffleEncounterDeck" },
      { verb: "Choose", who: "firstPlayer", options: STAGES_3.map((code) => ({ id: code, instructions: [{ verb: "AdvanceToStage", code, again: true } as SimpleInstruction] })) },
    ],
  },

  // 50903 to 50906 the four stage 3s (3A/3B, 3C/3D, 3E/3F, 3G/3H): the Lieutenant of the stage left is set aside and the new one added; its engagement cost falls with the progress here; at the end of the round the first player takes the stage's penalty
  // or removes progress (readings 7 and 8).
  ...STAGES_3.flatMap((stage): Effect[] => [stageRevealed(stage), stageEngagement(stage), stageForced(stage)]),

  // 50907 Dol Guldur. The Siege values of the enemies destroyed and the locations explored go into the round's tally whenever it happens (reading 4); at stage 3 its Forced effect takes the tally off the city strength at the end of the round, after the
  // stage's own (reading 5).
  { id: "50907:forced:1", cardCode: DOL_GULDUR, lines: ["50907:A:1"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", staging: true }, instructions: [{ verb: "TallySiege" }] },
  { id: "50907:forced:2", cardCode: DOL_GULDUR, lines: ["50907:A:1"], timing: "forced", trigger: "locationExplored", subject: { type: "location", control: "any" }, instructions: [{ verb: "TallySiege" }] },
  { id: "50907:forced:3", cardCode: DOL_GULDUR, lines: ["50907:A:1"], timing: "forced", trigger: "endOfRound", condition: AT_STAGE_3, instructions: [{ verb: "RemoveResourceTokens", amount: { siegeTally: true }, code: DOL_GULDUR }] },

  // 50908 Power of Lórien: while a player controls it, a Response adds it to the victory display to cancel and discard the encounter card just revealed from the encounter deck (reading 19).
  {
    id: "50908:response:1",
    cardCode: POWER,
    lines: ["50908:A:1"],
    timing: "response",
    trigger: "encounterRevealed",
    cost: { kind: "addSelfToVictory" },
    // "While you control Power of Lórien": in a play area (taken at stage 2B), not in the staging area.
    condition: { kind: "not", condition: { kind: "sourceIn", zone: "staging" } },
    instructions: [{ verb: "CancelEffect" }, { verb: "MoveEncounterCard", card: "subject", to: "discard" }],
  },

  // 50909 Host of Lórien: does not exhaust to quest; leaving play removes it from the game (reading 19).
  { id: "50909:constant:1", cardCode: HOST_LORIEN, lines: ["50909:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "whileSourceInPlay" }] },
  { id: "50909:triggered:1", cardCode: HOST_LORIEN, lines: ["50909:A:4"], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "removed" }] },

  // 50910 to 50913 the Lieutenants: when one attacks you, the attacked player pays (reading 16).
  {
    id: "50910:forced:1",
    cardCode: "50910",
    lines: ["50910:A:2"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [{ verb: "DiscardRandomFromHand", remember: true }, { verb: "ModifyStat", stat: "attack", amount: { stat: "cost", of: "picked", printed: true }, until: "endOfAttack", target: "self" }],
  },
  { id: "50911:forced:1", cardCode: "50911", lines: ["50911:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "DiscardFromDeck", amount: 1 }, { verb: "DiscardCopiesOfDiscarded" }] },
  { id: "50912:forced:1", cardCode: "50912", lines: ["50912:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", to: "engaged", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false } }] },
  { id: "50913:forced:1", cardCode: "50913", lines: ["50913:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "Pick", pick: ALLY_YOU }, { verb: "Discard", target: { kind: "picked" } }] },

  // 50914 Host of Dol Guldur: Archery X with X the number of players; at the end of the encounter phase in the staging area, X progress comes off the main quest.
  { id: "50914:constant:1", cardCode: "50914", lines: ["50914:A:1", "50914:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "archeryPlayers", amount: 1, until: "whileSourceInPlay" }] },
  { id: "50914:constant:2", cardCode: "50914", lines: ["50914:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay" }] },
  {
    id: "50914:forced:1",
    cardCode: "50914",
    lines: ["50914:A:4"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Encounter" }, { kind: "sourceIn", zone: "staging" }] },
    instructions: [{ verb: "RemoveProgressFromQuest", amount: { players: true } }],
  },

  // 50915 Mirkwood Olog-hai: 1 progress for each excess point of damage when it destroys a character (reading 17); the Shadow effect is a choice for the defending player.
  destroysCharacter("50915", "50915:A:1", [{ verb: "RemoveProgressFromQuest", amount: { excessOf: "subject" } }]),
  { id: "50915:shadow:1", cardCode: "50915", lines: ["50915:A:2"], timing: "shadow", instructions: [{ verb: "Choose", who: "actor", options: [progressOption(2), { id: "staging", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] }] }] },

  // 50916 Beast of Taur-nu-Fuin: cannot have attachments and its shadow cards cannot be canceled; when it attacks, remove 2 progress or deal it another shadow card.
  { id: "50916:constant:1", cardCode: "50916", lines: ["50916:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "shadowsUncancelable", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  attacksChoice("50916", "50916:A:2", [progressOption(2), { id: "shadow", instructions: [{ verb: "DealShadow", additional: true }] }]),

  // 50917 Amon Lanc Archer (Archery 2 is a keyword): after it engages you, 2 progress or 2 damage to an ally you control; Shadow: exhaust a character.
  engagesYou("50917", "50917:A:2", [progressOption(2), { id: "damage", requires: { kind: "canPick", pick: ALLY_YOU }, instructions: [{ verb: "Pick", pick: ALLY_YOU }, { verb: "DamageCard", amount: 2, target: "picked" }] }]),
  { id: "50917:shadow:1", cardCode: "50917", lines: ["50917:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] },

  // 50918 Dol Guldur Marauder: +1 Attack and Defense for each resource; when it attacks, 1 progress or a resource on it.
  { id: "50918:constant:1", cardCode: "50918", lines: ["50918:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "defense", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  attacksChoice("50918", "50918:A:2", [progressOption(1), { id: "resource", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] }]),

  // 50919 Battle Warg (Surge is a keyword): after it engages you, 1 progress or discard an attachment you control; Shadow: discard an attachment.
  engagesYou("50919", "50919:A:2", [progressOption(1), { id: "attachment", requires: { kind: "canPick", pick: { type: "attachment", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] }]),
  { id: "50919:shadow:1", cardCode: "50919", lines: ["50919:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },

  // 50920 to 50923: each gains its lines while it is in the staging area (reading 12).
  gate("50920", "50920:A:1", "50903"),
  { id: "50920:constant:2", cardCode: "50920", lines: ["50920:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "playerThreatReductionCap", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { ...gate("50921", "50921:A:1", "50904") },
  { id: "50921:forced:1", cardCode: "50921", lines: ["50921:A:1"], timing: "forced", trigger: "whenRevealedCanceled", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "RevealEncounter" }] },
  { id: "50922:constant:2", cardCode: "50922", lines: ["50922:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { facedown: true, times: 2 }, until: "whileSourceInPlay", target: "self" }] },
  gate("50922", "50922:A:2", "50905"),
  { id: "50922:forced:1", cardCode: "50922", lines: ["50922:A:2"], timing: "forced", trigger: "played", subject: { type: "card", control: "any", cardType: "event" }, condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "sourceIn", zone: "staging" }] }, instructions: [{ verb: "AttachFacedown" }] },
  gate("50923", "50923:A:1", "50906"),
  { id: "50923:constant:2", cardCode: "50923", lines: ["50923:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "healCap", amount: 1, until: "whileSourceInPlay", target: "table" }] },

  // 50924 Forest Battleground: +1 Threat for each ally of the player with the most; when explored, each player searches for an Orc enemy (reading 16).
  { id: "50924:constant:1", cardCode: "50924", lines: ["50924:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { mostPerPlayer: ALLY_YOU }, until: "whileSourceInPlay", target: "self" }] },
  { id: "50924:forced:1", cardCode: "50924", lines: ["50924:A:2"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Orc", to: "staging" }]), { verb: "ShuffleEncounterDeck" }] },

  // 50925 Blackened Woods: when explored, discard the top card of the encounter deck and raise each player's threat by its printed Threat; Shadow: +1 Attack, and 3 progress off the main quest if the attack destroys a character.
  { id: "50925:forced:1", cardCode: "50925", lines: ["50925:A:1"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [{ verb: "DiscardEncounterTop", count: 1 }, { verb: "RaiseThreat", amount: { discardedThreat: true }, who: "eachSeat" }] },
  {
    id: "50925:shadow:1",
    cardCode: "50925",
    lines: ["50925:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "RemoveProgressFromQuest", amount: 3, when: { kind: "x", min: 1 } }] }],
  },

  // 50926 Servant of Sauron (Surge is a keyword): the enemy in the staging area with the highest engagement cost attacks the first player, the first player choosing among a tie (reading 16); Shadow: an additional attack against you.
  {
    id: "50926:whenRevealed:1",
    cardCode: "50926",
    lines: ["50926:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: { ...ENEMY_IN_STAGING, highestEngagementCost: true, who: "firstPlayer" } }, { verb: "AttackFromStaging", who: "firstPlayer", when: { kind: "canPick", pick: ENEMY_IN_STAGING } }],
  },
  { id: "50926:shadow:1", cardCode: "50926", lines: ["50926:A:3"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },

  // 50927 Power Sevenfold (Doomed 1 is a keyword): each player chooses a Dol Guldur location or an Orc enemy to search for (reading 15).
  {
    id: "50927:whenRevealed:1",
    cardCode: "50927",
    lines: ["50927:A:2"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "location", requires: { kind: "searchable", type: "location", trait: "Dol Guldur" }, instructions: [{ verb: "SearchMove", type: "location", trait: "Dol Guldur", to: "staging" }] },
            { id: "enemy", requires: { kind: "searchable", type: "enemy", trait: "Orc" }, instructions: [{ verb: "SearchMove", type: "enemy", trait: "Orc", to: "engaged" }] },
          ],
        },
      ]),
      { verb: "ShuffleEncounterDeck" },
    ],
  },

  // 50928 The Necromancer's Rage: damage to each exhausted character, -1 Willpower for each damaged character (recalculated while the game changes, reading 14); Shadow: damage to the defender, -1 Defense for each damage on it.
  {
    id: "50928:whenRevealed:1",
    cardCode: "50928",
    lines: ["50928:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", state: "exhausted" } }, { verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfPhase", target: "damagedCharacters" }],
  },
  {
    id: "50928:shadow:1",
    cardCode: "50928",
    lines: ["50928:A:2"],
    timing: "shadow",
    instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }, { verb: "ModifyStat", stat: "defense", amount: { stat: "damage", of: "defender", negative: true }, until: "endOfPhase", target: "defender" }],
  },

  // 50929 Fear and Despair (Doomed 1 is a keyword): each player exhausts a character; no character readies by a player card effect this round; Shadow: the defender cannot ready this round.
  {
    id: "50929:whenRevealed:1",
    cardCode: "50929",
    lines: ["50929:A:2"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER([{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }]), { verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "endOfRound", target: "characters" }],
  },
  { id: "50929:shadow:1", cardCode: "50929", lines: ["50929:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },

  // 50930 Fastness of Mirkwood: no more than 5 progress on the current quest this round, surge at 5 or less city strength (read when it is revealed, reading 14); Shadow: +1 Attack and Defense, +2 with 5 progress on the quest.
  {
    id: "50930:whenRevealed:1",
    cardCode: "50930",
    lines: ["50930:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "endOfRound", target: "table" }, { verb: "GainSurge", when: CITY_AT_MOST_5 }],
  },
  {
    id: "50930:shadow:1",
    cardCode: "50930",
    lines: ["50930:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfPhase", target: "attacker" },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "endOfPhase", target: "attacker" },
      { verb: "ModifyStat", stat: "attackAtFiveProgress", amount: 1, until: "endOfPhase", target: "attacker" },
      { verb: "ModifyStat", stat: "defenseAtFiveProgress", amount: 1, until: "endOfPhase", target: "attacker" },
    ],
  },

  // 50931 Standard Game Mode. Front: city strength 5 plus 5 for each player (reading 3). Back: no Indestructible on a Lieutenant at 0 city strength (reading 18); at the end of the round at stage 3 the win check comes first (reading 5), then the random stage:
  // the penalty of a stage 3 the seed picks (the current one is excluded), all progress off the current stage and the first player's choice of a new stage 3 (readings 6 and 11).
  { id: "50931:setup:1", cardCode: MODE, lines: ["50931:A:1"], timing: "setup", instructions: [{ verb: "PlaceResourceTokens", amount: { players: true, times: 5, plus: 5 }, code: DOL_GULDUR }] },
  {
    id: "50931:constant:1",
    cardCode: MODE,
    lines: ["50931:B:1"],
    timing: "constant",
    condition: CITY_AT_0,
    instructions: [{ verb: "ModifyStat", stat: "losesIndestructible", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, trait: "Lieutenant" } }],
  },
  {
    id: "50931:forced:1",
    cardCode: MODE,
    lines: ["50931:B:3"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [{ verb: "WinGame", when: { kind: "all", conditions: [CITY_AT_0, { kind: "count", pick: { type: "enemy", control: "any", staging: true, trait: "Lieutenant" }, max: 0 }] } }],
  },
  {
    id: "50931:forced:2",
    cardCode: MODE,
    lines: ["50931:B:2"],
    timing: "forced",
    trigger: "endOfRound",
    condition: AT_STAGE_3,
    instructions: [
      { verb: "SelectRandomStage", codes: [...STAGES_3] },
      ...STAGES_3.flatMap((stage) => penalty(stage, { kind: "optionTaken", id: stage })),
      { verb: "RemoveAllQuestProgress", of: "stage" },
      advanceToStage3,
    ],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
