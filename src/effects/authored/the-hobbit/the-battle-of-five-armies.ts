import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as BLACK_GATE } from "../return-of-the-king/the-black-gate-opens.ts";
import { AUTHORED_EFFECTS as FLIGHT_TO_THE_FORD } from "../flight-to-the-ford.ts";
import { AUTHORED_EFFECTS as TEMPLE } from "../temple-of-the-deceived.ts";
import { AUTHORED_EFFECTS as THE_OATH } from "../the-oath.ts";
import { MANY_PLAYERS } from "../conditions.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Battle of Five Armies (the-hobbit cycle part 6, no campaign card). Every line is read from the scan ledger (data/printed/the-hobbit.json). The Wilderland set (132035 to 132038) is in set-wilderland.ts. Bilbo is dealt by the loadout.
// Stages 2, 3 and 4 are in play together (families/armies): `questStage` is the current quest stage, the one the first player chose at the start of the round. The readings are in docs/scenarios/the-hobbit.md (The Battle of Five Armies).
// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, hob.battle, hob.siege, hob.bilbo-multiplayer-otd, hob.baggins-sphere-otd, rr.quest-advancement, faq.progress-without-advancing, rr.engaged, rr.immune, rr.forced, rr.staging, rr.reveal (data/rules/entries.json).
const STAGE_1 = "132075";
const STAGE_2 = "132076";
const STAGE_3 = "132077";
const STAGE_4 = "132078";
const STAGE_5 = "132079";
const BOLG: PickSpec = { type: "enemy", control: "any", names: ["Bolg"] };
const NO_PROGRESS = (code: string): Condition => ({ kind: "stageNoProgress", code });
const NOT_COMPLETE = (...codes: string[]): Condition => ({ kind: "stagesComplete", codes, is: false });
const NO_SHADOW_ATTACKS: Instruction = { verb: "ImmediateAttackEach", shadow: false };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const STAGES_NO_PROGRESS = { stagesNoProgress: true } as const;
const THREE_FOR = (stat: "threat" | "attack" | "defense"): Instruction => ({ verb: "ModifyStat", stat, amount: STAGES_NO_PROGRESS, until: "whileSourceInPlay", target: "self" });
// "Forced: Remove 2 progress from stage NB at the end of each round, if able." and "Travel: Spend 3 Baggins resources to travel here. (1 Baggins instead if stage NB is the current quest.)"
const stageLocation = (code: string, stage: string): Effect[] => [
  { id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:2`], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "RemoveProgressFromStages", amount: 2, code: stage }] },
  {
    id: `${code}:travel:1`,
    cardCode: code,
    lines: [`${code}:A:3`],
    timing: "travel",
    instructions: [
      { verb: "SpendResources", amount: 1, sphere: "baggins", group: true, when: { kind: "stageIsCurrent", code: stage } },
      { verb: "SpendResources", amount: 3, sphere: "baggins", group: true, when: { kind: "not", condition: { kind: "stageIsCurrent", code: stage } } },
    ],
  },
];
// "Players cannot advance from this stage unless stage X and stage Y are complete." Each stage in play holds it against the others: the players advance when the three are complete together, the stage that is full takes them to stage 5.
const needsOthers = (id: string, code: string, line: string, ...others: string[]): Effect => ({ id, cardCode: code, lines: [line], timing: "constant", condition: NOT_COMPLETE(...others), instructions: [{ verb: "Restrict", what: "advance" }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 132052 Misty Mountain Eagle (objective ally in the encounter deck). Action: the first player spends 2 Baggins resources and chooses to take control of it, or to discard it to discard a non-unique enemy in the staging area. Shadow: 3 damage to the attacking enemy.
    {
      id: "132052:action:1",
      cardCode: "132052",
      lines: ["132052:A:1"],
      timing: "action",
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "firstPlayer" }] },
      instructions: [
        { verb: "SpendResources", amount: 2, sphere: "baggins", group: true },
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "control", instructions: [{ verb: "TakeControl", who: "actor" }] },
            {
              id: "discard",
              requires: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true } },
              instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true } }, { verb: "Discard", target: { kind: "self" } }, { verb: "Discard", target: { kind: "picked" } }],
            },
          ],
        },
      ],
    },
    { id: "132052:shadow:1", cardCode: "132052", lines: ["132052:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 3, target: "attacker" }] },

    // 132053 Bolg. X is the number of players; he cannot leave the staging area; the first Goblin revealed each round gains surge (the Setup's reveals count for round 1).
    copyLine("110077:A:1", "132053:A:2"),
    copyLine("146031:A:1", "132053:A:3"),
    { id: "132053:constant:3", cardCode: "132053", lines: ["132053:A:4"], timing: "constant", instructions: [{ verb: "FirstRevealedSurges", trait: "Goblin", type: "enemy" }] },

    // 132054 Bodyguard of Bolg. Bolg cannot take damage while it is in play. Forced: when it attacks, it is dealt an additional shadow card for each quest stage in play with no progress on it.
    { id: "132054:constant:1", cardCode: "132054", lines: ["132054:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: BOLG }] },
    { id: "132054:forced:1", cardCode: "132054", lines: ["132054:A:2"], timing: "forced", trigger: "attacks", instructions: [{ verb: "Repeat", times: STAGES_NO_PROGRESS, instructions: [{ verb: "DealShadow", additional: true }] }] },

    // 132055 Gundabad Wolf Rider. Forced: when it attacks, remove 1 progress from the current quest. Shadow: +1 Attack for each quest stage in play with no progress on it.
    { id: "132055:forced:1", cardCode: "132055", lines: ["132055:A:1"], timing: "forced", trigger: "attacks", instructions: [{ verb: "RemoveProgressFromQuest", amount: 1 }] },
    { id: "132055:shadow:1", cardCode: "132055", lines: ["132055:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: STAGES_NO_PROGRESS, until: "endOfAttack", target: "attacker" }] },

    // 132056 Gundabad Climber. When Revealed: remove 1 progress from every quest stage in play (2 with 3 or more players).
    { id: "132056:whenRevealed:1", cardCode: "132056", lines: ["132056:A:1"], timing: "whenRevealed", instructions: [{ verb: "RemoveProgressFromStages", amount: 1, when: { kind: "not", condition: MANY_PLAYERS } }, { verb: "RemoveProgressFromStages", amount: 2, when: MANY_PLAYERS }] },

    // 132057 Vanguard of Bolg. +1 Threat, Attack and Defense for each quest stage in play with no progress on it. Shadow: if this attack destroys a character, remove all progress from the current quest (copied).
    { id: "132057:constant:1", cardCode: "132057", lines: ["132057:A:1"], timing: "constant", instructions: [THREE_FOR("threat"), THREE_FOR("attack"), THREE_FOR("defense")] },
    copyLine("141065:A:2", "132057:A:2"),

    // 132058 Gundabad Archer. When Revealed: each player deals 2 damage to a character he controls. Shadow: 1 damage to the defending character for each quest stage in play with no progress on it.
    {
      id: "132058:whenRevealed:1",
      cardCode: "132058",
      lines: ["132058:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DamageCard", amount: 2, target: "picked" }])],
    },
    { id: "132058:shadow:1", cardCode: "132058", lines: ["132058:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: STAGES_NO_PROGRESS, target: "defender" }] },

    // 132059 Ravenous Warg. Forced: when it attacks, the defending player declares the character with the most damage, an exhausted one too. Shadow: the defending character gets -1 Defense for each quest stage in play with no progress on it.
    { id: "132059:forced:1", cardCode: "132059", lines: ["132059:A:1"], timing: "forced", trigger: "attacks", instructions: [{ verb: "MustDefendMostDamaged" }] },
    { id: "132059:shadow:1", cardCode: "132059", lines: ["132059:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { ...STAGES_NO_PROGRESS, times: -1 }, until: "endOfAttack", target: "defender" }] },

    // 132060 Northern Slopes. In the staging area each Goblin enemy gets +1 Attack and +1 Defense. As the active location it has a Forced effect: when a character leaves play, remove 1 progress from the current quest.
    {
      id: "132060:constant:1",
      cardCode: "132060",
      lines: ["132060:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", trait: "Goblin" } },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", trait: "Goblin" } },
      ],
    },
    {
      id: "132060:forced:1",
      cardCode: "132060",
      lines: ["132060:A:2"],
      timing: "forced",
      trigger: "leftPlay",
      subject: { type: "character", control: "any" },
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "RemoveProgressFromQuest", amount: 1 }],
    },

    // 132061 Ruins of Dale (stage 3B), 132062 Ravenhill (stage 4B), 132063 The Front Gate (stage 2B): each removes 2 progress from its stage at the end of the round and costs 1 Baggins resource to travel to when that stage is the current quest, 3 otherwise.
    ...stageLocation("132061", STAGE_3),
    ...stageLocation("132062", STAGE_4),
    ...stageLocation("132063", STAGE_2),

    // 132064 Hatred Rekindled. When Revealed: each enemy engaged with a player makes an immediate attack, with no shadow card dealt; with none it gains surge. Shadow: the attacking enemy makes an additional attack immediately after this one.
    { id: "132064:whenRevealed:1", cardCode: "132064", lines: ["132064:A:1"], timing: "whenRevealed", instructions: [NO_SHADOW_ATTACKS, { verb: "GainSurge", when: { kind: "noneReturned" } }] },
    { id: "132064:shadow:1", cardCode: "132064", lines: ["132064:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack" }] }] },

    // 132065 Goblins are Upon You! (both lines copied).
    copyLine("41024:A:1", "132065:A:1"),
    copyLine("41024:A:2", "132065:A:2"),

    // 132066 Heedless of Order. When Revealed: the first player chooses a different quest stage to be the current quest until the end of the round, if able; when none can be chosen it gains Doomed 3 (read before the choice).
    {
      id: "132066:whenRevealed:1",
      cardCode: "132066",
      lines: ["132066:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Doomed", amount: 3, when: { kind: "not", condition: { kind: "currentQuest", is: "other" } } }, { verb: "ChooseCurrentQuest", when: { kind: "currentQuest", is: "other" } }],
    },

    // 132075 The Gathering of the Clouds (stage 1). Setup: Bolg is already in the staging area (the load list stages him); shuffle the encounter deck, reveal 1 encounter card per player; stage 1 then shows side B and its When Revealed resolves after those reveals (families/quest/setup.ts). Side B: stages 2, 3 and 4 are put into play
    // at the same time and this stage leaves play.
    {
      id: "132075:setup:1",
      cardCode: STAGE_1,
      lines: ["132075:A:1"],
      timing: "setup",
      instructions: [{ verb: "ShuffleEncounterDeck" }, EACH_PLAYER([{ verb: "RevealEncounter" }])],
    },
    { id: "132075:whenRevealed:1", cardCode: STAGE_1, lines: ["132075:B:1"], timing: "whenRevealed", instructions: [{ verb: "PutStagesIntoPlay", codes: [STAGE_2, STAGE_3, STAGE_4] }] },

    // 132076 stage 2, 132077 stage 3 (Battle), 132078 stage 4 (Siege).
    needsOthers("132076:constant:1", STAGE_2, "132076:B:1", STAGE_3, STAGE_4),
    { id: "132076:forced:1", cardCode: STAGE_2, lines: ["132076:B:2"], timing: "forced", trigger: "endOfRound", condition: NO_PROGRESS(STAGE_2), instructions: [{ verb: "DiscardRandomFromHand", who: "eachSeat" }] },
    needsOthers("132077:constant:1", STAGE_3, "132077:B:1", STAGE_2, STAGE_4),
    { id: "132077:constant:2", cardCode: STAGE_3, lines: ["132077:B:2"], timing: "constant", condition: { kind: "stageIsCurrent", code: STAGE_3 }, instructions: [{ verb: "ModifyStat", stat: "battle", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "132077:forced:1", cardCode: STAGE_3, lines: ["132077:B:3"], timing: "forced", trigger: "endOfRound", condition: NO_PROGRESS(STAGE_3), instructions: [{ verb: "StageTopmostFromDiscard", type: "enemy" }] },
    needsOthers("132078:constant:1", STAGE_4, "132078:B:1", STAGE_2, STAGE_3),
    { id: "132078:constant:2", cardCode: STAGE_4, lines: ["132078:B:2"], timing: "constant", condition: { kind: "stageIsCurrent", code: STAGE_4 }, instructions: [{ verb: "ModifyStat", stat: "siege", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "132078:forced:1",
      cardCode: STAGE_4,
      lines: ["132078:B:3"],
      timing: "forced",
      trigger: "endOfRound",
      condition: NO_PROGRESS(STAGE_4),
      instructions: [{ verb: "Each", pick: { type: "hero", control: "any" }, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] }],
    },

    // 132079 stage 5. When Revealed: each player searches the encounter deck and discard pile for a Bodyguard of Bolg and adds it to the staging area; shuffle. Progress cannot be placed on it; while Bolg is in the staging area he is engaged with the first player. When Bolg is destroyed the players win.
    {
      id: "132079:whenRevealed:1",
      cardCode: STAGE_5,
      lines: ["132079:B:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", code: "132054", to: "staging" }]), { verb: "ShuffleEncounterDeck" }],
    },
    {
      id: "132079:constant:1",
      cardCode: STAGE_5,
      lines: ["132079:B:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "engagedWithFirst", amount: 1, until: "whileSourceInPlay", holders: { ...BOLG, stagingOnly: true } },
        { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: { ...BOLG, stagingOnly: true } },
        { verb: "ModifyStat", stat: "noThreatContribution", amount: 1, until: "whileSourceInPlay", holders: { ...BOLG, stagingOnly: true } },
      ],
    },
    { id: "132079:triggered:1", cardCode: STAGE_5, lines: ["132079:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: BOLG, instructions: [{ verb: "WinGame" }] },
  ],
  { pool: [...TEMPLE, ...BLACK_GATE, ...FLIGHT_TO_THE_FORD, ...THE_OATH] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
