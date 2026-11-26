import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for Race Across Harad (haradrim cycle part 5, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// See docs/scenarios/haradrim/race-across-harad.md, Readings, for each reading. The Orcs' area (a second quest deck of stages 1C to 4C, its cards in the area zone while the players are at another stage, in the staging area at the same stage) and the Tamed Mûmak
// are the haradrim family's (src/rules/families/haradrim/orcs-*.ts, mumak.ts). The piles deal Uruk Chieftain, River Harnen, the Orcs' stages, one Uruk Warg-rider and the four Tamed Mûmak aside; the Setup record takes a Mûmak for each player and prepares the area.
// Rules: hrd.setup-race-across-harad, hrd.prepare-the-orcs-area, hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage, hrd.stage-number, hrd.side-quests, hrd.immune-to-player-card-effects, hrd.doomed-x-player-cards, rr.player-elimination, ltp.undefended-attack, rr.forced, rr.travel, rr.cannot, rr.first-player, rr.quest-advancement, rr.attachment-cards, rr.surge, rr.lasting-effects, faq.reveal-and-add, faq.triggering-forced-effects, faq.lasting-effects (data/rules/entries.json).
type Cond = NonNullable<Effect["condition"]>;
type Instruction = Effect["instructions"][number];

const MUMAK = "17038";
const HARNEN = "17039";
const WARG_RIDER = "16063";
const CHIEFTAIN = "16061";
const ORCS_STAGES = ["17051", "17052", "17053", "17054"];
// The Orcs' stage and the players' stage (hrd.orcs-area-different-stage): the main quest stage's number against the Orcs' stage's number, read live.
const SAME: Cond = { kind: "orcsStage", is: "sameStage" };
const DIFFERENT: Cond = { kind: "orcsStage", is: "differentStage" };
const ON_STAGE = (stage: number): Cond => ({ kind: "onStage", stage });
// "If the players have already defeated stage NB": the players' quest deck has passed it (their stage number is above it), read when the C side is revealed.
const DEFEATED = (stage: number): Cond => ({ kind: "less", left: stage, right: { stage: true } });
// Uruk Chieftain wherever he stands in play: engaged, in the staging area or in the Orcs' area.
const CHIEFTAIN_ANY: PickSpec = { type: "enemy", control: "any", allInPlay: true, names: ["Uruk Chieftain"] };
const CHIEFTAIN_IN_PLAY: Cond = { kind: "canPick", pick: CHIEFTAIN_ANY };
// "Add that enemy to the Orcs' area": the Orc enemy the encounter deck's discards found, when one was found (out of play, in the discard pile).
const FOUND_ORC: Cond = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Orc" }, inPlay: false };
// "Discard cards from the top of the encounter deck until an Orc enemy is discarded. Add that enemy to the Orcs' area" (the discard pile shuffled back in when the deck runs out first, a Creature such as Racing Warg skipped).
const ADD_AN_ORC: Instruction[] = [{ verb: "DiscardUntil", type: "enemy", trait: "Orc", reshuffle: true }, { verb: "MoveToOrcsArea", target: "picked", when: FOUND_ORC }];
// "Shuffle the encounter discard pile into the encounter deck and discard cards from the top until an Orc enemy is discarded. Add that enemy to the Orcs' area."
const SHUFFLE_AND_ADD_AN_ORC: Instruction[] = [{ verb: "ShuffleEncounterDiscard" }, ...ADD_AN_ORC];
// The Orc enemies a Racing Warg may attach to: any Orc in play without one, the first player choosing; the Orcs' area counts (a card there is in play).
const WARG_HOST: PickSpec = { type: "enemy", control: "any", allInPlay: true, trait: "Orc", who: "firstPlayer", hasAttachment: { names: ["Racing Warg"], none: true } };
// A Tamed Mûmak in play that is not committed to the quest: "if each Tamed Mûmak in play is committed" holds while none is such.
const MUMAK_NOT_COMMITTED: PickSpec = { type: "ally", control: "any", names: ["Tamed Mûmak"], committed: false };
// "Forced: After characters are committed to the quest, no more than 5 progress can be placed here this round (10 progress instead if each Tamed Mûmak in play is committed to the quest)": the trigger is the start of the staging step, after the commitment (reading of
// The Woodland Realm, 51101:B:1's form); the cap holds to the end of the round, so a stage revealed after the commit step has none that round.
const PROGRESS_CAP: Effect["instructions"] = [
  { verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "endOfRound", target: "table", when: { kind: "canPick", pick: MUMAK_NOT_COMMITTED } },
  { verb: "ModifyStat", stat: "questProgressCap", amount: 10, until: "endOfRound", target: "table", when: { kind: "not", condition: { kind: "canPick", pick: MUMAK_NOT_COMMITTED } } },
];
// "Forced: At the end of the quest phase": the Orcs' stage makes progress.
const END_OF_QUEST_PHASE = { timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Quest" } } as const satisfies Partial<Effect>;
// "Return Uruk Chieftain to the Orcs' area": he loses an engagement; with no Chieftain in play it does nothing.
const RETURN_CHIEFTAIN: Instruction[] = [{ verb: "Pick", pick: CHIEFTAIN_ANY }, { verb: "MoveToOrcsArea", target: "picked", when: CHIEFTAIN_IN_PLAY }];
// "Uruk Chieftain cannot take damage" (2B, 3B): no damage of any source is placed on him while the stage is in play.
const CHIEFTAIN_TAKES_NO_DAMAGE: Instruction = { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: CHIEFTAIN_ANY };
// "Uruk Chieftain cannot leave the Orcs' area".
const CHIEFTAIN_STAYS: Instruction = { verb: "ModifyStat", stat: "cannotLeaveOrcsArea", amount: 1, until: "whileSourceInPlay", holders: CHIEFTAIN_ANY };
// "If you are at stage NB when this stage is defeated, you lose the game": resolved by the engine when the Orcs' stage is full, before they advance.
const LOSES = (reason: string, condition?: Cond) => ({ timing: "forced" as const, trigger: "orcsStageDefeated" as const, ...(condition ? { condition } : {}), instructions: [{ verb: "LoseGame" as const, reason }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 17038 Tamed Mûmak (an objective ally; Immune to player card effects is a keyword). The damage of an undefended attack against its controller goes on it, all of it (the combat.undefended hook reads the flag); when it leaves play its controller is eliminated.
    { id: "17038:constant:1", cardCode: MUMAK, lines: ["17038:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "undefendedToMumak", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "17038:triggered:1", cardCode: MUMAK, lines: ["17038:A:3"], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "EliminatePlayer" }] },

    // 17039 River Harnen (Immune to player card effects is a keyword). The players cannot travel here unless the stage holds 20 progress; Travel: one encounter card for each player; the stage cannot be defeated while it is in play.
    { id: "17039:constant:1", cardCode: HARNEN, lines: ["17039:A:2"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 20 } }, instructions: [{ verb: "Restrict", what: "travel" }] },
    { id: "17039:travel:1", cardCode: HARNEN, lines: ["17039:A:3"], timing: "travel", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }] },
    { id: "17039:constant:2", cardCode: HARNEN, lines: ["17039:A:4"], timing: "constant", instructions: [{ verb: "Restrict", what: "advance" }] },

    // 17040 Expanse of Harad. +2 Threat while the players are at another stage than the Orcs; after it becomes the active location each player raises their threat by 2.
    { id: "17040:constant:1", cardCode: "17040", lines: ["17040:A:1"], timing: "constant", condition: DIFFERENT, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "self" }] },
    { id: "17040:forced:1", cardCode: "17040", lines: ["17040:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

    // 17041 Blistering Erg. X is the stage number of the main quest; after it becomes the active location each player assigns X damage among the characters they control.
    {
      id: "17041:forced:1",
      cardCode: "17041",
      lines: ["17041:A:1", "17041:A:2"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [{ verb: "AssignDamage", amount: { stage: true }, pick: { type: "character", control: "you" }, who: "eachSeat" }],
    },

    // 17042 Harad Road. When Revealed it goes into the Orcs' area; Shadow: when the defending player is at another stage than the Orcs, the attacking enemy moves to the Orcs' area after the attack (a destroyed attacker is not moved).
    { id: "17042:whenRevealed:1", cardCode: "17042", lines: ["17042:A:1"], timing: "whenRevealed", instructions: [{ verb: "MoveToOrcsArea", target: "self" }] },
    { id: "17042:shadow:1", cardCode: "17042", lines: ["17042:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: DIFFERENT, instructions: [{ verb: "MoveToOrcsArea", target: "self" }] }] },

    // 17043 Uruk Pursuer. When Revealed it goes into the Orcs' area and gains surge while the players are at another stage; Shadow: at another stage it comes into play engaged with the defending player (it makes no attack this round).
    { id: "17043:whenRevealed:1", cardCode: "17043", lines: ["17043:A:1"], timing: "whenRevealed", instructions: [{ verb: "MoveToOrcsArea", target: "self" }, { verb: "GainSurge", when: DIFFERENT }] },
    { id: "17043:shadow:1", cardCode: "17043", lines: ["17043:A:2"], timing: "shadow", instructions: [{ verb: "EngageShadowCard", when: DIFFERENT }] },

    // 17044 Racing Warg (Surge is a keyword). It attaches to an Orc enemy that carries none (the first player chooses, the Orcs' area included; with no host it is discarded); a Mount attachment: +1 Threat, Attack, Defense and hit point, and it returns to the staging area when its host leaves play.
    {
      id: "17044:whenRevealed:1",
      cardCode: "17044",
      lines: ["17044:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: WARG_HOST },
        { verb: "AttachEnemyToPicked", when: { kind: "canPick", pick: WARG_HOST } },
        { verb: "MoveEncounterCard", card: "self", to: "discard", when: { kind: "not", condition: { kind: "canPick", pick: WARG_HOST } } },
      ],
    },
    {
      id: "17044:constant:1",
      cardCode: "17044",
      lines: ["17044:A:2"],
      timing: "constant",
      instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Mount" }, ...(["threat", "attack", "defense", "hitPoints"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: 1, until: "whileSourceInPlay", target: "host" }))],
    },

    // 17045 Pursuers from Mordor (Doomed 2 is a keyword). When Revealed an Orc enemy discarded from the top of the deck goes into the Orcs' area; Shadow: +1 Attack, and when the attack destroys a character 2 progress goes on the Orcs' stage.
    { id: "17045:whenRevealed:1", cardCode: "17045", lines: ["17045:A:2"], timing: "whenRevealed", instructions: ADD_AN_ORC },
    {
      id: "17045:shadow:1",
      cardCode: "17045",
      lines: ["17045:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
        { verb: "AfterAttack", instructions: [{ verb: "AddOrcsProgress", amount: 2, when: { kind: "x", min: 1 } }] },
      ],
    },

    // 17046 Howling at their Heels. When Revealed: at another stage the total Threat in the Orcs' area joins the staging area's total until the end of the phase (read live); at the same stage each enemy, a later one too, gets +1 Threat until the end of the phase. Shadow: raise your threat by 1.
    {
      id: "17046:whenRevealed:1",
      cardCode: "17046",
      lines: ["17046:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "orcsInStagingThreat", amount: 1, until: "endOfPhase", target: "table", when: DIFFERENT },
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", target: "enemies", when: SAME },
      ],
    },
    { id: "17046:shadow:1", cardCode: "17046", lines: ["17046:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: 1 }] },

    // 17047 Setting Out (stage 1). Setup: River Harnen and 1 Uruk Warg-rider wait set aside (the piles); each player takes a Tamed Mûmak, the others leave the game; the Orcs' area is created with the stages 1C to 4C and Uruk Chieftain in it (the Orcs begin at 1D).
    // Side B: each player in turn finds a different location in the encounter deck and adds it to the staging area (no reveal); the deck is shuffled; the quest advances to stage 2A.
    {
      id: "17047:setup:1",
      cardCode: "17047",
      lines: ["17047:A:1"],
      timing: "setup",
      instructions: [
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "TakeObjectiveAlly", codes: [MUMAK] }] },
        { verb: "RemoveSetAside", code: MUMAK },
        { verb: "PrepareOrcsArea", stages: ORCS_STAGES, number: 1, place: [CHIEFTAIN] },
      ],
    },
    {
      id: "17047:whenRevealed:1",
      cardCode: "17047",
      lines: ["17047:B:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "location", to: "staging", different: true, deckOnly: true }] }, { verb: "ShuffleEncounterDeck" }, { verb: "AdvanceToStage", code: "17048" }],
    },

    // 17048 Racing North (stage 2). When Revealed: the first player chooses the staging area or the Orcs' area for the set aside Uruk Warg-rider (added, not revealed). Side B: Uruk Chieftain takes no damage; the progress cap.
    {
      id: "17048:whenRevealed:1",
      cardCode: "17048",
      lines: ["17048:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "staging", instructions: [{ verb: "AddSetAsideToStaging", code: WARG_RIDER }] },
            { id: "orcsArea", instructions: [{ verb: "MoveToOrcsArea", code: WARG_RIDER }] },
          ],
        },
      ],
    },
    { id: "17048:constant:1", cardCode: "17048", lines: ["17048:B:1"], timing: "constant", instructions: [CHIEFTAIN_TAKES_NO_DAMAGE] },
    { id: "17048:forced:1", cardCode: "17048", lines: ["17048:B:2"], timing: "forced", trigger: "stagingStepBegins", instructions: PROGRESS_CAP },

    // 17049 Hunted in Harad (stage 3). When Revealed: the discard pile is shuffled into the deck and the first Orc enemy discarded goes into the Orcs' area. Side B: as 2B, and one more encounter card is revealed while the Orcs' stage is 2D and Uruk Chieftain is in the Orcs' area.
    { id: "17049:whenRevealed:1", cardCode: "17049", lines: ["17049:A:1"], timing: "whenRevealed", instructions: SHUFFLE_AND_ADD_AN_ORC },
    copyLine("17048:B:1", "17049:B:1"),
    {
      id: "17049:forced:1",
      cardCode: "17049",
      lines: ["17049:B:2"],
      timing: "forced",
      trigger: "stagingStepEnds",
      condition: { kind: "all", conditions: [{ kind: "orcsStage", at: 2 }, { kind: "canPick", pick: { ...CHIEFTAIN_ANY, inOrcsArea: true } }] },
      instructions: [{ verb: "RevealEncounter" }],
    },
    copyLine("17048:B:2", "17049:B:3"),

    // 17050 The Ford of Harnen (stage 4). When Revealed: River Harnen joins the staging area and the first Orc enemy discarded goes into the Orcs' area. Side B: the cap; after an enemy attack destroys a character 1 progress goes on the Orcs' stage; defeating it wins the game.
    { id: "17050:whenRevealed:1", cardCode: "17050", lines: ["17050:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: HARNEN }, ...SHUFFLE_AND_ADD_AN_ORC] },
    copyLine("17048:B:2", "17050:B:1"),
    { id: "17050:forced:2", cardCode: "17050", lines: ["17050:B:2"], timing: "forced", trigger: "characterDestroyedByAttack", instructions: [{ verb: "AddOrcsProgress", amount: 1 }] },
    { id: "17050:questResolution:1", cardCode: "17050", lines: ["17050:B:3"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },

    // 17051 Setting Out (the Orcs' stage 1C / 1D). Uruk Chieftain cannot leave the Orcs' area; at the end of the quest phase the Orcs make progress.
    { id: "17051:constant:1", cardCode: "17051", lines: ["17051:B:1"], timing: "constant", instructions: [CHIEFTAIN_STAYS] },
    { id: "17051:forced:1", cardCode: "17051", lines: ["17051:B:2"], ...END_OF_QUEST_PHASE, instructions: [{ verb: "OrcsProgress" }] },

    // 17052 Racing North (2C / 2D). When Revealed, when the players have defeated stage 2B, an Orc enemy discarded from the top goes into the Orcs' area. While the players are at 3B the Chieftain cannot leave the area; at the end of the quest phase he returns to it and the Orcs make progress;
    // the players lose when this stage is defeated while they are at 2B.
    { id: "17052:whenRevealed:1", cardCode: "17052", lines: ["17052:A:1"], timing: "whenRevealed", condition: DEFEATED(2), instructions: ADD_AN_ORC },
    { id: "17052:constant:1", cardCode: "17052", lines: ["17052:B:1"], timing: "constant", condition: ON_STAGE(3), instructions: [CHIEFTAIN_STAYS] },
    { id: "17052:forced:1", cardCode: "17052", lines: ["17052:B:2"], ...END_OF_QUEST_PHASE, instructions: [...RETURN_CHIEFTAIN, { verb: "OrcsProgress" }] },
    { id: "17052:forced:2", cardCode: "17052", lines: ["17052:B:3"], ...LOSES("The Orcs defeated stage 2D while the players were at stage 2B", ON_STAGE(2)) },

    // 17053 Hunted in Harad (3C / 3D). As 2C with stage 3B; while the players are at 4B the Chieftain cannot leave the area and each enemy of the Orcs' area gets +1 Threat.
    { id: "17053:whenRevealed:1", cardCode: "17053", lines: ["17053:A:1"], timing: "whenRevealed", condition: DEFEATED(3), instructions: ADD_AN_ORC },
    { id: "17053:constant:1", cardCode: "17053", lines: ["17053:B:1"], timing: "constant", condition: ON_STAGE(4), instructions: [CHIEFTAIN_STAYS] },
    {
      id: "17053:constant:2",
      cardCode: "17053",
      lines: ["17053:B:1"],
      timing: "constant",
      condition: ON_STAGE(4),
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", allInPlay: true, inOrcsArea: true } }],
    },
    copyLine("17052:B:2", "17053:B:2"),
    { id: "17053:forced:2", cardCode: "17053", lines: ["17053:B:3"], ...LOSES("The Orcs defeated stage 3D while the players were at stage 3B", ON_STAGE(3)) },

    // 17054 The Ford of Harnen (4C / 4D). The Chieftain takes no damage while River Harnen is in the staging area; at the end of the quest phase the Orcs make progress from the engaged enemies' Threat; the players lose when the Orcs defeat this stage.
    {
      id: "17054:constant:1",
      cardCode: "17054",
      lines: ["17054:B:1"],
      timing: "constant",
      condition: { kind: "canPick", pick: { type: "location", control: "any", stagingOnly: true, names: ["River Harnen"] } },
      instructions: [CHIEFTAIN_TAKES_NO_DAMAGE],
    },
    { id: "17054:forced:1", cardCode: "17054", lines: ["17054:B:2"], ...END_OF_QUEST_PHASE, instructions: [{ verb: "OrcsProgress", engaged: true }] },
    { id: "17054:forced:2", cardCode: "17054", lines: ["17054:B:3"], ...LOSES("The Orcs have caught you") },
  ],
);

export const AUTHORED_REPLACES: readonly string[] = [];
