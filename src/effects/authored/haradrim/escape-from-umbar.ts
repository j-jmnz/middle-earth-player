import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as ATTACK_ON_DOL_GULDUR } from "../standalone-scenarios/attack-on-dol-guldur.ts";
import { AUTHORED_EFFECTS as MINES } from "../standalone-scenarios/the-mines-of-moria.ts";
import { AUTHORED_EFFECTS as BLACK_GATE_OPENS } from "../return-of-the-king/the-black-gate-opens.ts";
import { AUTHORED_EFFECTS as THE_RING_GOES_SOUTH } from "../the-ring-goes-south.ts";
import { AUTHORED_EFFECTS as ESCAPE_FROM_KHAZAD_DUM } from "../standalone-scenarios/escape-from-khazad-dum.ts";
import { AUTHORED_EFFECTS as WIZARDS_QUEST } from "../standalone-scenarios/the-wizards-quest.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Escape from Umbar (haradrim cycle part 1, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. See docs/scenarios/haradrim/escape-from-umbar.md, Readings, for each reading.
// Rules: hrd.setup-escape-from-umbar, hrd.archery, hrd.side-quests, hrd.encounter-side-quests, hrd.side-quests-in-play, hrd.current-quest, rr.forced, rr.travel, rr.cannot, rr.first-player, rr.engaged, rr.search, rr.shadow-effects, rr.in-play-and-out-of-play, rr.lasting-effects, rr.constant-ability, rr.response (data/rules/entries.json).
type Cond = NonNullable<Effect["condition"]>;
type Instruction = Effect["instructions"][number];
type Option = Extract<Instruction, { verb: "Choose" }>["options"][number];

