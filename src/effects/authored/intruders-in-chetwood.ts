import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THE_FATE_OF_NUMENOR } from "./the-fate-of-numenor.ts";
import { AUTHORED_EFFECTS as THE_OATH } from "./the-oath.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for Intruders in Chetwood (Angmar Awakened part 1, campaign card 10156): Iârion, the Orc War Party, the three side quests that act on the table (Orc Rearguard, Rescue Iârion, Lost in the Wilderness) and Orc Ambush, the encounter cards no template reads,
// the quest card, and the lines of the campaign card (the Setup) and of its two cards (Iârion's Pendant, Protect the Innocent) that need this scenario's table. Every line is read from the scan ledger (data/printed/angmar-awakened.json); a line a template already writes
// (pnpm data build) or another card prints word for word needs no record here. The encounter side quests lie in the encounter deck and are revealed into the staging area (mec108.side-quests); the game reads the side quest rules because it deals one
// (families/wilderland/night-quest.ts markSideQuests). Time X, the card held under a side quest, the quest cards in play and the Setup's trade are the angmar family's (src/catalog/families/angmar.ts).
// Rules: mec108.side-quests, mec108.side-quests-in-play, mec108.time-x, mec108.objective-allies, mec108.setup-intruders-in-chetwood, mec108.campaign-setup-intruders-in-chetwood, mec108.campaign-log-tracking, faq.side-quest-current-quest-text, faq.enemy-attacks-outside-combat,
// faq.additional-attacks, rr.first-player, rr.in-play-and-out-of-play, rr.the-word-choose, rr.travel, rr.cancel (data/rules/entries.json).
const IARION = "09016";
const ORC_WAR_PARTY = "09017";
const PENDANT = "10157";
const PROTECT_THE_INNOCENT = "10158";
// "a side quest" revealed, and the encounter side quests among the cards in play.
const SIDE_QUEST: PickSpec = { type: "card", control: "any", cardType: "encounter-side-quest" };
// "an enemy in the staging area".
const STAGED_ENEMY: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
// "If this attack destroys an ally" / "After X attacks and destroys an ally": the defender is an ally that is out of play now.
const DEFENDER_DESTROYED_ALLY: Condition = { kind: "matches", card: "other", pick: { type: "ally", control: "any" }, inPlay: false };
// "the first player controls Iârion" (the players cannot defeat the stage unless they do).
const FIRST_PLAYER_LACKS_IARION: Condition = { kind: "not", condition: { kind: "controls", code: IARION } };
// Each player in turn order: the instructions with a question for them.
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// "X is the number of quest cards in play" (09016:A:1, 09048:A:1): the stats a card prints as X read it.
const X = { questCards: true } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 09016 Iârion (objective-ally). Willpower, Attack and Defense X, the number of quest cards in play; the first player controls him (copied below); Response: after a side quest is revealed, ready him (heard from his controller: not while he lies under Rescue Iârion).
    // "If Iârion leaves play, the players lose the game" is written by the build.
    {
      id: "09016:constant:1",
      cardCode: IARION,
      lines: ["09016:A:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "willpower", amount: X, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "attack", amount: X, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "defense", amount: X, until: "whileSourceInPlay", target: "self" },
      ],
    },
    copyLine("11028:A:1", "09016:A:2"),
    {
      id: "09016:response:1",
      cardCode: IARION,
      lines: ["09016:A:3"],
      timing: "response",
      trigger: "revealed",
      subject: SIDE_QUEST,
      condition: { kind: "matches", card: "self", pick: { type: "character", control: "you", state: "exhausted" } },
      instructions: [{ verb: "Ready" }],
    },

    // 09017 Orc War Party. In the staging area the enemies there cannot take damage; while it is in play the players cannot win (the final stage is not defeated: Restrict advance, as Parth Galen, 142073:A:3).
    {
      id: "09017:constant:2",
      cardCode: ORC_WAR_PARTY,
      lines: ["09017:A:2"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } }],
    },
    { id: "09017:constant:3", cardCode: ORC_WAR_PARTY, lines: ["09017:A:3"], timing: "constant", instructions: [{ verb: "Restrict", what: "advance" }] },

    // 09018 Chetwood Forest. Travel: one player (the first player decides which) chooses and engages an enemy in the staging area; the travel is not conditional on it. Shadow: the defending player either exhausts a hero he controls or the attacker returns to the staging area after the attack.
    {
      id: "09018:travel:1",
      cardCode: "09018",
      lines: ["09018:A:1"],
      timing: "travel",
      instructions: [{ verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } }, { verb: "SwitchActor", to: "picked" }, { verb: "Pick", pick: STAGED_ENEMY }, { verb: "Engage", target: "picked" }],
    },
    {
      id: "09018:shadow:1",
      cardCode: "09018",
      lines: ["09018:A:2"],
      timing: "shadow",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "exhaust", requires: { kind: "canPick", pick: READY_HERO }, instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }] },
            { id: "staging", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
          ],
        },
      ],
    },

    // 09019 Borders of Bree-land. In the staging area it gains the Forced effect: at the beginning of the quest phase one enemy engaged with a player (the first player chooses it) returns to the staging area. Shadow: -1 Defense for each quest card in play ("quest stage" is the card).
    {
      id: "09019:forced:1",
      cardCode: "09019",
      lines: ["09019:A:1"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, IN_STAGING] },
      instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", who: "firstPlayer" } }, { verb: "ReturnToStaging", target: { kind: "picked" } }],
    },
    { id: "09019:shadow:1", cardCode: "09019", lines: ["09019:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { questCards: true, negative: true }, until: "endOfAttack", target: "defender" }] },

    // 09020 Outlying Homestead (Doomed is a keyword). In the staging area the players cannot reduce their threat (as 143076:B:1); Travel: reveal a card from the encounter deck.
    {
      id: "09020:constant:1",
      cardCode: "09020",
      lines: ["09020:A:2"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: [{ verb: "ModifyStat", stat: "noThreatReduction", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }],
    },
    { id: "09020:travel:1", cardCode: "09020", lines: ["09020:A:3"], timing: "travel", instructions: [{ verb: "RevealEncounter" }] },

    // 09021 Sudden Assault. When Revealed: with the committed Willpower above the Threat in the staging area each enemy there attacks the first player (outside the combat phase, each dealt a shadow card, staying in the staging area); with no attack made (the Willpower
    // is not above, or no enemy is there) an Orc War Party is found and added to the staging area (decided before the attacks, which can change the committed Willpower); the deck is shuffled. The effect cannot be canceled.
    {
      id: "09021:whenRevealed:1",
      cardCode: "09021",
      lines: ["09021:A:1"],
      timing: "whenRevealed",
      uncancelable: { kind: "sourceIn", zone: "staging" },
      instructions: [
        {
          verb: "SearchMove",
          code: ORC_WAR_PARTY,
          to: "staging",
          when: { kind: "not", condition: { kind: "questLeads", attacks: true } },
        },
        { verb: "Each", pick: STAGED_ENEMY, instructions: [{ verb: "AttackFromStaging", who: "firstPlayer" }], when: { kind: "questLeads" } },
        { verb: "ShuffleEncounterDeck" },
      ],
    },

    // 09022 Surprising Speed (the Shadow is written by the build). The When Revealed line is the one of 41017:A:1.
    copyLine("41017:A:1", "09022:A:1"),

    // 09023 Orc Rearguard (side quest, 3 quest points). In the staging area no more than 3 progress tokens can be placed on the current quest each round (the main quest card or the side quest that is current); while it is the current quest it gains the Forced effect: at the end
    // of the staging step reveal a card from the encounter deck.
    {
      id: "09023:constant:1",
      cardCode: "09023",
      lines: ["09023:A:1"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 3, until: "whileSourceInPlay", target: "table" }],
    },
    {
      id: "09023:forced:1",
      cardCode: "09023",
      lines: ["09023:A:2"],
      timing: "forced",
      trigger: "stagingStepEnds",
      condition: { kind: "currentQuest", is: "self" },
      instructions: [{ verb: "RevealEncounter" }],
    },

    // 09024 Rescue Iârion (side quest, 6 quest points). Time 4. When Revealed: Iârion lies facedown under it (in play, controlled by nobody); when it is defeated the first player takes control of him, exhausted (defeatSideQuest). Forced: after the last time counter is removed, Iârion is discarded
    // (leaves play: the players lose the game).
    { id: "09024:constant:1", cardCode: "09024", lines: ["09024:A:1"], timing: "constant", instructions: [{ verb: "Time", amount: 4 }] },
    { id: "09024:whenRevealed:1", cardCode: "09024", lines: ["09024:A:2"], timing: "whenRevealed", instructions: [{ verb: "HoldUnder", code: IARION }] },
    { id: "09024:forced:1", cardCode: "09024", lines: ["09024:A:3"], timing: "forced", trigger: "lastTimeCounterRemoved", instructions: [{ verb: "DiscardHeld" }] },

    // 09043 Angmar Orc. When Revealed: the first player either discards an ally from play (any ally, Iârion included) or reveals an additional encounter card. Shadow: +1 Attack; if this attack destroys an ally the enemy returns to the staging area after the attack.
    {
      id: "09043:whenRevealed:1",
      cardCode: "09043",
      lines: ["09043:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "ally", requires: { kind: "canPick", pick: { type: "ally", control: "any" } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "any", who: "firstPlayer" } }, { verb: "DiscardPicked" }] },
            { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
          ],
        },
      ],
    },
    {
      id: "09043:shadow:1",
      cardCode: "09043",
      lines: ["09043:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
        { verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: { kind: "all", conditions: [{ kind: "x", min: 1 }, DEFENDER_DESTROYED_ALLY] } }] },
      ],
    },

    // 09044 Angmar Marauder. Forced: after it attacks and destroys an ally it returns to the staging area. Shadow: +1 Attack for each ally the defending player controls.
    { id: "09044:forced:1", cardCode: "09044", lines: ["09044:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", condition: DEFENDER_DESTROYED_ALLY, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] },
    {
      id: "09044:shadow:1",
      cardCode: "09044",
      lines: ["09044:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: { type: "ally", control: "you" } }, until: "endOfAttack", target: "attacker" }],
    },

    // 09045 Angmar Captain. Forced: after it attacks and destroys an ally, the top card of the defending player's deck is discarded; an ally card makes it attack the defending player again (a new shadow card is dealt, faq.additional-attacks).
    {
      id: "09045:forced:1",
      cardCode: "09045",
      lines: ["09045:A:1"],
      timing: "forced",
      trigger: "attackResolved",
      subject: "self",
      condition: DEFENDER_DESTROYED_ALLY,
      instructions: [{ verb: "DiscardFromDeck", amount: 1, count: { type: "ally", control: "any", looked: true } }, { verb: "ImmediateAttack", when: { kind: "x", min: 1 } }],
    },

    // 09046 Orc Ambush (side quest, 4 quest points). In the staging area each Orc enemy in play gets +1 Threat, +1 Attack and +1 Defense. When Revealed: each player in turn searches the encounter deck and discard pile for an Orc enemy and puts it into play engaged with him; the deck is shuffled.
    {
      id: "09046:constant:1",
      cardCode: "09046",
      lines: ["09046:A:1"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "enemies", trait: "Orc" },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "enemies", trait: "Orc" },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "enemies", trait: "Orc" },
      ],
    },
    {
      id: "09046:whenRevealed:1",
      cardCode: "09046",
      lines: ["09046:A:2"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", trait: "Orc", type: "enemy", to: "engaged" }]), { verb: "ShuffleEncounterDeck" }],
    },

    // 09047 Rugged Country. +2 Threat while the current quest is a side quest. Shadow: +1 Attack for each quest card in play.
    { id: "09047:constant:1", cardCode: "09047", lines: ["09047:A:1"], timing: "constant", condition: { kind: "currentQuest", is: "side" }, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "self" }] },
    { id: "09047:shadow:1", cardCode: "09047", lines: ["09047:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: X, until: "endOfAttack", target: "attacker" }] },

    // 09048 Shrouded Hills. Threat X, the number of quest cards in play; with only 1 it gains surge.
    { id: "09048:constant:1", cardCode: "09048", lines: ["09048:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: X, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "09048:constant:2",
      cardCode: "09048",
      lines: ["09048:A:2"],
      timing: "constant",
      condition: { kind: "less", left: X, right: 2 },
      instructions: [{ verb: "ModifyStat", stat: "gainsSurge", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },

    // 09049 Pressing Needs (Doomed 2 is a keyword). When Revealed: the first player either searches the encounter deck and discard pile for an encounter side quest and reveals it, or chooses a different quest card in play to be the current quest until the end of the phase; the deck is shuffled.
    {
      id: "09049:whenRevealed:1",
      cardCode: "09049",
      lines: ["09049:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "search", requires: { kind: "searchable", type: "encounter-side-quest" }, instructions: [{ verb: "SearchReveal", type: "encounter-side-quest", who: "firstPlayer" }] },
            { id: "current", requires: { kind: "currentQuest", is: "other" }, instructions: [{ verb: "ChooseCurrentQuest" }] },
          ],
        },
        { verb: "ShuffleEncounterDeck" },
      ],
    },

    // 09050 Weight of Responsibility. When Revealed: reveal 1 encounter card for each quest card in play. Shadow: the defending player discards 1 attachment he controls for each quest card in play (his choice; all of them with fewer).
    { id: "09050:whenRevealed:1", cardCode: "09050", lines: ["09050:A:1"], timing: "whenRevealed", instructions: [{ verb: "RevealEncounter", times: X }] },
    {
      id: "09050:shadow:1",
      cardCode: "09050",
      lines: ["09050:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Repeat", times: X, instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "DiscardPicked" }] }],
    },

    // 09051 Lost in the Wilderness (side quest, 4 quest points). When Revealed: each player in turn places their hand facedown under it. Forced: when it is defeated each card under it returns to its owner's hand.
    { id: "09051:whenRevealed:1", cardCode: "09051", lines: ["09051:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "PlaceHandUnderSelf" }])] },
    { id: "09051:forced:1", cardCode: "09051", lines: ["09051:A:2"], timing: "forced", trigger: "questDefeated", instructions: [{ verb: "ReturnFacedownToHands" }] },

    // 09068 Stop the War Party (stage 1). Setup: Iârion is put into play under the first player, the Orc War Party is added to the staging area (by the piles) and each player in turn adds a location with a different title from the encounter deck; the deck is shuffled.
    // Enemies make no engagement checks; Forced: at the end of the refresh phase each player raises their threat by 1 for each enemy in the staging area; the players cannot defeat the stage unless the first player controls Iârion (and win the game when they do).
    {
      id: "09068:setup:1",
      cardCode: "09068",
      lines: ["09068:A:1"],
      timing: "setup",
      instructions: [{ verb: "PutSetAsideInPlay", name: "Iârion", to: "firstPlayer" }, EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging", different: true, deckOnly: true }]), { verb: "ShuffleEncounterDeck" }],
    },
    { id: "09068:constant:1", cardCode: "09068", lines: ["09068:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    {
      id: "09068:forced:1",
      cardCode: "09068",
      lines: ["09068:B:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Refresh" },
      instructions: [{ verb: "RaiseThreat", amount: { count: STAGED_ENEMY }, who: "eachSeat" }],
    },
    { id: "09068:constant:2", cardCode: "09068", lines: ["09068:B:3"], timing: "constant", condition: FIRST_PLAYER_LACKS_IARION, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 10156 Intruders in Chetwood (campaign card). Setup (after the quest card's, which puts Iârion into play): Iârion's Pendant is attached to Iârion, Protect the Innocent is added to the staging area, and starting with the first player each player may place 4 damage on it
    // to add 1 resource to each of their heroes' pools. The Resolution is in the box's campaign file (angmar-awakened.ts).
    {
      id: "10156:campaignSetup:1",
      cardCode: "10156",
      lines: ["10156:A:2"],
      timing: "campaignSetup",
      instructions: [{ verb: "AddToStaging", code: PROTECT_THE_INNOCENT }, { verb: "AttachNewTo", code: PENDANT, to: "Iârion" }, { verb: "TradeDamageForResources", code: PROTECT_THE_INNOCENT, damage: 4, resources: 1 }],
    },

    // 10157 Iârion's Pendant (boon; Attached character gets +1 Willpower is written by the build). Response: add it to the victory display to cancel the When Revealed effects of a card just revealed from the encounter deck (a side quest's, and an effect that cannot be canceled, are not), or a shadow effect just triggered.
    {
      id: "10157:response:1",
      cardCode: PENDANT,
      lines: ["10157:A:2"],
      timing: "response",
      trigger: "whenRevealedPending",
      subject: { type: "card", control: "any" },
      cost: { kind: "addSelfToVictory" },
      instructions: [{ verb: "CancelEffect" }],
    },
    { id: "10157:response:2", cardCode: PENDANT, lines: ["10157:A:2"], timing: "response", trigger: "shadowPending", cost: { kind: "addSelfToVictory" }, instructions: [{ verb: "CancelEffect" }] },

    // 10158 Protect the Innocent (side quest, no quest points: it is never defeated). Forced: after an attack damages a character, place 1 damage on it. Progress that would be placed on it removes that much damage instead. With 10 damage (20 with 3 or 4 players) the players lose.
    {
      id: "10158:forced:1",
      cardCode: PROTECT_THE_INNOCENT,
      lines: ["10158:A:1"],
      timing: "forced",
      trigger: "attackDamagedCharacter",
      subject: { type: "enemy", control: "any", staging: true },
      instructions: [{ verb: "PlaceDamageOn", code: PROTECT_THE_INNOCENT, amount: 1 }],
    },
    { id: "10158:constant:1", cardCode: PROTECT_THE_INNOCENT, lines: ["10158:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressRemovesDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "10158:constant:2",
      cardCode: PROTECT_THE_INNOCENT,
      lines: ["10158:A:3"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "loseAtDamage", amount: 10, until: "whileSourceInPlay", target: "self", when: { kind: "not", condition: { kind: "less", left: 2, right: { players: true } } } },
        { verb: "ModifyStat", stat: "loseAtDamage", amount: 20, until: "whileSourceInPlay", target: "self", when: { kind: "less", left: 2, right: { players: true } } },
      ],
    },
  ],
  { pool: [...THE_FATE_OF_NUMENOR, ...THE_OATH] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
