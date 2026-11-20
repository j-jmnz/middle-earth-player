import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Siege of Annúminas (standalone-scenarios cycle part 8, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// Played in the Standard Game Mode only (docs/brief.md, The Siege of Annúminas, readings 1 and 2): "each stage", "each team" and "at this stage" read as the one table. The mode card 50801 is the scenario's `modeCard`: its front Setup runs before the quest card's,
// then it is flipped and its back lines work all game (reading 3). The city strength of Annúminas is the resource tokens on it: Setup places 20, "deal X damage to Annúminas" removes X, a constant loses the game at none (reading 4).
// Rules: rr.forced, rr.response, rr.then, rr.travel, rr.first-player, rr.player-elimination, rr.the-word-choose, rr.victory, rr.engaged, rr.in-play-and-out-of-play, faq.additional-attacks (data/rules/entries.json).
const MODE = "50801";
const STAGE_1 = "50803";
const STAGE_2 = "50804";
const STAGE_3 = "50805";
const ANNUMINAS = "50812";
const LIEUTENANT = "50813";
const BATTERING_RAM = "50814";
const HOST = "50817";
const DUNEDAIN = "50818";
const GATE = "50819";

// "Deal X damage to Annúminas" (reading 4): X city strength tokens come off, never below 0.
const hurtCity = (amount: Extract<Instruction, { verb: "RemoveResourceTokens" }>["amount"], when?: Condition): Instruction => ({ verb: "RemoveResourceTokens", code: ANNUMINAS, amount, ...(when ? { when } : {}) });
const EACH_PLAYER = (instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions } as Instruction);
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const ENEMY_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const SOME_PROGRESS: Condition = { kind: "stageProgress", min: 1 };
const THREE_ON_SELF: Condition = { kind: "less", left: 2, right: { stat: "resources", of: "self" } };
// "either remove N progress from the main quest, or <other>" (reading 16): an option nobody can do is not offered.
type Option = Extract<Instruction, { verb: "Choose" }>["options"][number];
const progressOption = (amount: number): Option => ({ id: "progress", requires: SOME_PROGRESS, instructions: [{ verb: "RemoveProgressFromQuest", amount }] });
const EXHAUST_OPTION: Option = { id: "exhaust", requires: { kind: "canPick", pick: READY_CHARACTER }, instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] };
// "Travel: Reveal 1 encounter card per player to travel here." (50814:A:3, 50815:A:3, 50816:A:3)
const travelReveals = (code: string): Effect => ({ id: `${code}:travel:1`, cardCode: code, lines: [`${code}:A:3`], timing: "travel", instructions: [{ verb: "RevealEncounter", times: { players: true } }] });
// "discard cards from the top until an enemy is discarded and add it to the staging area" (50816:A:2, 50822:A:2): the enemy found joins the staging area.
const ENEMY_TO_STAGING: Instruction[] = [{ verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false } }];
// "After <enemy> attacks and destroys a character" (50817:A:3, 50827:A:1).
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
// "The Lieutenant / Host ... Each ... engages you" (50824, 50826): the engaged player chooses.
const engagesYou = (code: string, line: string, options: Option[]): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "engaged",
  subject: "self",
  instructions: [{ verb: "Choose", who: "actor", options }],
});

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 50801 Standard Game Mode. Front: Annúminas is staged by the piles and the quest decks are arranged by the data; the record sets the city strength to 20. Back: advancing to stage 2A (before its When Revealed) shuffles the set aside Dúnedain and X copies
  // of Host of Angmar (the players less one, at least 1) into the encounter deck; a player's elimination deals 9 damage to Annúminas (readings 3 and 17).
  { id: "50801:setup:1", cardCode: MODE, lines: ["50801:A:1"], timing: "setup", instructions: [{ verb: "PlaceResourceTokens", amount: 20, code: ANNUMINAS }] },
  {
    id: "50801:forced:1",
    cardCode: MODE,
    lines: ["50801:B:1"],
    timing: "forced",
    trigger: "stageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: ["Defend the City"] } },
    instructions: [
      { verb: "ShuffleSetAsideIntoEncounterDeck", code: DUNEDAIN, all: true },
      { verb: "ShuffleSetAsideIntoEncounterDeck", code: HOST },
      { verb: "Repeat", times: { players: true, plus: -2 }, instructions: [{ verb: "ShuffleSetAsideIntoEncounterDeck", code: HOST }] },
    ],
  },
  { id: "50801:triggered:1", cardCode: MODE, lines: ["50801:B:2"], timing: "triggered", trigger: "playerEliminated", instructions: [hurtCity(9)] },

  // 50803 Rebuild the Defenses (1A/1B). Setup: the nine cards are set aside by the piles; each player searches for a different location, one of them the Gate of Annúminas (reading 15). Side B: a resource each round, advancing at 4; ten progress
  // from this stage raise the city strength by 10 (reading 5: the Response is offered with 10 or more progress).
  { id: "50803:setup:1", cardCode: STAGE_1, lines: ["50803:A:1"], timing: "setup", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging", different: true, deckOnly: true, require: GATE }]), { verb: "ShuffleEncounterDeck" }] },
  {
    id: "50803:forced:1",
    cardCode: STAGE_1,
    lines: ["50803:B:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Resource" },
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }, { verb: "AdvanceStage", when: { kind: "tokens", code: STAGE_1, min: 4 } }],
  },
  {
    id: "50803:response:1",
    cardCode: STAGE_1,
    lines: ["50803:B:2"],
    timing: "response",
    trigger: "endOfRound",
    condition: { kind: "stageProgress", min: 10 },
    instructions: [{ verb: "RemoveProgressFromQuest", amount: 10 }, { verb: "PlaceResourceTokens", amount: 10, code: ANNUMINAS }],
  },

  // 50804 Defend the City (2A/2B). X is the players less one, at least 1, over the players in the game (reading 6). Side B: -10 quest points for each Host of Angmar in the victory display; after the quest commitment the highest Attack enemy in the staging area
  // attacks each player in turn (a tie is the first player's choice, reading 7), and with no enemy there the top encounter card is revealed; at the end of the round each player heals 1 damage from a character he controls (reading 8).
  { id: "50804:whenRevealed:1", cardCode: STAGE_2, lines: ["50804:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, less: 1, atLeast: 1, to: "staging" }] },
  {
    id: "50804:constant:1",
    cardCode: STAGE_2,
    lines: ["50804:B:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { count: { type: "enemy", control: "any", from: "victory", names: ["Host of Angmar"] }, times: 10, negative: true }, until: "whileSourceInPlay", target: "self" }],
  },
  {
    id: "50804:forced:1",
    cardCode: STAGE_2,
    lines: ["50804:B:2"],
    timing: "forced",
    trigger: "stagingStepBegins",
    instructions: [
      { verb: "Pick", pick: { ...ENEMY_IN_STAGING, highestAttack: true, who: "firstPlayer" }, when: { kind: "canPick", pick: ENEMY_IN_STAGING } },
      EACH_PLAYER([{ verb: "AttackFromStaging" }]),
      { verb: "RevealEncounter", when: { kind: "count", pick: ENEMY_IN_STAGING, max: 0 } },
    ],
  },
  {
    id: "50804:response:1",
    cardCode: STAGE_2,
    lines: ["50804:B:3"],
    timing: "response",
    trigger: "endOfRound",
    condition: { kind: "canPick", pick: { type: "character", control: "any", damaged: true } },
    instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you", damaged: true } }, { verb: "Heal", amount: 1, target: "picked" }])],
  },

  // 50805 Lead the Sortie (3A/3B). The first player adds the Battering Ram and the Lieutenant, each other player reveals. Side B: no progress while the Battering Ram is in play; the Response needs an enemy at another stage, which no Standard game
  // has, so it is never offered (reading 9); the Lieutenant in the victory display at the end of the round wins, after the end-of-round Forced effects (reading 10: oldest card first, so Annúminas' damage comes first).
  {
    id: "50805:whenRevealed:1",
    cardCode: STAGE_3,
    lines: ["50805:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "AddSetAsideToStaging", code: BATTERING_RAM }, { verb: "AddSetAsideToStaging", code: LIEUTENANT }, EACH_PLAYER([{ verb: "RevealEncounter", when: { kind: "not", condition: { kind: "firstPlayer" } } }])],
  },
  {
    id: "50805:constant:1",
    cardCode: STAGE_3,
    lines: ["50805:B:1"],
    timing: "constant",
    condition: { kind: "count", pick: { type: "enemy", control: "any", staging: true, names: ["Battering Ram"] }, min: 1 },
    instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },
  {
    id: "50805:response:1",
    cardCode: STAGE_3,
    lines: ["50805:B:2"],
    timing: "response",
    trigger: "endOfRound",
    condition: { kind: "canPick", pick: { type: "enemy", control: "any", nonUnique: true, noVictory: true, atOtherStage: true } },
    instructions: [
      { verb: "RaiseThreat", amount: 1, who: "eachSeat" },
      { verb: "RevealEncounter" },
      { verb: "Pick", pick: { type: "enemy", control: "any", nonUnique: true, noVictory: true, atOtherStage: true } },
      { verb: "Discard", target: { kind: "picked" } },
    ],
  },
  { id: "50805:forced:1", cardCode: STAGE_3, lines: ["50805:B:3"], timing: "forced", trigger: "endOfRound", condition: { kind: "inVictory", code: LIEUTENANT, is: true }, instructions: [{ verb: "WinGame" }] },

  // 50812 Annúminas. At the end of the round 1 damage for each enemy in play; no city strength left loses the game (reading 4, 11).
  { id: "50812:forced:1", cardCode: ANNUMINAS, lines: ["50812:A:1"], timing: "forced", trigger: "endOfRound", instructions: [hurtCity({ count: { type: "enemy", control: "any", staging: true } })] },
  {
    id: "50812:constant:1",
    cardCode: ANNUMINAS,
    lines: ["50812:A:2"],
    timing: "constant",
    condition: { kind: "not", condition: { kind: "tokens", code: ANNUMINAS, min: 1 } },
    instructions: [{ verb: "LoseGame", reason: "The city of Annúminas was overrun: its city strength reached 0" }],
  },

  // 50813 Lieutenant of Angmar. No damage before 10 progress on the main quest; at the end of the round it goes to the staging area and attacks the first player (reading 12).
  {
    id: "50813:constant:1",
    cardCode: LIEUTENANT,
    lines: ["50813:A:2"],
    timing: "constant",
    condition: { kind: "not", condition: { kind: "stageProgress", min: 10 } },
    instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },
  { id: "50813:forced:1", cardCode: LIEUTENANT, lines: ["50813:A:3"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }, { verb: "AttackFirstPlayer" }] },

  // 50814 Battering Ram. X is the resources on it plus 1; each round it gets a resource first, then deals X damage to Annúminas (reading 13).
  { id: "50814:constant:1", cardCode: BATTERING_RAM, lines: ["50814:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self", plus: 1 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "50814:forced:1", cardCode: BATTERING_RAM, lines: ["50814:A:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }, hurtCity({ stat: "resources", of: "self", plus: 1 })] },
  travelReveals(BATTERING_RAM),

  // 50815 Enemy Camp and 50816 Siege Tunnel (Epic cards: no Standard card brings them into play, reading 18).
  { id: "50815:forced:1", cardCode: "50815", lines: ["50815:A:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "DiscardHeldHero", stage: 3, when: { kind: "inPlay", code: "50815", is: true } }, { verb: "ReturnHeldHeroes", stage: 3, when: { kind: "inVictory", code: "50815", is: true } }] },
  travelReveals("50815"),
  { id: "50816:forced:1", cardCode: "50816", lines: ["50816:A:2"], timing: "forced", trigger: "endOfRound", instructions: ENEMY_TO_STAGING },
  travelReveals("50816"),

  // 50817 Host of Angmar: after it destroys a character, remove 2 progress or return it to the staging area (reading 16).
  destroysCharacter(HOST, "50817:A:3", [{ verb: "Choose", who: "firstPlayer", options: [progressOption(2), { id: "staging", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] }]),

  // 50818 Dúnedain of Annúminas. Any player may spend 1 resource to take control; otherwise it is discarded (reading 14). Shadow: ready the defender, +2 Defense for the attack.
  {
    id: "50818:whenRevealed:1",
    cardCode: DUNEDAIN,
    lines: ["50818:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          {
            id: "control",
            requires: { kind: "canPick", pick: { type: "player", control: "any", canSpendResources: 1 } },
            instructions: [{ verb: "Pick", pick: { type: "player", control: "any", canSpendResources: 1 } }, { verb: "SwitchActor", to: "picked" }, { verb: "SpendResources", amount: 1 }, { verb: "TakeControl", who: "actor" }],
          },
          { id: "discard", instructions: [{ verb: "Discard", target: { kind: "self" } }] },
        ],
      },
    ],
  },
  { id: "50818:shadow:1", cardCode: DUNEDAIN, lines: ["50818:A:3"], timing: "shadow", instructions: [{ verb: "Ready", target: "defender" }, { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfAttack", target: "defender" }] },

  // 50819 Gate of Annúminas. X is 1 more than the enemies in play; travel: each player engages an enemy of the staging area.
  { id: "50819:constant:1", cardCode: GATE, lines: ["50819:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "enemy", control: "any", staging: true }, plus: 1 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "50819:travel:1", cardCode: GATE, lines: ["50819:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "Pick", pick: ENEMY_IN_STAGING }, { verb: "Engage", target: "picked" }])] },

  // 50820 City Wall: at the end of the round a resource; at 3 it is discarded and Annúminas takes 4 damage, and an encounter card is revealed. (Its travel line is a template.)
  {
    id: "50820:forced:1",
    cardCode: "50820",
    lines: ["50820:A:2"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }, { verb: "Discard", target: { kind: "self" }, when: THREE_ON_SELF }, hurtCity(4, THREE_ON_SELF), { verb: "RevealEncounter", when: THREE_ON_SELF }],
  },

  // 50821 Arnor Battlefield, 50822 Hills of Evendim, 50823 Shores of Lake Nenuial.
  { id: "50821:constant:1", cardCode: "50821", lines: ["50821:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -5, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, nonUnique: true } }] },
  { id: "50821:travel:1", cardCode: "50821", lines: ["50821:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "DamageCard", amount: 1, target: "picked" }])] },
  { id: "50822:constant:1", cardCode: "50822", lines: ["50822:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "encounterUncancelable", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "50822:travel:1", cardCode: "50822", lines: ["50822:A:2"], timing: "travel", instructions: [{ verb: "ShuffleEncounterDiscard" }, ...ENEMY_TO_STAGING] },
  { id: "50823:constant:1", cardCode: "50823", lines: ["50823:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, other: true } }] },
  { id: "50823:travel:1", cardCode: "50823", lines: ["50823:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

  // 50824 Warg of Carn Dûm, 50826 Angmar Warg-rider: after it engages you, the engaged player chooses (reading 16).
  engagesYou("50824", "50824:A:2", [progressOption(1), EXHAUST_OPTION]),
  engagesYou("50826", "50826:A:2", [progressOption(2), { id: "attack", instructions: [{ verb: "ImmediateAttack" }] }]),
  // 50825 Orc of Angmar: when it attacks, remove 1 progress or it gets +2 Defense until the end of the phase. Shadow: the defender gets -2 Defense until the end of the round.
  {
    id: "50825:forced:1",
    cardCode: "50825",
    lines: ["50825:A:2"],
    timing: "forced",
    trigger: "attacks",
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [progressOption(1), { id: "defense", instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "self" }] }] }],
  },
  { id: "50825:shadow:1", cardCode: "50825", lines: ["50825:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfRound", target: "defender" }] },
  { id: "50826:shadow:1", cardCode: "50826", lines: ["50826:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] },
  // 50827 Savage Werewolf: after it destroys a character, remove 3 progress. Shadow: an additional attack against you.
  destroysCharacter("50827", "50827:A:1", [{ verb: "RemoveProgressFromQuest", amount: 3 }]),
  { id: "50827:shadow:1", cardCode: "50827", lines: ["50827:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },
  // 50828 Vanguard of Carn Dûm (its first line, Cannot have attachments, is a template).
  { id: "50828:constant:2", cardCode: "50828", lines: ["50828:A:2"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "whileSourceInPlay", target: "table" }] },
  { id: "50828:shadow:1", cardCode: "50828", lines: ["50828:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "doesNotReady", amount: 1, until: "endOfRound", target: "defender" }] },

  // 50829 The Hordes of Angmar: each player chooses between returning his highest Threat enemy and searching for an enemy.
  {
    id: "50829:whenRevealed:1",
    cardCode: "50829",
    lines: ["50829:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "return", requires: { kind: "hasEngaged" }, instructions: [{ verb: "Pick", pick: { type: "enemy", control: "you", engaged: "you", highestThreat: true } }, { verb: "ReturnToStaging", target: { kind: "picked" } }] },
            { id: "search", requires: { kind: "searchable", type: "enemy" }, instructions: [{ verb: "SearchMove", type: "enemy", to: "engaged" }] },
          ],
        },
      ]),
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  { id: "50829:shadow:1", cardCode: "50829", lines: ["50829:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RevealEncounter", when: { kind: "x", min: 1 } }] }] },

  // 50830 Sorcery of Carn Dûm: discard the highest cost attachment, or assign X damage (X the attachments you control).
  {
    id: "50830:whenRevealed:1",
    cardCode: "50830",
    lines: ["50830:A:2"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "discard", requires: { kind: "canPick", pick: { type: "attachment", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", highestCost: true } }, { verb: "Discard", target: { kind: "picked" } }] },
            { id: "damage", requires: { kind: "canPick", pick: { type: "attachment", control: "you" } }, instructions: [{ verb: "AssignDamage", amount: { count: { type: "attachment", control: "you" } }, pick: { type: "character", control: "you" } }] },
          ],
        },
      ]),
    ],
  },
  { id: "50830:shadow:1", cardCode: "50830", lines: ["50830:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },

  // 50831 Caught in the Press: 1 damage to each questing character you control, or -1 Willpower for each until the end of the phase. Shadow: remove 2 progress, or return the attacker to the staging area after the attack.
  {
    id: "50831:whenRevealed:1",
    cardCode: "50831",
    lines: ["50831:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "damage", requires: { kind: "canPick", pick: { type: "character", control: "you", committed: true } }, instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "you", committed: true } }] },
            { id: "willpower", requires: { kind: "canPick", pick: { type: "character", control: "you", committed: true } }, instructions: [{ verb: "Each", pick: { type: "character", control: "you", committed: true }, instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfPhase", target: "picked" }] }] },
          ],
        },
      ]),
    ],
  },
  {
    id: "50831:shadow:1",
    cardCode: "50831",
    lines: ["50831:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Choose", who: "actor", options: [progressOption(2), { id: "staging", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] }] }],
  },

  // 50832 Weary Warriors: each player damages a hero; a questing one leaves the quest; damaged characters' text boxes are blank until the end of the round.
  {
    id: "50832:whenRevealed:1",
    cardCode: "50832",
    lines: ["50832:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        { verb: "Pick", pick: { type: "hero", control: "you" } },
        { verb: "DamageCard", amount: 1, target: "picked" },
        { verb: "RemoveFromQuest", when: { kind: "matches", card: "picked", pick: { type: "hero", control: "any", committed: true } } },
      ]),
      { verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", target: "damagedCharacters" },
    ],
  },
  {
    id: "50832:shadow:1",
    cardCode: "50832",
    lines: ["50832:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } },
    ],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