const MAIN_QUEST_PROGRESS = { stat: "progress", of: "questStage" } as const;
// The Champion of Southron Champion (16040) is the enemy that holds its resource token (the card places one on it), in the staging area or engaged.
const CHAMPION: PickSpec = { type: "enemy", control: "any", staging: true, hasResources: true };
const CHAMPION_IN_PLAY: Cond = { kind: "canPick", pick: CHAMPION };
// "A player is engaged with an enemy": the same two picks the Lost in Mirkwood stage 18077:B:2 reads.
const SOME_PLAYER_ENGAGED: Cond = { kind: "any", conditions: [{ kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you" } }, { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "other" } }] };
// The enemy the encounter deck's discards found, when one was found: the card picked is out of the deck and not yet in play.
const FOUND_HARAD: Cond = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Harad" }, inPlay: false };
// "Then, place 1 progress": only once the search found a Harad enemy and put it into play (rr.then).
const FOUND_HARAD_IN_PLAY: Cond = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Harad" } };
const FOUND_ENEMY: Cond = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false };
// "Starting with the first player, each player discards cards from the top of the encounter deck until he discards an enemy, and puts that enemy into play engaged with him": the discard pile is shuffled back into an empty deck (faq.last-encounter-card).
const DISCARD_AN_ENEMY_AND_ENGAGE: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"] = [
  { verb: "DiscardUntil", type: "enemy", reshuffle: true },
  { verb: "MoveEncounterCard", card: "picked", to: "engaged", when: FOUND_ENEMY },
];
// The Southron Soldier, Southron Archer and Umbar Sentry choices: the option that takes progress off the main quest needs some on it.
const PROGRESS_OPTION = (amount: number): Option => ({ id: "progress", requires: { kind: "stageProgress", min: 1 }, instructions: [{ verb: "RemoveProgressFromQuest", amount }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 16066 Stranded in Umbar. Setup (the staging pile holds "Seize Them!" and the Umbar locations stay in the encounter deck for this search): each player in turn takes a location whose title no earlier player took and puts a copy of Umbar Sentry into play engaged with him.
    {
      id: "16066:setup:1",
      cardCode: "16066",
      lines: ["16066:A:1"],
      timing: "setup",
      instructions: [
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "location", to: "staging", different: true, deckOnly: true }, { verb: "SearchMove", type: "enemy", code: "16015", to: "engaged", deckOnly: true }] },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    // 16066:B:1 and 16067:B:1: "This stage cannot have more than 15 progress tokens on it": the stage takes no more than its quest points even while it cannot advance (flag `stageCapped`, read by putOnStage).
    { id: "16066:constant:1", cardCode: "16066", lines: ["16066:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "stageCapped", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    // 16066:B:2: the players cannot defeat the stage while a player is engaged with an enemy.
    { id: "16066:constant:2", cardCode: "16066", lines: ["16066:B:2"], timing: "constant", condition: SOME_PLAYER_ENGAGED, instructions: [{ verb: "Restrict", what: "advance" }] },

    copyLine("16066:B:1", "16067:B:1"),

    // 16067 Flee the City. When Revealed: the phase ends once the effect has finished; the encounter discard pile is shuffled into the deck; each player, starting with the first, discards until an enemy and puts it into play engaged with him.
    {
      id: "16067:whenRevealed:1",
      cardCode: "16067",
      lines: ["16067:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "EndPhase" }, { verb: "ShuffleEncounterDiscard" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: DISCARD_AN_ENEMY_AND_ENGAGE }],
    },
    // 16067:B:2: once at the beginning of each quest phase, when some player is not engaged, one enemy (not one for each player) is discarded from the deck and added to the staging area.
    {
      id: "16067:forced:1",
      cardCode: "16067",
      lines: ["16067:B:2"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "playerUnengaged" }] },
      instructions: [{ verb: "DiscardUntil", type: "enemy", reshuffle: true }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: FOUND_ENEMY }],
    },
    // 16067:B:3: the players cannot defeat the stage while a player is engaged with an enemy; defeating it wins the game (the last stage: no stage follows).
    { id: "16067:constant:2", cardCode: "16067", lines: ["16067:B:3"], timing: "constant", condition: SOME_PLAYER_ENGAGED, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 16014 "Seize Them!". Forced: after an enemy attacks and destroys a character, X progress comes off the main quest, X the attacking enemy's current Threat.
    {
      id: "16014:forced:1",
      cardCode: "16014",
      lines: ["16014:A:1"],
      timing: "forced",
      trigger: "characterDestroyedByAttack",
      subject: { type: "character", control: "any" },
      condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any" } },
      instructions: [{ verb: "RemoveProgressFromQuest", amount: { stat: "threat", of: "other" } }],
    },
    // 16014:A:2: at the end of the round, the players lose when the main quest card has been in play the whole round and holds no progress (condition `stageInPlayWholeRound`, noted by the haradrim settle hook).
    {
      id: "16014:triggered:1",
      cardCode: "16014",
      lines: ["16014:A:2"],
      timing: "triggered",
      trigger: "endOfRound",
      condition: { kind: "all", conditions: [{ kind: "stageInPlayWholeRound" }, { kind: "less", left: MAIN_QUEST_PROGRESS, right: 1 }] },
      instructions: [{ verb: "LoseGame", reason: "The main quest held no progress at the end of a round it had been in play for" }],
    },

    // 16015 Umbar Sentry. Forced: when it attacks, the player it attacks takes the choice: 1 progress off the main quest (only when there is some), or +2 Attack for this attack.
    {
      id: "16015:forced:1",
      cardCode: "16015",
      lines: ["16015:A:2"],
      timing: "forced",
      trigger: "attacks",
      subject: "self",
      instructions: [{ verb: "Choose", who: "actor", options: [PROGRESS_OPTION(1), { id: "attack", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "self" }] }] }],
    },

    // 16016 Narrow Alleyway. Response: after the players travel here, the first player chooses a non-unique enemy engaged with a player; it goes faceup under the location, out of play.
    {
      id: "16016:response:1",
      cardCode: "16016",
      lines: ["16016:A:1"],
      timing: "response",
      trigger: "traveled",
      subject: "self",
      condition: { kind: "canPick", pick: { type: "enemy", control: "any", nonUnique: true, who: "firstPlayer" } },
      instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", nonUnique: true, who: "firstPlayer" } }, { verb: "PlaceUnderSelfFaceup" }],
    },
    // 16016:A:2: after it leaves play, the enemy under it is put into play engaged with the first player, who is then engaged by it (146029:A:2's verb).
    { id: "16016:forced:1", cardCode: "16016", lines: ["16016:A:2"], timing: "forced", trigger: "leftPlay", instructions: [{ verb: "ReturnUnderToStaging", to: "engaged" }] },

    // 16017 Umbar Street. While it is the active location each enemy gets -1 engagement cost for each progress token on the main quest.
    {
      id: "16017:constant:1",
      cardCode: "16017",
      lines: ["16017:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: { ...MAIN_QUEST_PROGRESS, negative: true }, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }],
    },
    copyLine("50919:A:3", "16017:A:2"),

    // 16018 Umbar Square. While active, it gains a Response: after an enemy is defeated, 1 progress goes on the main quest, past the active location (AddStageProgress puts it on the main quest card itself).
    {
      id: "16018:response:1",
      cardCode: "16018",
      lines: ["16018:A:1"],
      timing: "response",
      trigger: "enemyDestroyed",
      subject: { type: "enemy", control: "any", staging: true },
      anyPlayer: true,
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "AddStageProgress", amount: 1 }],
    },

    // 16019 Port of Harad. X is the number of enemies engaged with any player; the travel cost assigns X damage among the characters in play (the first player assigns it).
    { id: "16019:constant:1", cardCode: "16019", lines: ["16019:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "enemy", control: "any" } }, until: "whileSourceInPlay", target: "self" }] },
    { id: "16019:travel:1", cardCode: "16019", lines: ["16019:A:2"], timing: "travel", instructions: [{ verb: "AssignDamage", amount: { count: { type: "enemy", control: "any" } }, pick: { type: "character", control: "any" } }] },

    // 16020 Haradrim Estate. Travel: the first player searches the deck and discard pile for a Harad enemy and puts it into play engaged with him (the cost is paid with none found), then, only when one was found, 1 progress goes on the main quest past the active location, then the deck is shuffled.
    copyLine("51228:A:1", "16020:A:1"),
    {
      id: "16020:travel:1",
      cardCode: "16020",
      lines: ["16020:A:2"],
      timing: "travel",
      instructions: [{ verb: "SearchMove", trait: "Harad", type: "enemy", to: "engaged", remember: true }, { verb: "AddStageProgress", amount: 1, when: FOUND_HARAD_IN_PLAY }, { verb: "ShuffleEncounterDeck" }],
    },

    // 16021 Enemy Pursuit. When Revealed: the first player chooses: all progress comes off the main quest, or X damage is assigned among the characters in play, X the progress on the main quest (with none, nothing can be done).
    {
      id: "16021:whenRevealed:1",
      cardCode: "16021",
      lines: ["16021:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "remove", requires: { kind: "stageProgress", min: 1 }, instructions: [{ verb: "RemoveAllProgress", target: "questStage" }] },
            { id: "damage", requires: { kind: "stageProgress", min: 1 }, instructions: [{ verb: "AssignDamage", amount: MAIN_QUEST_PROGRESS, pick: { type: "character", control: "any" } }] },
          ],
        },
      ],
    },
    copyLine("50926:A:3", "16021:A:2"),

    // 16040 Southron Champion (encounter side quest, 4 quest points, Victory 10). When Revealed: discard until a Harad enemy, add it to the staging area with a resource token (the Champion); while this stage is in play it gets +2 Threat, Attack and Defense and is immune to player card effects.
    {
      id: "16040:whenRevealed:1",
      cardCode: "16040",
      lines: ["16040:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "DiscardUntil", type: "enemy", trait: "Harad", reshuffle: true },
        { verb: "MoveEncounterCard", card: "picked", to: "staging", when: FOUND_HARAD },
        { verb: "PlaceResourceTokens", amount: 1, on: "picked", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Harad" } } },
        ...(["threat", "attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: 2, until: "whileSourceInPlay", target: "picked", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Harad" } } })),
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "picked", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Harad" } } },
      ],
    },
    // 16040:A:2: the Champion takes no damage while this stage holds fewer than 4 progress; this stage cannot be defeated while the Champion is in play. A Restrict on advancing holds every stage at once, so the same record also keeps the main quest stage from being defeated while the Champion is in play, the second sentence of the text the Champion gains (16040:A:1); the side quest is held by families/sidequests/quest.ts.
    {
      id: "16040:constant:1",
      cardCode: "16040",
      lines: ["16040:A:2"],
      timing: "constant",
      condition: { kind: "less", left: { stat: "progress", of: "self" }, right: 4 },
      instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: CHAMPION }],
    },
    { id: "16040:constant:2", cardCode: "16040", lines: ["16040:A:2"], timing: "constant", condition: CHAMPION_IN_PLAY, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 16041 Southron Captain. In the staging area each other Harad enemy gets +1 Threat; engaged with you, each other Harad enemy engaged with you gets +1 Attack.
    {
      id: "16041:constant:1",
      cardCode: "16041",
      lines: ["16041:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, trait: "Harad", other: true } }],
    },
    {
      id: "16041:constant:2",
      cardCode: "16041",
      lines: ["16041:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "engaged" },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", engaged: "you", trait: "Harad", other: true } }],
    },

    // 16042 Southron Soldier. Forced: after it engages you (also put into play engaged), either 2 progress off the main quest or it makes an immediate attack. The Shadow effect is Onslaught of Mordor's (146040:A:2), the first player chooses (rr.the-word-choose).
    {
      id: "16042:forced:1",
      cardCode: "16042",
      lines: ["16042:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "Choose", who: "actor", options: [PROGRESS_OPTION(2), { id: "attack", instructions: [{ verb: "ImmediateAttack" }] }] }],
    },
    copyLine("146040:A:2", "16042:A:2"),

    // 16043 Southron Archer. Forced: after it engages you, either 2 progress off the main quest or discard an ally you control.
    {
      id: "16043:forced:1",
      cardCode: "16043",
      lines: ["16043:A:2"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [PROGRESS_OPTION(2), { id: "ally", requires: { kind: "canPick", pick: { type: "ally", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] }],
        },
      ],
    },

    // 16044 Nowhere to Hide. When Revealed: the first player discards until an enemy and puts it into play engaged with him (the discard pile is shuffled back into an empty deck).
    { id: "16044:whenRevealed:1", cardCode: "16044", lines: ["16044:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", limit: 1, instructions: DISCARD_AN_ENEMY_AND_ENGAGE }] },
    copyLine("142026:A:3", "16044:A:2"),

    // 16045 In Enemy Territory (encounter side quest, 8 quest points, Victory 10, Surge). While in the staging area no player holds more than 5 cards: the table holds the limit, and a hand over it discards down to it at once (families/haradrim/hand.ts).
    { id: "16045:constant:1", cardCode: "16045", lines: ["16045:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "handLimit", amount: 5, until: "whileSourceInPlay", target: "table" }] },
    { id: "16045:triggered:1", cardCode: "16045", lines: ["16045:A:2"], timing: "triggered", trigger: "handOverLimit", instructions: [{ verb: "DiscardFromHand", amount: { hand: true, plus: -5 } }] },
    // 16045:A:3: when it is defeated, each player draws a card (optional, offered to the first player).
    { id: "16045:response:1", cardCode: "16045", lines: ["16045:A:3"], timing: "response", trigger: "questDefeated", subject: "self", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", amount: 1 }] }] },

    // 16046 Injured Companion: When Revealed and Shadow are copies.
    copyLine("51323:A:1", "16046:A:1"),
    copyLine("51030:A:2", "16046:A:2"),

    // 16047 Enfeebled. When Revealed: each player exhausts a character he controls; until the end of the combat phase no character readies (the class holder reads player card effects, the only readying of the combat phase). Shadow: the defender cannot ready until the end of the round.
    {
      id: "16047:whenRevealed:1",
      cardCode: "16047",
      lines: ["16047:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] },
        { verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "endOfCombat", target: "characters" },
      ],
    },
    { id: "16047:shadow:1", cardCode: "16047", lines: ["16047:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },
  ],
  { pool: [...ATTACK_ON_DOL_GULDUR, ...MINES, ...BLACK_GATE_OPENS, ...THE_RING_GOES_SOUTH, ...ESCAPE_FROM_KHAZAD_DUM, ...WIZARDS_QUEST] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
