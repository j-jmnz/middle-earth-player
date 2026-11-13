import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { RECORDS as TDOM } from "../pool/TDoM.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Battle of Carn Dûm (Angmar Awakened part 8, campaign card 10188): the two quest stages, Thaurdir's two sides, the encounter cards no template reads and the four boons the campaign card offers (10189 to 10192). Every line is read from the scan ledger (data/printed/angmar-awakened.json);
// a line a template already writes (pnpm data build) or another card prints word for word needs no record here. Thaurdir lies in the staging area from the Setup (10125:A:1: the data stages him, the Garrison copies and the active location, and shuffles the deck, so that record does nothing more).
// 10127 is his Captain side and 10128 his Champion side: two cards, one flipped over the other (`FlipInPlace`, `FlipTwoSided`), so his damage, shadow cards and attachments, Thaurdir's burdens included, stay on him across a flip. The campaign card's records are in angmar-awakened.ts; the vocabulary the box added is in src/catalog/families/angmar.ts.
// Rules: mec108.thaurdir, mec108.battle, mec108.indestructible, mec108.side-quests, mec108.side-quests-in-play, rr.shadow-effects, rr.step-6-2, rr.engaged, rr.forced, rr.travel, rr.cost, rr.active-location, rr.current-quest, rr.destroy, rr.search, rr.printed, rr.removed-from-game,
// faq.enemy-attacks-outside-combat, faq.additional-attacks, faq.progress-without-advancing (data/rules/entries.json).
const CAPTAIN = "10127";
const CHAMPION = "10128";
// "Thaurdir": the enemy with that title, on either side, in the staging area or engaged.
const THAURDIR_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Thaurdir"] };
const THAURDIR_HOLDERS = THAURDIR_ENEMY;
const CAPTAIN_UP: Condition = { kind: "inPlay", code: CAPTAIN, is: true };
const CHAMPION_UP: Condition = { kind: "inPlay", code: CHAMPION, is: true };
const THAURDIR_IN_PLAY: Condition = { kind: "any", conditions: [CAPTAIN_UP, CHAMPION_UP] };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const FLIP_TO_CHAMPION: Instruction = { verb: "FlipInPlace", code: CAPTAIN, into: CHAMPION, when: CAPTAIN_UP };
const FLIP_TO_CAPTAIN: Instruction = { verb: "FlipInPlace", code: CHAMPION, into: CAPTAIN, when: CHAMPION_UP };
const FLIP_EITHER: Instruction = { verb: "FlipTwoSided", front: CAPTAIN, back: CHAMPION };
// "If there are 3 shadow cards dealt to" the enemy that was just dealt one (exactly 3: 2 < n < 4).
const EXACTLY_THREE_SHADOWS: Condition = {
  kind: "all",
  conditions: [
    { kind: "less", left: 2, right: { stat: "shadowCards", of: "subject" } },
    { kind: "less", left: { stat: "shadowCards", of: "subject" }, right: 4 },
  ],
};
const MORE_THAN_TWO_ON_SELF: Condition = { kind: "less", left: 2, right: { stat: "shadowCards", of: "self" } };
const FEWER_THAN_FOUR_ON_SELF: Condition = { kind: "less", left: { stat: "shadowCards", of: "self" }, right: 4 };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const ATTACKER_PLUS = (amount: Extract<Instruction, { verb: "ModifyStat" }>["amount"], when?: Condition): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", ...(when ? { when } : {}) });
// "the defending player's threat is higher than the attacking enemy's engagement cost".
const THREAT_ABOVE_COST: Condition = { kind: "less", left: { stat: "engagementCost", of: "attacker" }, right: { threat: "actor" } };
const HOST_STAT = (stat: "attack" | "hitPoints", amount: number): Instruction => ({ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "host" });
// The Sorcery treachery a Thaurdir side hears being revealed from the encounter deck.
const SORCERY_TREACHERY: PickSpec = { type: "treachery", control: "any", trait: "Sorcery" };
const MY_QUESTER: PickSpec = { type: "character", control: "you", committed: true };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 10125 The Clutches of Carn Dûm. Setup: the data adds Thaurdir (Captain faceup), one Garrison copy for each player and the active location, and shuffles the encounter deck, so the record adds nothing.
    { id: "10125:setup:1", cardCode: "10125", lines: ["10125:A:1"], timing: "setup", instructions: [] },
    // Side B: Thaurdir cannot leave the staging area or take damage, and at the end of the round he flips to Captain if he is Champion side faceup.
    {
      id: "10125:constant:1",
      cardCode: "10125",
      lines: ["10125:B:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", holders: THAURDIR_HOLDERS },
        { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: THAURDIR_HOLDERS },
      ],
    },
    { id: "10125:forced:1", cardCode: "10125", lines: ["10125:B:1"], timing: "forced", trigger: "endOfRound", instructions: [FLIP_TO_CAPTAIN] },
    // Unresolved shadow cards are not discarded at the end of the combat phase: those dealt to enemies that did not attack stay and add up.
    { id: "10125:constant:2", cardCode: "10125", lines: ["10125:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "keepShadowCards", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    // Forced: with exactly 3 shadow cards dealt to Thaurdir (checked as each is dealt) he flips, and the new side's Forced effect follows.
    { id: "10125:forced:2", cardCode: "10125", lines: ["10125:B:3"], timing: "forced", trigger: "shadowDealtTo", subject: THAURDIR_ENEMY, condition: EXACTLY_THREE_SHADOWS, instructions: [FLIP_EITHER] },

    // 10126 Midwinter's Crux. When Revealed: each player raises their threat by the number of shadow cards in play, then Thaurdir flips if he is Captain side faceup.
    { id: "10126:whenRevealed:1", cardCode: "10126", lines: ["10126:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: { shadowCardsInPlay: true }, who: "eachSeat" }, FLIP_TO_CHAMPION] },
    // Side B: Thaurdir stays in the staging area but is considered engaged with each player: he attacks each of them in turn in the combat phase with a shadow card of its own for each attack (families/south/watcher.ts), and each player may attack him as an
    // engaged enemy. No engagement ever happens, so no "after an enemy engages you" effect hears him. His Threat still counts against the quest (he does not enter any play area). At the end of the round he flips to Champion if he is Captain side faceup.
    {
      id: "10126:constant:1",
      cardCode: "10126",
      lines: ["10126:B:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", holders: THAURDIR_HOLDERS },
        { verb: "ModifyStat", stat: "engagedWithAll", amount: 1, until: "whileSourceInPlay", holders: THAURDIR_HOLDERS },
        { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: THAURDIR_HOLDERS },
        { verb: "ModifyStat", stat: "attackableByAny", amount: 1, until: "whileSourceInPlay", holders: THAURDIR_HOLDERS },
      ],
    },
    { id: "10126:forced:1", cardCode: "10126", lines: ["10126:B:1"], timing: "forced", trigger: "endOfRound", instructions: [FLIP_TO_CHAMPION] },
    // With 15 or more progress on this stage Thaurdir loses indestructible; the stage cannot be defeated while he is in play.
    { id: "10126:constant:2", cardCode: "10126", lines: ["10126:B:2"], timing: "constant", condition: { kind: "stageProgress", min: 15 }, instructions: [{ verb: "ModifyStat", stat: "losesKeywords", amount: 1, until: "whileSourceInPlay", holders: THAURDIR_HOLDERS }] },
    { id: "10126:constant:3", cardCode: "10126", lines: ["10126:B:2"], timing: "constant", condition: THAURDIR_IN_PLAY, instructions: [{ verb: "Restrict", what: "advance" }] },
    // If Thaurdir is defeated, the players win the game.
    { id: "10126:triggered:1", cardCode: "10126", lines: ["10126:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: THAURDIR_ENEMY, instructions: [{ verb: "WinGame" }] },

    // 10127 Thaurdir, Captain (Indestructible and Cannot have attachments: the build). Each other enemy gets +10 engagement cost. Forced: after he is flipped or a Sorcery treachery is revealed from the encounter deck, 1 shadow card is dealt to each enemy in play.
    { id: "10127:constant:2", cardCode: CAPTAIN, lines: ["10127:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: 10, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, notTraits: ["Wraith"] } }] },
    { id: "10127:forced:1", cardCode: CAPTAIN, lines: ["10127:A:4"], timing: "forced", trigger: "flippedOver", subject: "self", instructions: [{ verb: "DealShadowInPlay" }] },
    { id: "10127:forced:2", cardCode: CAPTAIN, lines: ["10127:A:4"], timing: "forced", trigger: "revealed", notFromDiscard: true, subject: SORCERY_TREACHERY, instructions: [{ verb: "DealShadowInPlay" }] },

    // 10128 Thaurdir, Champion. Each other enemy gets -10 engagement cost. Forced: after he is flipped or a Sorcery treachery is revealed, he heals 3 damage and makes an immediate attack against the first player, from where he is (a shadow card is dealt; 09033:A:3).
    { id: "10128:constant:2", cardCode: CHAMPION, lines: ["10128:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, notTraits: ["Wraith"] } }] },
    { id: "10128:forced:1", cardCode: CHAMPION, lines: ["10128:A:4"], timing: "forced", trigger: "flippedOver", subject: "self", instructions: [{ verb: "Heal", amount: 3, target: "self" }, { verb: "AttackFromStaging", target: "self", who: "firstPlayer", orEngaged: true }] },
    {
      id: "10128:forced:2",
      cardCode: CHAMPION,
      lines: ["10128:A:4"],
      timing: "forced",
      trigger: "revealed",
      notFromDiscard: true,
      subject: SORCERY_TREACHERY,
      instructions: [{ verb: "Heal", amount: 3, target: "self" }, { verb: "AttackFromStaging", target: "self", who: "firstPlayer", orEngaged: true }],
    },

    // 10129 Carn Dûm Garrison. +1 Threat for each shadow card dealt to it. Shadow: the attacking enemy gets +1 Attack for each shadow card dealt to it (this card included).
    { id: "10129:constant:1", cardCode: "10129", lines: ["10129:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "shadowCards", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
    { id: "10129:shadow:1", cardCode: "10129", lines: ["10129:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS({ stat: "shadowCards", of: "attacker" })] },

    // 10130 Orc Grunts (Doomed 1, Surge: the build). Any time progress is placed on the current quest, each Orc Grunts in play reduces it by 1. Shadow: add it to the staging area (copied).
    { id: "10130:constant:1", cardCode: "10130", lines: ["10130:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressReduced", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    copyLine("41041:A:2", "10130:A:3"),

    // 10131 Werewolf of Angmar. Forced: after any event card is played it is dealt 1 shadow card; with exactly 3 shadow cards dealt to it in the staging area it engages the first player and attacks at once, with no new shadow card.
    { id: "10131:forced:1", cardCode: "10131", lines: ["10131:A:1"], timing: "forced", trigger: "played", subject: { type: "card", control: "any", cardType: "event" }, instructions: [{ verb: "DealShadowInPlay", target: "self" }] },
    {
      id: "10131:forced:2",
      cardCode: "10131",
      lines: ["10131:A:2"],
      timing: "forced",
      trigger: "shadowDealtTo",
      subject: "self",
      condition: { kind: "all", conditions: [IN_STAGING, MORE_THAN_TWO_ON_SELF, FEWER_THAN_FOUR_ON_SELF] },
      instructions: [{ verb: "EngageFirstPlayer" }, { verb: "ImmediateAttack", shadow: false, keepShadows: true, when: { kind: "sourceIn", zone: "engaged" } }],
    },

    // 10132 Accursed Battlefield. While it is the active location each quest card in play (the main quest card and the encounter side quests in the staging area) gains the battle keyword. Shadow: +1 Attack, +3 instead when the defending player's threat is higher than the
    // attacking enemy's engagement cost.
    {
      id: "10132:constant:1",
      cardCode: "10132",
      lines: ["10132:A:1"],
      timing: "constant",
      condition: ACTIVE,
      instructions: [
        { verb: "ModifyStat", stat: "battle", amount: 1, until: "whileSourceInPlay", target: "currentQuest" },
        { verb: "ModifyStat", stat: "battle", amount: 1, until: "whileSourceInPlay", holders: { type: "card", control: "any", stagingOnly: true, cardType: "encounter-side-quest" } },
      ],
    },
    {
      id: "10132:shadow:1",
      cardCode: "10132",
      lines: ["10132:A:2"],
      timing: "shadow",
      instructions: [
        ATTACKER_PLUS(1, { kind: "not", condition: THREAT_ABOVE_COST }),
        ATTACKER_PLUS(3, THREAT_ABOVE_COST),
      ],
    },

    // 10133 Mountains of Angmar. While it is the active location each shadow card with no shadow effect gains "Shadow: Raise defending player's threat by 2" (read as the card is flipped). Shadow: raise the defending player's threat by 2.
    { id: "10133:constant:1", cardCode: "10133", lines: ["10133:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "blankShadowGains", amount: 2, until: "whileSourceInPlay", target: "table" }] },
    { id: "10133:shadow:1", cardCode: "10133", lines: ["10133:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] },

    // 10134 Blight of Carn Dûm. Forced: after an enemy attacks, heal 1 damage from it (while Blight is in the staging area or is the active location). Travel: deal each enemy in play 1 shadow card (a cost the players must be able to pay in full).
    // Shadow: if the attacking enemy is Thaurdir, heal 3 damage from him.
    {
      id: "10134:forced:1",
      cardCode: "10134",
      lines: ["10134:A:1"],
      timing: "forced",
      trigger: "attackResolved",
      subject: { type: "enemy", control: "any", staging: true },
      condition: { kind: "any", conditions: [IN_STAGING, ACTIVE] },
      instructions: [{ verb: "Heal", amount: 1, target: "subject" }],
    },
    { id: "10134:travel:1", cardCode: "10134", lines: ["10134:A:2"], timing: "travel", instructions: [{ verb: "DealShadowInPlay" }] },
    { id: "10134:shadow:1", cardCode: "10134", lines: ["10134:A:3"], timing: "shadow", instructions: [{ verb: "Heal", amount: 3, target: "attacker", when: { kind: "matches", card: "attacker", pick: THAURDIR_ENEMY } }] },

    // 10135 Fortress Walls. While it is the active location, each resource a player spends raises that player's threat by 1 (once the payment is made). Shadow: with a threat of 40 or higher the attacking enemy makes an additional attack against you after this one.
    { id: "10135:forced:1", cardCode: "10135", lines: ["10135:A:1"], timing: "forced", trigger: "resourcesSpent", condition: ACTIVE, instructions: [{ verb: "RaiseThreat", amount: { x: true }, who: "eventSeat" }] },
    { id: "10135:shadow:1", cardCode: "10135", lines: ["10135:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true, when: { kind: "threat", min: 40 } }] },

    // 10136 The Sky Darkens. When Revealed: each player discards a random card from their hand, then searches their deck for each other copy of it, discards them and shuffles the deck. Shadow: discard a random card from the defending player's hand.
    { id: "10136:whenRevealed:1", cardCode: "10136", lines: ["10136:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "DiscardRandomFromHand", remember: true }, { verb: "DiscardCopiesFromDeck", of: "picked", all: true, shuffle: true }])] },
    { id: "10136:shadow:1", cardCode: "10136", lines: ["10136:A:2"], timing: "shadow", instructions: [{ verb: "DiscardRandomFromHand" }] },

    // 10137 Vile Affliction. When Revealed: each player distributes damage among the questing characters they control equal to the printed cost of the highest cost card in their discard pile. Shadow: +1 Attack; if the attack destroys an ally, the defending player
    // searches their deck for another copy of that ally and discards it.
    { id: "10137:whenRevealed:1", cardCode: "10137", lines: ["10137:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "AssignDamage", amount: { discardPileMaxCost: true }, pick: MY_QUESTER }])] },
    {
      id: "10137:shadow:1",
      cardCode: "10137",
      lines: ["10137:A:2"],
      timing: "shadow",
      instructions: [ATTACKER_PLUS(1), { verb: "AfterAttack", instructions: [{ verb: "DiscardCopiesFromDeck", of: "other", when: { kind: "x", min: 1 } }] }],
    },

    // 10138 Daechanar's Will. When Revealed: flip Thaurdir, then if he is Captain side faceup this card gains surge. Shadow: flip Thaurdir after this attack.
    { id: "10138:whenRevealed:1", cardCode: "10138", lines: ["10138:A:1"], timing: "whenRevealed", instructions: [FLIP_EITHER, { verb: "GainSurge", when: CAPTAIN_UP }] },
    { id: "10138:shadow:1", cardCode: "10138", lines: ["10138:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [FLIP_EITHER] }] },

    // 10139 Furious Charge (Surge: the build). Forced: each time progress is placed on it every character gets -2 Defense until the end of the round, then Thaurdir flips if he is Captain side faceup. Response: after it is defeated, add 10 progress to the main quest.
    {
      id: "10139:forced:1",
      cardCode: "10139",
      lines: ["10139:A:2"],
      timing: "forced",
      trigger: "progressPlaced",
      instructions: [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfRound", target: "characters" }, FLIP_TO_CHAMPION],
    },
    { id: "10139:response:1", cardCode: "10139", lines: ["10139:A:3"], timing: "response", trigger: "questDefeated", subject: "self", instructions: [{ verb: "QuestProgress", amount: 10 }] },

    // 10189 Elrond's Champion (boon ally). Response: after an enemy engages you (an engagement check, an optional engagement or an effect; never Thaurdir's "considered" engagement), ready it.
    { id: "10189:response:1", cardCode: "10189", lines: ["10189:A:1"], timing: "response", trigger: "engaged", eventSeat: "you", instructions: [{ verb: "Ready", target: "self" }] },

    // 10190 Lore of Ancient Arnor (boon event). Action: each player returns 1 card from their discard pile to their hand (2 when they are the only player) and shuffles the rest of it into their deck; then this card is removed from the game (this game only).
    {
      id: "10190:action:1",
      cardCode: "10190",
      lines: ["10190:A:1"],
      timing: "action",
      instructions: [
        EACH_PLAYER([
          { verb: "Pick", pick: { type: "card", control: "you", from: "discard" } },
          { verb: "MovePicked", to: "hand" },
          { verb: "Pick", pick: { type: "card", control: "you", from: "discard" }, when: { kind: "less", left: { players: true }, right: 2 } },
          { verb: "MovePicked", to: "hand", when: { kind: "less", left: { players: true }, right: 2 } },
          { verb: "ShuffleDiscardIntoDeck" },
        ]),
        { verb: "RemoveSourceFromGame" },
      ],
    },

    // 10191 Raiment of the Second Age (boon attachment; Attach to a character, Restricted: keywords). Attached character gets +2 Attack and +2 hit points. Response: after the attached character attacks and destroys an enemy, draw 1 card.
    { id: "10191:constant:2", cardCode: "10191", lines: ["10191:A:2"], timing: "constant", instructions: [HOST_STAT("attack", 2), HOST_STAT("hitPoints", 2)] },
    { id: "10191:response:1", cardCode: "10191", lines: ["10191:A:3"], timing: "response", trigger: "attackDestroyed", subject: "host", instructions: [{ verb: "Draw", amount: 1 }] },

    // 10192 Rivendell Skirmishers (boon ally). Response: after it exhausts to defend an attack from a non-unique enemy, discard each shadow card dealt to that enemy (before they are flipped).
    {
      id: "10192:response:1",
      cardCode: "10192",
      lines: ["10192:A:1"],
      timing: "response",
      trigger: "declaredDefender",
      subject: "self",
      condition: {
        kind: "all",
        conditions: [
          { kind: "matches", card: "self", pick: { type: "character", control: "any", state: "exhausted" } },
          { kind: "matches", card: "other", pick: { type: "enemy", control: "any", nonUnique: true, hasShadow: true } },
        ],
      },
      instructions: [{ verb: "DiscardShadowOf", target: "other", all: true }],
    },
  ],
  { pool: TDOM },
);

export const AUTHORED_REPLACES: readonly string[] = [];
