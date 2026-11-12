import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as PELENNOR } from "./the-battle-of-the-pelennor-fields.ts";
import { AUTHORED_EFFECTS as CROSS_ROADS } from "../journey-to-the-cross-roads.ts";
import { copyLine, withCopies } from "../reprint.ts";
import { ACTIVE, BLACK_GATE_TOKENS, ENGAGEABLE_NON_UNIQUE, EACH_PLAYER, MOUTH_ATTACKING, MOUTH_IN_STAGING, NON_UNIQUE_STAGED_ENEMY, PICKED_ENEMY_OUT_OF_PLAY, QUEST_PHASE, QUESTING_CHARACTER, WHEN_CAN_PICK } from "./black-gate/shared.ts";
import { STAGE_RECORDS } from "./black-gate/stages.ts";

// Records for The Black Gate Opens (the-return-of-the-king part 5, campaign card 146074, whose Setup and Resolution records are in the-return-of-the-king.ts): the locations, The Mouth of Sauron, the enemies and treacheries, and Gwaihir; the quest stages are in
// return-of-the-king/black-gate/stages.ts. The cards the quest card's piles place or set aside are dealt by the data; no record places them. Every line is read from the scan ledger (data/printed/the-return-of-the-king.json); a line a template already writes (pnpm data build) or another
// card prints word for word needs no record here. See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.dire, mec113.saga-staging-rules, mec113.immune-to-player-card-effects, mec113.peril, rr.cannot, rr.active-location, rr.travel, rr.first-player, rr.defending-player, rr.engaged, rr.staging, rr.reveal, rr.cancel, rr.damage, rr.effects, rr.lasting-effects, rr.immune,
// rr.printed, rr.attachment-cards, faq.lasting-effects, faq.enemy-attacks-outside-combat, faq.peril-attacks, faq.additional-attacks, faq.next-player, rr.search (data/rules/entries.json).
const NAZGUL_NOT_MOUNTED: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Nazgûl", hasAttachment: { names: ["Hell-hawk", "Fell Beast"], none: true } };
const MOAT_ENEMY: PickSpec = { type: "enemy", control: "any", stagingOnly: true, nonUnique: true, notTraits: ["Nazgûl"], who: "firstPlayer" };
const STAGED_ENEMY_OF_THE_FIRST_PLAYER: PickSpec = { ...NON_UNIQUE_STAGED_ENEMY, who: "firstPlayer" };
const ENEMY_DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } } } as const satisfies Partial<Effect>;

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 146024 The Black Gate (Immune is a keyword). The players cannot travel here. +1 Threat for each resource on it. Forced: at the beginning of the quest phase it gets 1 resource and each player raises his threat by 1.
    { id: "146024:constant:1", cardCode: "146024", lines: ["146024:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel" }] },
    { id: "146024:constant:2", cardCode: "146024", lines: ["146024:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "146024:forced:1",
      cardCode: "146024",
      lines: ["146024:A:3"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: QUEST_PHASE,
      instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }, { verb: "RaiseThreat", amount: 1, who: "eachSeat" }],
    },

    // 146025 Towers of the Teeth (Immune is a keyword, its Threat is X). X is the most characters any one player controls (its quest points stay the printed 8). While it is the active location the players cannot play allies (putting one into play is not playing it).
    { id: "146025:constant:1", cardCode: "146025", lines: ["146025:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { mostPerPlayer: { type: "character", control: "you" } }, until: "whileSourceInPlay", target: "self" }] },
    { id: "146025:constant:2", cardCode: "146025", lines: ["146025:A:3"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "CannotPlay", pick: { type: "card", control: "you", cardType: "ally" }, anyPlayer: true }] },

    // 146026 Beleaguered Hills. While it is the active location the total Threat in the staging area is lowered by the Threat of each engaged enemy now (never below 0). Forced: after it becomes the active location each player, the first player first, chooses a non-unique enemy in the staging area and engages it.
    {
      id: "146026:constant:1",
      cardCode: "146026",
      lines: ["146026:A:1"],
      timing: "constant",
      condition: ACTIVE,
      instructions: [{ verb: "ModifyStat", stat: "lessStagingThreat", amount: { stat: "threat", totalOf: { type: "enemy", control: "any" } }, until: "whileSourceInPlay", target: "table" }],
    },
    {
      id: "146026:forced:1",
      cardCode: "146026",
      lines: ["146026:A:2"],
      timing: "forced",
      trigger: "becameActive",
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: ENGAGEABLE_NON_UNIQUE, ...WHEN_CAN_PICK(ENGAGEABLE_NON_UNIQUE) }, { verb: "Engage", target: "picked", ...WHEN_CAN_PICK(ENGAGEABLE_NON_UNIQUE) }])],
    },

    // 146027 Waste of Dagorlad. While it is the active location the printed text box of each ally is treated as blank (Traits stay).
    { id: "146027:constant:1", cardCode: "146027", lines: ["146027:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: { type: "ally", control: "any" } }] },

    // 146028 Slopes of Cirith Gorgor. Forced: when it leaves play the first player shuffles the encounter discard pile into the deck and discards from the top until an enemy is discarded; that enemy comes into play engaged with him (not revealed; with no enemy in the deck nothing is engaged).
    {
      id: "146028:forced:1",
      cardCode: "146028",
      lines: ["146028:A:1"],
      timing: "forced",
      trigger: "leftPlay",
      instructions: [
        { verb: "ShuffleEncounterDiscard" },
        { verb: "DiscardUntil", type: "enemy" },
        EACH_PLAYER([{ verb: "MoveEncounterCard", card: "picked", to: "engaged", when: { kind: "all", conditions: [PICKED_ENEMY_OUT_OF_PLAY, { kind: "firstPlayer" }] } }]),
      ],
    },

    // 146029 Reeking Moat. Forced: after it becomes the active location the first player chooses a non-unique, non-Nazgûl enemy in the staging area and places it facedown under it (out of play). Forced: when it leaves play each enemy under it comes into play engaged with the first player.
    {
      id: "146029:forced:1",
      cardCode: "146029",
      lines: ["146029:A:1"],
      timing: "forced",
      trigger: "becameActive",
      instructions: [{ verb: "Pick", pick: MOAT_ENEMY, ...WHEN_CAN_PICK(MOAT_ENEMY) }, { verb: "PlaceUnderSelf", ...WHEN_CAN_PICK(MOAT_ENEMY) }],
    },
    { id: "146029:forced:2", cardCode: "146029", lines: ["146029:A:2"], timing: "forced", trigger: "leftPlay", instructions: [{ verb: "ReturnUnderToStaging", to: "engaged" }] },

    // 146030 Wall of Morannon. While it is the active location each enemy and each location in the staging area is immune to player card effects. Forced: after it becomes the active location each engaged enemy returns to the staging area (copied from Shadow of Mordor's location).
    {
      id: "146030:constant:1",
      cardCode: "146030",
      lines: ["146030:A:1"],
      timing: "constant",
      condition: ACTIVE,
      instructions: [
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } },
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } },
      ],
    },
    copyLine("144031:A:2", "146030:A:2"),

    // 146031 The Mouth of Sauron (Immune is a keyword). It cannot leave the staging area. Forced: after a player cancels a 'when revealed' effect it makes an immediate attack against that player, dealt a shadow card (the Forced effect is heard only for the cancel of a card that has a When Revealed effect).
    { id: "146031:constant:1", cardCode: "146031", lines: ["146031:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "146031:forced:1",
      cardCode: "146031",
      lines: ["146031:A:2"],
      timing: "forced",
      trigger: "whenRevealedCanceled",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "AttackFromStaging", target: "self", who: "eventSeat" }],
    },

    // 146032 Nazgûl of Mordor (A:1 is a template). Forced: after it attacks the defending player either raises his threat by 4 or returns it to the staging area.
    {
      id: "146032:forced:1",
      cardCode: "146032",
      lines: ["146032:A:2"],
      timing: "forced",
      trigger: "attackResolved",
      subject: "self",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 4, who: "actor" }] }, { id: "staging", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] }],
    },

    // 146033 Gorgoroth Hill-troll (A:1 is a template). Forced: after it attacks and destroys a character the defending player discards a random card from his hand and raises his threat by that card's printed cost (X or no printed cost counts 0; an empty hand raises nothing).
    {
      id: "146033:forced:1",
      cardCode: "146033",
      lines: ["146033:A:2"],
      timing: "forced",
      ...ENEMY_DESTROYS_A_CHARACTER,
      instructions: [{ verb: "DiscardRandomFromHand", remember: true }, { verb: "RaiseThreat", amount: { stat: "cost", of: "picked", printed: true }, who: "actor" }],
    },

    // 146034 Easterling Bowman (Peril and Archery are keywords). When Revealed: the revealing player deals 1 damage to a questing character he controls. Shadow: after this attack the attacking enemy engages the next player, then makes an attack (copy of Pathless Country's reading; with one player there is no next player).
    {
      id: "146034:whenRevealed:1",
      cardCode: "146034",
      lines: ["146034:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: QUESTING_CHARACTER, ...WHEN_CAN_PICK(QUESTING_CHARACTER) }, { verb: "DamageCard", amount: 1, target: "picked", ...WHEN_CAN_PICK(QUESTING_CHARACTER) }],
    },
    {
      id: "146034:shadow:1",
      cardCode: "146034",
      lines: ["146034:A:3"],
      timing: "shadow",
      instructions: [{ verb: "AfterAttack", instructions: [{ verb: "EngageNextPlayer", when: { kind: "otherPlayer" } }, { verb: "ImmediateAttack", when: { kind: "otherPlayer" } }] }],
    },

    // 146035 Warrior of Rhûn (Peril is a keyword). When Revealed: the revealing player chooses a questing character he controls and removes it from the quest. Shadow: the defending character cannot ready until the end of the round.
    {
      id: "146035:whenRevealed:1",
      cardCode: "146035",
      lines: ["146035:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: QUESTING_CHARACTER, ...WHEN_CAN_PICK(QUESTING_CHARACTER) }, { verb: "RemoveFromQuest", ...WHEN_CAN_PICK(QUESTING_CHARACTER) }],
    },
    { id: "146035:shadow:1", cardCode: "146035", lines: ["146035:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },

    // 146036 Hell-hawk (Peril is a keyword). When Revealed: the revealing player either searches the encounter deck, discard pile and victory display for a Nazgûl enemy and adds it to the staging area, or attaches Hell-hawk to a Nazgûl enemy in play that holds no Hell-hawk or Fell Beast (Limit 1 per enemy).
    // It counts as a Mount attachment: the attached enemy gets +2 Threat, +2 Attack and +2 Defense and is immune to player card effects. An option with no card to take is not offered.
    {
      id: "146036:whenRevealed:1",
      cardCode: "146036",
      lines: ["146036:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "search", requires: { kind: "searchable", trait: "Nazgûl", type: "enemy", victory: true }, instructions: [{ verb: "SearchMove", trait: "Nazgûl", type: "enemy", to: "staging", victory: true }] },
            { id: "attach", requires: { kind: "canPick", pick: NAZGUL_NOT_MOUNTED }, instructions: [{ verb: "Pick", pick: NAZGUL_NOT_MOUNTED }, { verb: "AttachSelfToPicked" }] },
          ],
        },
      ],
    },
    {
      id: "146036:constant:1",
      cardCode: "146036",
      lines: ["146036:A:2"],
      timing: "constant",
      instructions: [
        { verb: "CountsAs", cardType: "attachment", trait: "Mount" },
        { verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "host" },
      ],
    },

    // 146037 The Hour of Doom (Doomed 1 is a keyword). When Revealed: each player, the first player first, chooses either to raise his threat by 1 for each character he controls or to discard the highest cost ally he controls (the player chooses among a tie; not offered with no ally). Shadow: copied from Shadow of Mordor.
    {
      id: "146037:whenRevealed:1",
      cardCode: "146037",
      lines: ["146037:A:2"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "character", control: "you" } }, who: "actor" }] },
              { id: "ally", requires: { kind: "canPick", pick: { type: "ally", control: "you", highestCost: true } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", highestCost: true } }, { verb: "DiscardPicked" }] },
            ],
          },
        ]),
      ],
    },
    copyLine("145060:A:3", "146037:A:3"),

    // 146038 Jaws of Steel. When Revealed: each player assigns X damage among the characters he controls, X the resources on The Black Gate (0 when it is not in play). Shadow: the attacking enemy gets +1 Attack for each resource on The Black Gate, counted as the shadow resolves.
    { id: "146038:whenRevealed:1", cardCode: "146038", lines: ["146038:A:1"], timing: "whenRevealed", instructions: [{ verb: "AssignDamage", amount: BLACK_GATE_TOKENS, pick: { type: "character", control: "you" }, who: "eachSeat" }] },
    { id: "146038:shadow:1", cardCode: "146038", lines: ["146038:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: BLACK_GATE_TOKENS, until: "endOfAttack", target: "attacker" }] },

    // 146039 Rage Filled Him (Peril is a keyword). When Revealed: The Mouth of Sauron makes an immediate attack against the revealing player; if that attack destroys a character, he raises his threat by 4 once the attack ends (raiseThreatIfDestroys).
    // Shadow: +1 Attack, or +3 Attack instead if the attacker is The Mouth of Sauron.
    {
      id: "146039:whenRevealed:1",
      cardCode: "146039",
      lines: ["146039:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: MOUTH_IN_STAGING, ...WHEN_CAN_PICK(MOUTH_IN_STAGING) }, { verb: "AttackFromStaging", raiseThreatIfDestroys: 4, ...WHEN_CAN_PICK(MOUTH_IN_STAGING) }],
    },
    {
      id: "146039:shadow:1",
      cardCode: "146039",
      lines: ["146039:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: MOUTH_ATTACKING },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: MOUTH_ATTACKING } },
      ],
    },

    // 146040 Onslaught of Mordor. When Revealed: each player, the first player first, deals 1 damage to a questing character he controls; until the end of the phase each damaged character, now or later, gets -1 Willpower and cannot be healed (recalculated while it lasts, faq.lasting-effects).
    // Shadow: the first player chooses a non-unique enemy in the staging area; it engages the defending player and is dealt a shadow card.
    {
      id: "146040:whenRevealed:1",
      cardCode: "146040",
      lines: ["146040:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([{ verb: "Pick", pick: QUESTING_CHARACTER, ...WHEN_CAN_PICK(QUESTING_CHARACTER) }, { verb: "DamageCard", amount: 1, target: "picked", ...WHEN_CAN_PICK(QUESTING_CHARACTER) }]),
        { verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfPhase", target: "damagedCharacters" },
        { verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "endOfPhase", target: "damagedCharacters" },
      ],
    },
    {
      id: "146040:shadow:1",
      cardCode: "146040",
      lines: ["146040:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "Pick", pick: STAGED_ENEMY_OF_THE_FIRST_PLAYER, ...WHEN_CAN_PICK(STAGED_ENEMY_OF_THE_FIRST_PLAYER) },
        { verb: "Engage", target: "picked", ...WHEN_CAN_PICK(STAGED_ENEMY_OF_THE_FIRST_PLAYER) },
        { verb: "DealShadowTo", target: "picked", ...WHEN_CAN_PICK(STAGED_ENEMY_OF_THE_FIRST_PLAYER) },
      ],
    },

    // 146041 Gwaihir (Ranged and Sentinel are keywords; an objective ally). When Revealed: the first player chooses either to take control of Gwaihir, or to spend 1 Fellowship resource and discard Gwaihir to discard a non-unique enemy in the staging area (offered with a Fellowship resource and an enemy to discard).
    // Shadow: this attack deals no damage.
    {
      id: "146041:whenRevealed:1",
      cardCode: "146041",
      lines: ["146041:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "control", instructions: [{ verb: "TakeControl", who: "actor" }] },
            {
              id: "discard",
              requires: { kind: "all", conditions: [{ kind: "resources", min: 1, sphere: "fellowship" }, { kind: "canPick", pick: NON_UNIQUE_STAGED_ENEMY }] },
              instructions: [{ verb: "SpendResources", amount: 1, sphere: "fellowship" }, { verb: "Pick", pick: NON_UNIQUE_STAGED_ENEMY }, { verb: "Discard", target: { kind: "self" } }, { verb: "Discard", target: { kind: "picked" } }],
            },
          ],
        },
      ],
    },
    { id: "146041:shadow:1", cardCode: "146041", lines: ["146041:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "dealsNoDamage", amount: 1, until: "endOfAttack", target: "attacker" }] },

    ...STAGE_RECORDS,
  ],
  { pool: [...PELENNOR, ...CROSS_ROADS] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
