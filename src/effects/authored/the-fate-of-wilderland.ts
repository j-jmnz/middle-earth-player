import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as BREAKING } from "./breaking-of-the-fellowship.ts";
import { AUTHORED_EFFECTS as THE_CITY_OF_CORSAIRS } from "./the-city-of-corsairs.ts";
import { AUTHORED_EFFECTS as THE_WITHERED_HEATH } from "./the-withered-heath.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The Fate of Wilderland (Ered Mithrin part 9, campaign card 12195): the three stages, Urdug and the two objectives that decide the fight (The Goblins' Assault, The Heroes' Defense), the cards of the scenario's own encounter set and the campaign card.
// Every line is read from the scan ledger (data/printed/ered-mithrin.json); a line a template already writes (pnpm data:build) or another card prints word for word needs no record here. The piles place the two objectives and Urdug in the staging area.
// The players lose by progress on The Goblins' Assault (stage 3) and win when Urdug is destroyed. A win ends the campaign (12195:B:1).
// Rules: emce.campaign-log, emce.boon-allies, emce.treasure, emce.deep, emce.discover, rr.engaged, rr.immune, rr.guarded, rr.explored, rr.search, rr.quest-advancement (data/rules/entries.json).
const ASSAULT = "The Goblins' Assault";
const DEFENSE = "The Heroes' Defense";
const URDUG = "Urdug";
const GOBLIN_TROOP = "18020";
// The objectives and Urdug wherever they are in play (the staging area; Urdug may be engaged).
const ASSAULT_PICK: PickSpec = { type: "objective", control: "any", staging: true, names: [ASSAULT] };
const DEFENSE_PICK: PickSpec = { type: "objective", control: "any", staging: true, names: [DEFENSE] };
const URDUG_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: [URDUG] };
const ENEMIES_IN_PLAY: PickSpec = { type: "enemy", control: "any", staging: true };
const ENEMIES_STAGED: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const GATE_IN_STAGING: Condition = { kind: "canPick", pick: { type: "location", control: "any", stagingOnly: true, names: ["Gate of Gundabad"] } };
// The instructions a Choose option holds.
type Simple = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"];
// "place N progress on The Goblins' Assault" (amount: a number or an amount the record reads). The two simple instructions fit a Choose option, an AfterAttack and a Delay alike.
const PROGRESS_ON_ASSAULT = (amount: Extract<Instruction, { verb: "PlaceProgressOn" }>["amount"], when?: Condition) => [
  { verb: "Pick" as const, pick: ASSAULT_PICK, ...(when ? { when } : {}) },
  { verb: "PlaceProgressOn" as const, amount, target: "picked" as const, ...(when ? { when } : {}) },
];
// "If this attack destroys a character, place 1 progress on The Goblins' Assault": the effect an attack leaves for its end, with the characters destroyed as X.
const ATTACK_DESTROYED: Condition = { kind: "x", min: 1 };
const AFTER_ATTACK_PROGRESS: Instruction = { verb: "AfterAttack", instructions: PROGRESS_ON_ASSAULT(1, ATTACK_DESTROYED) };
// "X or more progress on The Goblins' Assault": the progress is higher than X - 1. X is `base` plus `perPlayer` for each player.
const ASSAULT_REACHES = (base: number, perPlayer: number): Condition => ({ kind: "less", left: { players: true, times: perPlayer, plus: base - 1 }, right: { stat: "progress", ofNamed: ASSAULT } });
// "Either exhaust a character you control, or place 1 progress on The Goblins' Assault" and its kin: the player the card engaged chooses.
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const EITHER_OR_PROGRESS = (id: string, instructions: Simple, requires?: Condition): Instruction => ({
  verb: "Choose",
  who: "actor",
  options: [{ id, ...(requires ? { requires } : {}), instructions }, { id: "progress", instructions: PROGRESS_ON_ASSAULT(1) }],
});
// "Shuffle the encounter discard pile into the encounter deck and discard cards from the top until X enemies are discarded, where X is the number of players. Add those enemies to the staging area." (19169:A:1, 19170:A:1)
const MUSTER: Instruction[] = [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 12195 The Fate of Wilderland (campaign card). Setup: each player may search their deck for a boon or treasure card and add it to their hand (after the mulligan); with Turayn's line 3 non-unique enemies leave the encounter deck, with Beldis's 3 treacheries.
    // Ignore the Deep and Discover keywords. Resolution: the players win the campaign (12195:B:1 is copied below; the campaign ends with this part).
    {
      id: "12195:campaignSetup:1",
      cardCode: "12195",
      lines: ["12195:A:2"],
      timing: "campaignSetup",
      instructions: [
        { verb: "SearchBoonOrTreasureToHand" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "turayn", count: 3, cardType: "enemy", nonUnique: true },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "beldis", count: 3, cardType: "treachery" },
      ],
    },
    { id: "12195:constant:1", cardCode: "12195", lines: ["12195:A:3"], timing: "constant", instructions: [{ verb: "IgnoreKeyword", keywords: ["deep", "discover"] }] },
    copyLine("11215:B:4", "12195:B:1"),

    // 19155 The Goblins' Assault (objective). Urdug gets +2 Defense for each other enemy in play, and takes no damage unless he has resolved an attack this phase. After the players quest unsuccessfully (once, whatever the number of players)
    // it gets 1 progress for each player.
    {
      id: "19155:constant:1",
      cardCode: "19155",
      lines: ["19155:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "defense", amount: { count: ENEMIES_IN_PLAY, times: 2, plus: -2 }, until: "whileSourceInPlay", holders: URDUG_ENEMY }],
    },
    {
      id: "19155:constant:2",
      cardCode: "19155",
      lines: ["19155:A:1"],
      timing: "constant",
      condition: { kind: "not", condition: { kind: "attackedThisPhase", name: URDUG } },
      instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: URDUG_ENEMY }],
    },
    { id: "19155:forced:1", cardCode: "19155", lines: ["19155:A:2"], timing: "forced", trigger: "questFailed", limit: "oncePerRound", instructions: [{ verb: "PlaceProgressOn", amount: { players: true }, target: "self" }] },

    // 19156 The Heroes' Defense (objective). With 5 resources for each player on it Urdug is considered engaged with each player, as the Watcher in the Water is (he adds no Threat to the staging area, rr.engaged). Response: after an enemy is destroyed
    // it gets 1 resource (the flag Gate of Gundabad sets bars it).
    {
      id: "19156:constant:1",
      cardCode: "19156",
      lines: ["19156:A:1"],
      timing: "constant",
      condition: { kind: "less", left: { players: true, times: 5, plus: -1 }, right: { stat: "resources", of: "self" } },
      instructions: [
        { verb: "ModifyStat", stat: "engagedWithAll", amount: 1, until: "whileSourceInPlay", holders: URDUG_ENEMY },
        { verb: "ModifyStat", stat: "noThreatContribution", amount: 1, until: "whileSourceInPlay", holders: URDUG_ENEMY },
        { verb: "ModifyStat", stat: "attackableByAny", amount: 1, until: "whileSourceInPlay", holders: URDUG_ENEMY },
      ],
    },
    { id: "19156:response:1", cardCode: "19156", lines: ["19156:A:2"], timing: "response", trigger: "enemyDestroyed", subject: ENEMIES_IN_PLAY, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },

    // 19157 Urdug (immune to player card effects is a keyword). He cannot leave the staging area. Forced: when he attacks, the top card of the encounter deck is discarded and its printed Threat is added to his Attack for this attack. When he is destroyed
    // the players win the game.
    { id: "19157:constant:1", cardCode: "19157", lines: ["19157:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "19157:forced:1",
      cardCode: "19157",
      lines: ["19157:A:2"],
      timing: "forced",
      trigger: "attacks",
      subject: "self",
      instructions: [{ verb: "DiscardEncounterTop", count: 1 }, { verb: "ModifyStat", stat: "attack", amount: { stat: "threat", of: "discardTop", printed: true }, until: "endOfAttack", target: "self" }],
    },
    { id: "19157:triggered:1", cardCode: "19157", lines: ["19157:A:3"], timing: "triggered", trigger: "enemyDestroyed", subject: "self", instructions: [{ verb: "WinGame" }] },

    // 19158 Urdug's Elite. After it engages you, you either exhaust a character you control or place 1 progress on The Goblins' Assault. Shadow: exhaust a character you control (copied).
    {
      id: "19158:forced:1",
      cardCode: "19158",
      lines: ["19158:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [EITHER_OR_PROGRESS("exhaust", [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }], { kind: "canPick", pick: READY_CHARACTER })],
    },
    copyLine("19020:A:3", "19158:A:2"),

    // 19159 Fierce Vanguard. After it engages you, it gets +2 Attack until the end of the round or The Goblins' Assault gets 1 progress. Shadow: the attacker gets +2 Attack and +2 Defense until the end of the phase.
    {
      id: "19159:forced:1",
      cardCode: "19159",
      lines: ["19159:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [EITHER_OR_PROGRESS("attack", [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfRound", target: "self" }])],
    },
    {
      id: "19159:shadow:1",
      cardCode: "19159",
      lines: ["19159:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", target: "attacker" },
        { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "attacker" },
      ],
    },

    // 19160 Warg-rider. After it is dealt a shadow card with no effect, the player it attacked either returns it to the staging area or places 1 progress on The Goblins' Assault.
    {
      id: "19160:forced:1",
      cardCode: "19160",
      lines: ["19160:A:1"],
      timing: "forced",
      trigger: "attackResolved",
      subject: "self",
      condition: { kind: "shadowBlank" },
      instructions: [EITHER_OR_PROGRESS("staging", [{ verb: "ReturnToStaging", target: { kind: "self" } }])],
    },

    // 19161 Gate of Gundabad (Immune to player card effects is a keyword). While it is in the staging area resources cannot be placed on The Heroes' Defense. Travel: the encounter deck, its discard pile and the victory display are searched for a Goblin Troop,
    // which is added to the staging area, and the encounter deck is shuffled.
    {
      id: "19161:constant:1",
      cardCode: "19161",
      lines: ["19161:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "noResourcesPlaced", amount: 1, until: "whileSourceInPlay", holders: DEFENSE_PICK }],
    },
    { id: "19161:travel:1", cardCode: "19161", lines: ["19161:A:3"], timing: "travel", instructions: [{ verb: "SearchStageCard", code: GOBLIN_TROOP }, { verb: "ShuffleEncounterDeck" }] },

    // 19162 Hilltop Battlements. While it is in the staging area each non-unique enemy gets -5 engagement cost. When it is explored the top X cards of the encounter deck are discarded, X the number of players, and each enemy among them is added to the staging area.
    {
      id: "19162:constant:1",
      cardCode: "19162",
      lines: ["19162:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -5, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, nonUnique: true } }],
    },
    {
      id: "19162:forced:1",
      cardCode: "19162",
      lines: ["19162:A:2"],
      timing: "forced",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [{ verb: "DiscardEncounterTop", count: { players: true } }, { verb: "StageDiscarded", type: "enemy" }],
    },

    // 19163 Dwarven Watchtower. While it is the active location each hero gets +1 Defense. Response: after it is explored the first player either places 1 resource on The Heroes' Defense (not while Gate of Gundabad bars it) or removes 1 progress from The Goblins' Assault.
    {
      id: "19163:constant:1",
      cardCode: "19163",
      lines: ["19163:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "heroes" }],
    },
    {
      id: "19163:response:1",
      cardCode: "19163",
      lines: ["19163:A:2"],
      timing: "response",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "resource", requires: { kind: "not", condition: GATE_IN_STAGING }, instructions: [{ verb: "PlaceResourcesOnNamed", amount: 1, named: DEFENSE }] },
            { id: "progress", requires: { kind: "less", left: 0, right: { stat: "progress", ofNamed: ASSAULT } }, instructions: [{ verb: "RemoveProgressFrom", amount: 1, named: ASSAULT }] },
          ],
        },
      ],
    },

    // 19164 Slopes of Gundabad. When Revealed: the player either places 1 progress on The Goblins' Assault or reveals an additional encounter card. Shadow: the attacker cannot take damage this phase.
    {
      id: "19164:whenRevealed:1",
      cardCode: "19164",
      lines: ["19164:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "progress", instructions: PROGRESS_ON_ASSAULT(1) }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
    },
    { id: "19164:shadow:1", cardCode: "19164", lines: ["19164:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfPhase", target: "attacker" }] },

    // 19165 Fierce Attack (Doomed 1 is a keyword). When Revealed: X progress on The Goblins' Assault, X the stage number of the main quest. Shadow: the attacker gets +X Attack.
    { id: "19165:whenRevealed:1", cardCode: "19165", lines: ["19165:A:2"], timing: "whenRevealed", instructions: PROGRESS_ON_ASSAULT({ stage: true }) },
    { id: "19165:shadow:1", cardCode: "19165", lines: ["19165:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stage: true }, until: "endOfAttack", target: "attacker" }] },

    // 19166 Urdug's Command. When Revealed: Urdug makes an immediate attack against the first player; if it destroys a character The Goblins' Assault gets 1 progress. Shadow: the attacker gets +1 Attack, and the same if its attack destroys a character.
    {
      id: "19166:whenRevealed:1",
      cardCode: "19166",
      lines: ["19166:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: URDUG_ENEMY }, { verb: "AttackFromStaging", who: "firstPlayer" }, AFTER_ATTACK_PROGRESS],
    },
    { id: "19166:shadow:1", cardCode: "19166", lines: ["19166:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, AFTER_ATTACK_PROGRESS] },

    // 19167 Dark Clouds. When Revealed: each enemy and each location in the staging area gets +1 Threat until the end of the phase (an encounter card's lasting effect: the cards that arrive there later get it too); if the players quest unsuccessfully this phase, The Goblins' Assault gets 1 progress. Shadow: discard a non-objective attachment (copied).
    {
      id: "19167:whenRevealed:1",
      cardCode: "19167",
      lines: ["19167:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", target: "stagingCards" },
        { verb: "Delay", until: "questFailed", instructions: PROGRESS_ON_ASSAULT(1) },
      ],
    },
    copyLine("142071:A:3", "19167:A:2"),

    // 19168 Urdug's Assault (stage 1). Setup: the objectives and Urdug are placed by the piles; the encounter deck is shuffled and cards are discarded from its top until X enemies, X the number of players, are discarded; they are added to the staging area.
    // Side B: at the end of the round The Goblins' Assault gets 1 progress for each enemy in the staging area, then the stage advances with 2 progress plus 2 for each player on it.
    { id: "19168:setup:1", cardCode: "19168", lines: ["19168:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }] },
    {
      id: "19168:forced:1",
      cardCode: "19168",
      lines: ["19168:B:1"],
      timing: "forced",
      trigger: "endOfRound",
      instructions: [...PROGRESS_ON_ASSAULT({ count: ENEMIES_STAGED }), { verb: "AdvanceStage", when: ASSAULT_REACHES(2, 2) }],
    },

    // 19169 Outflanked (stage 2). When Revealed: the discard pile is shuffled into the encounter deck and X enemies are discarded from its top into the staging area. Side B: after an enemy attacks The Goblins' Assault gets 1 progress; at the end of the round
    // the stage advances with 4 progress plus 4 for each player on it.
    { id: "19169:whenRevealed:1", cardCode: "19169", lines: ["19169:A:1"], timing: "whenRevealed", instructions: MUSTER },
    { id: "19169:forced:1", cardCode: "19169", lines: ["19169:B:1"], timing: "forced", trigger: "attackResolved", subject: ENEMIES_IN_PLAY, instructions: PROGRESS_ON_ASSAULT(1) },
    { id: "19169:forced:2", cardCode: "19169", lines: ["19169:B:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "AdvanceStage", when: ASSAULT_REACHES(4, 4) }] },

    // 19170 The Final Push (stage 3). When Revealed: as Outflanked. Side B: at the end of the round The Goblins' Assault gets 1 progress for each enemy in play; with 8 progress plus 8 for each player on it the players lose the game.
    { id: "19170:whenRevealed:1", cardCode: "19170", lines: ["19170:A:1"], timing: "whenRevealed", instructions: MUSTER },
    {
      id: "19170:forced:1",
      cardCode: "19170",
      lines: ["19170:B:1"],
      timing: "forced",
      trigger: "endOfRound",
      instructions: [...PROGRESS_ON_ASSAULT({ count: ENEMIES_IN_PLAY }), { verb: "LoseGame", reason: "The Goblins' Assault holds as much progress as the players can bear", when: ASSAULT_REACHES(8, 8) }],
    },
  ],
  { pool: [...THE_CITY_OF_CORSAIRS, ...THE_WITHERED_HEATH, ...BREAKING] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
