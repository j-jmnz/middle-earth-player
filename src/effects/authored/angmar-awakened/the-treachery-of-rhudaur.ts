import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as DIKE } from "./deadmens-dike.ts";
import { AUTHORED_EFFECTS as ETTENMOORS } from "./across-the-ettenmoors.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Treachery of Rhudaur (Angmar Awakened part 7, campaign card 10184): the two quest stages, the Great Hall, Thaurdir and Amarthiúl, the encounter cards no template reads, the three side quests and their Clue objectives, the campaign card's Resolution and the three Clue boons.
// Every line is read from the scan ledger (data/printed/angmar-awakened.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The three side quests lie in the staging area quest side up; their other side is the Clue objective each
// flips into when defeated (families/angmar/stage.ts). The vocabulary the box added is in src/catalog/families/angmar.ts.
// Rules: mec108.side-quests, mec108.side-quests-in-play, mec108.the-investigation, mec108.time-x, mec108.objective-allies, mec108.indestructible, mec108.campaign-mode, rr.attachment-cards, rr.travel, rr.first-player, rr.forced, rr.effects, rr.the-word-choose,
// rr.running-out-of-cards, rr.surge, rr.doomed-x, rr.explored, rr.quest-advancement, rr.constant-ability, rr.campaign-pool, faq.last-encounter-card, faq.progress-without-advancing, faq.additional-attacks, faq.enemy-attacks-outside-combat, faq.simultaneous-effects (data/rules/entries.json).
const THAURDIR = "10098";
const DETERMINATION = "10172";
const TR_TITLES = ["Quiet the Spirits", "Sift through the Debris", "Decipher Ancient Texts"];
const CLUES = [
  { clue: "10110", boon: "10185", title: "Daechanar's Brand" },
  { clue: "10112", boon: "10186", title: "Heirloom of Iârchon" },
  { clue: "10114", boon: "10187", title: "Orders from Angmar" },
];

const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// A Clue objective the actor controls (claimed, attached to one of their characters, Amarthiúl included while they control him), and one any player does.
const MY_CLUE: PickSpec = { type: "objective", control: "you", trait: "Clue" };
const ANY_CLUE: PickSpec = { type: "objective", control: "any", trait: "Clue", controlled: true };
const HAS_CLUE: Condition = { kind: "canPick", pick: MY_CLUE };
const NO_CLUE: Condition = { kind: "not", condition: HAS_CLUE };
const UNDEAD: PickSpec = { type: "enemy", control: "any", trait: "Undead", staging: true };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const HERO_READY: PickSpec = { type: "hero", control: "you", state: "ready" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const AMARTHIUL_READY: PickSpec = { type: "character", control: "you", state: "ready", names: ["Amarthiúl"] };
// Progress placed on this very side quest (a quest card in play, so Forbidden Descent may take it, 10101:A:1).
const SELF_QUEST = (title: string): Instruction[] => [{ verb: "Pick", pick: { type: "card", control: "any", questCard: true, names: [title] } }];
// Attached character: +1 (+2 instead against Undead) in the stat, written as the +1 and one more against Undead. 10112's +1 Willpower is the build's template.
const ATTACKING_UNDEAD: Condition = { kind: "attacking", card: "host", enemy: { type: "enemy", control: "any", trait: "Undead" } };
const HOST_STAT = (stat: "attack" | "defense", amount: number, when?: Condition): Instruction => ({ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "host", ...(when ? { when } : {}) });

// "Action: Exhaust Amarthiúl or a hero to claim <Clue>. Then, attach it to that character." Any player may; the Clue stays an objective and is controlled by the player who claimed it.
const claim = (code: string): Effect => ({
  id: `${code}:action:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "action",
  anyPlayer: true,
  condition: { kind: "all", conditions: [IN_STAGING, { kind: "canPick", pick: READY_CHARACTER }] },
  instructions: [
    {
      verb: "Choose",
      who: "actor",
      options: [
        { id: "hero", requires: { kind: "canPick", pick: HERO_READY }, instructions: [{ verb: "Pick", pick: HERO_READY }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }] },
        { id: "amarthiul", requires: { kind: "canPick", pick: AMARTHIUL_READY }, instructions: [{ verb: "Pick", pick: AMARTHIUL_READY }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }] },
      ],
    },
  ],
});

// A side quest's "When this quest is defeated, flip it over" (the marker families/sidequests/quest.ts reads).
const flipsInto = (code: string, line: string, into: string, n: number): Effect => ({ id: `${code}:constant:${n}`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "FlipWhenDefeated", into }] });

// Shadow of Eerie Halls, Centuries of Sorrow and Curse of the Years: the effect when the defending player controls no Clue.
const ATTACKER_PLUS = (amount: number, when?: Condition): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", ...(when ? { when } : {}) });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 10094 Secrets of Rhudaur (stage 1). Setup: Amarthiúl is put into play under the first player (the Great Hall, the three side quests, the Ancient Causeway and Thaurdir's place are the piles'). Side B: Time 5; when the last counter comes off, each Treachery of Rhudaur side quest still quest side up
    // leaves the game and the quest advances; it cannot be chosen as the current quest in the quest phase; and when no such side quest is in play it advances at once.
    { id: "10094:setup:1", cardCode: "10094", lines: ["10094:A:1"], timing: "setup", instructions: [{ verb: "PutSetAsideInPlay", name: "Amarthiúl", to: "firstPlayer" }] },
    { id: "10094:constant:1", cardCode: "10094", lines: ["10094:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 5 }] },
    { id: "10094:forced:1", cardCode: "10094", lines: ["10094:B:2"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [{ verb: "RemoveSideQuestsFromGame", names: TR_TITLES }, { verb: "AdvanceStage" }] },
    { id: "10094:constant:2", cardCode: "10094", lines: ["10094:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeCurrentQuest", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "10094:constant:3",
      cardCode: "10094",
      lines: ["10094:B:4"],
      timing: "constant",
      condition: { kind: "count", pick: { type: "card", control: "any", names: TR_TITLES }, max: 0 },
      instructions: [{ verb: "ModifyStat", stat: "advanceNow", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },

    // 10095 Thaurdir's Pursuit (stage 2). When Revealed: Thaurdir is added to the staging area, each player searches the encounter deck and discard pile for an Undead enemy and adds it to the staging area, the deck is shuffled. Side B: -5 quest points for each Clue objective attached to a character;
    // the stage cannot be defeated while Thaurdir has hit points remaining, and defeating it wins the game (the final stage).
    {
      id: "10095:whenRevealed:1",
      cardCode: "10095",
      lines: ["10095:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "EnterSetAsideStaging", code: THAURDIR }, EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Undead", to: "staging" }]), { verb: "ShuffleEncounterDeck" }],
    },
    { id: "10095:constant:1", cardCode: "10095", lines: ["10095:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { count: ANY_CLUE, times: 5, negative: true }, until: "whileSourceInPlay", target: "self" }] },
    { id: "10095:constant:2", cardCode: "10095", lines: ["10095:B:2"], timing: "constant", condition: { kind: "hitPointsLeft", code: THAURDIR }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "10095:questResolution:1", cardCode: "10095", lines: ["10095:B:2"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },

    // 10096 Amarthiúl (objective ally). Response: after an enemy engages a player, control of him goes to that player (copied).
    copyLine("10067:A:1", "10096:A:1"),

    // 10097 The Great Hall. Forced: when it is explored each player discards the top 5 cards of the encounter deck (a deck that runs out is reset and the discard goes on) and adds an Undead enemy of those five to the staging area (not revealed).
    {
      id: "10097:forced:1",
      cardCode: "10097",
      lines: ["10097:A:1"],
      timing: "forced",
      trigger: "locationExplored",
      subject: "self",
      instructions: [EACH_PLAYER([{ verb: "DiscardEncounterTop", count: 5, reset: true }, { verb: "StageLooked", trait: "Undead", type: "enemy", own: true }])],
    },

    // 10098 Thaurdir. After a Sorcery treachery is revealed from the encounter deck he heals 3 damage and attacks the first player (copied from 09033).
    copyLine("09033:A:3", "10098:A:3"),

    // 10099 Wight of Rhudaur. While the current quest holds progress it gains surge; while it holds none it gains doomed 2 (read as it is revealed; with no current quest neither).
    { id: "10099:constant:1", cardCode: "10099", lines: ["10099:A:1"], timing: "constant", condition: { kind: "currentQuestProgress", is: "some" }, instructions: [{ verb: "ModifyStat", stat: "gainsSurge", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "10099:constant:2", cardCode: "10099", lines: ["10099:A:2"], timing: "constant", condition: { kind: "currentQuestProgress", is: "none" }, instructions: [{ verb: "ModifyStat", stat: "gainsDoomed", amount: 2, until: "whileSourceInPlay", target: "self" }] },

    // 10100 Traitorous Wight. Forced: when it engages a player, 2 progress comes off each quest card in play. Shadow: for each point of damage this attack deals, 1 progress comes off each quest in play.
    { id: "10100:forced:1", cardCode: "10100", lines: ["10100:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "RemoveProgressFromQuest", amount: 2, each: true }] },
    { id: "10100:shadow:1", cardCode: "10100", lines: ["10100:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RemoveProgressFromQuest", amount: { dealt: true }, each: true }] }] },

    // 10101 Forbidden Descent. In the staging area it takes the first 2 progress each round that would be placed on a quest (each copy takes 2); when it leaves play from the staging area (not explored, not travelled to) each player raises their threat by 2.
    { id: "10101:constant:1", cardCode: "10101", lines: ["10101:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "progressSponge", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "10101:forced:1", cardCode: "10101", lines: ["10101:A:2"], timing: "forced", trigger: "leftStagingArea", subject: "self", instructions: [EACH_PLAYER([{ verb: "RaiseThreat", amount: 2, who: "actor" }])] },

    // 10102 Eerie Halls. Action (any player): raise your threat by 1 to give it -1 Threat until the end of the phase (not offered at 0 Threat). Shadow: with no Clue controlled by the defending player the attacking enemy makes an additional attack.
    {
      id: "10102:action:1",
      cardCode: "10102",
      lines: ["10102:A:1"],
      timing: "action",
      anyPlayer: true,
      cost: { kind: "raiseThreat", amount: 1 },
      condition: { kind: "less", left: 0, right: { stat: "threat", of: "self" } },
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: -1, until: "endOfPhase", target: "self" }],
    },
    { id: "10102:shadow:1", cardCode: "10102", lines: ["10102:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true, when: NO_CLUE }] },

    // 10103 Ghostly Ruins. While in play the encounter deck's reset first returns the topmost Undead enemy of the discard pile to the staging area. Travel: the same return is the cost (copied from 09037 with the Undead enemy).
    { id: "10103:constant:1", cardCode: "10103", lines: ["10103:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "returnsUndeadOnRunOut", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "10103:travel:1", cardCode: "10103", lines: ["10103:A:2"], timing: "travel", instructions: [{ verb: "PickDiscardTop", types: ["enemy"], trait: "Undead" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] },

    // 10104 Decrepit Remains. While in the staging area each location and each encounter side quest there gets +2 quest points. Shadow: for each point of damage this attack deals, 1 progress comes off each quest in play (copied from 10100).
    {
      id: "10104:constant:1",
      cardCode: "10104",
      lines: ["10104:A:1"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: [
        { verb: "ModifyStat", stat: "questPoints", amount: 2, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } },
        { verb: "ModifyStat", stat: "questPoints", amount: 2, until: "whileSourceInPlay", holders: { type: "card", control: "any", stagingOnly: true, cardType: "encounter-side-quest" } },
      ],
    },
    copyLine("10100:A:2", "10104:A:2"),

    // 10105 Centuries of Sorrow (Surge is a keyword). When Revealed: the first player chooses a quest card to be the current quest in place of the current one, if able. Shadow: with no Clue controlled by the defending player the attack is considered undefended.
    { id: "10105:whenRevealed:1", cardCode: "10105", lines: ["10105:A:2"], timing: "whenRevealed", instructions: [{ verb: "ChooseCurrentQuest" }] },
    { id: "10105:shadow:1", cardCode: "10105", lines: ["10105:A:3"], timing: "shadow", instructions: [{ verb: "ConsiderUndefended", when: NO_CLUE }] },

    // 10106 Curse of the Years. When Revealed: 1 damage to each exhausted character, then each player with a threat of 35 or higher discards each exhausted attachment he controls. Shadow: +1 Attack, +3 instead when the defending player controls no Clue.
    {
      id: "10106:whenRevealed:1",
      cardCode: "10106",
      lines: ["10106:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Each", pick: { type: "character", control: "any", state: "exhausted" }, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] },
        EACH_PLAYER([{ verb: "DiscardEach", pick: { type: "attachment", control: "you", state: "exhausted" }, when: { kind: "threat", min: 35 } }]),
      ],
    },
    { id: "10106:shadow:1", cardCode: "10106", lines: ["10106:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS(1, HAS_CLUE), ATTACKER_PLUS(3, NO_CLUE)] },

    // 10107 Dark Covenant. When Revealed: the top 3 cards of the encounter deck are discarded and X is their total printed Threat; the first player either removes X progress from among the quests in play or assigns X damage among the characters he controls (an option that changes nothing is not offered).
    // Shadow: if the attack destroys a character, the defending player raises their threat by that character's Willpower.
    {
      id: "10107:whenRevealed:1",
      cardCode: "10107",
      lines: ["10107:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "DiscardEncounterTop", count: 3, reset: true },
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            {
              id: "remove",
              requires: { kind: "all", conditions: [{ kind: "less", left: 0, right: { discardedThreat: true } }, { kind: "canPick", pick: { type: "card", control: "any", questCard: true, progress: true } }] },
              instructions: [{ verb: "RemoveProgressAmong", amount: { discardedThreat: true } }],
            },
            {
              id: "damage",
              requires: { kind: "all", conditions: [{ kind: "less", left: 0, right: { discardedThreat: true } }, { kind: "canPick", pick: MY_CHARACTER }] },
              instructions: [{ verb: "AssignDamage", amount: { discardedThreat: true }, pick: MY_CHARACTER }],
            },
          ],
        },
      ],
    },
    { id: "10107:shadow:1", cardCode: "10107", lines: ["10107:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: { destroyedWillpower: true }, when: { kind: "x", min: 1 } }] }] },

    // 10108 Haunting Fog. When Revealed: each player exhausts a character he controls, then it is attached to the current quest as a Condition (discarded with no current quest): the quest gets +6 quest points.
    { id: "10108:whenRevealed:1", cardCode: "10108", lines: ["10108:A:1"], timing: "whenRevealed", instructions: [{ verb: "EachExhaustsOne" }, { verb: "AttachToQuest" }] },
    { id: "10108:constant:1", cardCode: "10108", lines: ["10108:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    { id: "10108:constant:2", cardCode: "10108", lines: ["10108:A:1"], timing: "constant", condition: { kind: "not", condition: IN_STAGING }, instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 6, until: "whileSourceInPlay", target: "host" }] },

    // 10109 Quiet the Spirits. While it is the current quest each Undead enemy that enters play (revealed, added or returned to the staging area, put into play by an effect; not an engaged enemy returned to the staging area) engages the player with the highest threat at once (the first player breaks a tie) and adds its Threat to the staging area until the end of the phase.
    // Forced: after an enemy is destroyed, 2 progress goes on it. When it is defeated it flips over into the Clue objective.
    {
      id: "10109:forced:1",
      cardCode: "10109",
      lines: ["10109:A:1"],
      timing: "forced",
      trigger: "encounterEnteredPlay",
      subject: UNDEAD,
      condition: { kind: "currentQuest", is: "self" },
      instructions: [{ verb: "PickHighestThreat" }, { verb: "SwitchActor", to: "picked" }, { verb: "Engage", target: "subject" }, { verb: "ModifyStat", stat: "engagedThreat", amount: 1, until: "endOfPhase", target: "subject" }],
    },
    { id: "10109:forced:2", cardCode: "10109", lines: ["10109:A:2"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any" }, instructions: [...SELF_QUEST("Quiet the Spirits"), { verb: "PlaceProgressOnQuestCard", amount: 2 }] },
    flipsInto("10109", "10109:A:3", "10110", 1),

    // 10110 Daechanar's Brand, 10112 Heirloom of Iârchon, 10114 Orders from Angmar (Clue objectives). Action: exhaust Amarthiúl or a hero to claim the Clue and attach it to that character, which gets +1 Attack against Undead enemies, +1 Willpower, +1 Defense against Undead enemies.
    claim("10110"),
    { id: "10110:constant:1", cardCode: "10110", lines: ["10110:A:2"], timing: "constant", instructions: [HOST_STAT("attack", 1, ATTACKING_UNDEAD)] },

    // 10111 Sift through the Debris. While it is the current quest each location in the staging area gets +1 Threat. Forced: after a location is explored, 2 progress goes on it. When it is defeated it flips over.
    { id: "10111:constant:1", cardCode: "10111", lines: ["10111:A:1"], timing: "constant", condition: { kind: "currentQuest", is: "self" }, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
    { id: "10111:forced:1", cardCode: "10111", lines: ["10111:A:2"], timing: "forced", trigger: "locationExplored", subject: { type: "location", control: "any" }, instructions: [...SELF_QUEST("Sift through the Debris"), { verb: "PlaceProgressOnQuestCard", amount: 2 }] },
    flipsInto("10111", "10111:A:3", "10112", 2),
    claim("10112"),
    
    // 10113 Decipher Ancient Texts. While it is the current quest allies get -2 Willpower. Action (any player, 3 times a round together): pay 1 resource to place 1 progress on it. When it is defeated it flips over.
    { id: "10113:constant:1", cardCode: "10113", lines: ["10113:A:1"], timing: "constant", condition: { kind: "currentQuest", is: "self" }, instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -2, until: "whileSourceInPlay", holders: { type: "ally", control: "any" } }] },
    {
      id: "10113:action:1",
      cardCode: "10113",
      lines: ["10113:A:2"],
      timing: "action",
      anyPlayer: true,
      limit: "thricePerRound",
      cost: { kind: "resources", amount: 1 },
      instructions: [...SELF_QUEST("Decipher Ancient Texts"), { verb: "PlaceProgressOnQuestCard", amount: 1 }],
    },
    flipsInto("10113", "10113:A:3", "10114", 2),
    claim("10114"),
    { id: "10114:constant:1", cardCode: "10114", lines: ["10114:A:2"], timing: "constant", instructions: [HOST_STAT("defense", 1, { kind: "defendingAgainst", trait: "Undead" })] },

    // 10184 The Treachery of Rhudaur (campaign card). Resolution: for each Clue a player controls that player may add the boon of the same name to the Campaign Pool and their deck; the characters that carry a Determination are marked determined.
    {
      id: "10184:resolution:1",
      cardCode: "10184",
      lines: ["10184:B:1"],
      timing: "resolution",
      instructions: [...CLUES.map((entry): Instruction => ({ verb: "ChooseCards", codes: [entry.boon], who: "eachSeat", to: "pool", optional: true, ifControls: entry.clue })), { verb: "RecordDetermined", code: DETERMINATION }],
    },

    // 10185 Daechanar's Brand (boon). Attached hero gets +1 Attack, +2 instead against an Undead enemy. Response: after it is played, the top 5 cards of the encounter deck are searched for a Sorcery treachery, which goes to the victory display; the deck is shuffled.
    { id: "10185:constant:2", cardCode: "10185", lines: ["10185:A:2"], timing: "constant", instructions: [HOST_STAT("attack", 1), HOST_STAT("attack", 1, ATTACKING_UNDEAD)] },
    {
      id: "10185:response:1",
      cardCode: "10185",
      lines: ["10185:A:3"],
      timing: "response",
      trigger: "played",
      subject: "self",
      instructions: [{ verb: "PickEncounter", from: "deck", top: 5, type: "treachery", trait: "Sorcery" }, { verb: "MoveEncounterCard", to: "victory" }, { verb: "ShuffleEncounterDeck" }],
    },

    // 10186 Heirloom of Iârchon (boon). Response: after it is played, all the damage on the attached hero is healed.
    { id: "10186:response:1", cardCode: "10186", lines: ["10186:A:3"], timing: "response", trigger: "played", subject: "self", instructions: [{ verb: "Heal", all: true, target: "host" }] },

    // 10187 Orders from Angmar (boon). Attached hero gets +1 Defense, +2 instead while defending against an Undead enemy. Response: after it is played, a non-unique Undead enemy with 2 or less remaining hit points is discarded.
    { id: "10187:constant:2", cardCode: "10187", lines: ["10187:A:2"], timing: "constant", instructions: [HOST_STAT("defense", 1), HOST_STAT("defense", 1, { kind: "defendingAgainst", trait: "Undead" })] },
    {
      id: "10187:response:1",
      cardCode: "10187",
      lines: ["10187:A:3"],
      timing: "response",
      trigger: "played",
      subject: "self",
      instructions: [{ verb: "Pick", pick: { ...UNDEAD, nonUnique: true, maxHitPointsLeft: 2 } }, { verb: "Discard", target: { kind: "picked" } }],
    },
  ],
  { pool: [...DIKE, ...ETTENMOORS] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
