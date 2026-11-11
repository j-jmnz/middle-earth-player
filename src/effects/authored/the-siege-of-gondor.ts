import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THE_FATE_OF_WILDERLAND } from "./the-fate-of-wilderland.ts";
import { AUTHORED_EFFECTS as TEMPLE } from "./temple-of-the-deceived.ts";
import { AUTHORED_EFFECTS as THE_PASSAGE_OF_THE_MARSHES } from "./the-passage-of-the-marshes.ts";
import { RECORDS as REVCORE } from "./pool/RevCore.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The Siege of Gondor (the-return-of-the-king part 2, campaign card 145070, whose records are in the-return-of-the-king.ts): the Ship locations, the Corsair enemies, the treacheries, Army of the Dead (the objective
// ally) and the quest card. The Corsair Fleet and Great Corsair Ship are placed by the scenario's staging pile, so no record places them. Every line is read from the scan ledger (data/printed/the-return-of-the-king.json); a line a
// template already writes (pnpm data build) or another card prints word for word needs no record here. See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.saga-staging-rules, mec113.peril, mec113.archery, mec113.army-of-the-dead, mec113.immune-to-player-card-effects, mec113.multiplayer-aragorn, rr.search, rr.then, rr.effects, rr.first-player, rr.cannot,
// rr.lasting-effects, rr.running-out-of-cards, rr.quest-advancement, rr.winning-the-game, rr.travel, rr.active-location, rr.forced, rr.victory, faq.progress-without-advancing, faq.peril-attacks (data/rules/entries.json).
const GREAT_SHIP = "145030";
const CORSAIR_CAPTAIN = "145035";
const ARMY = "145068";

type Cond = NonNullable<Effect["condition"]>;

const SHIP_LOCATION: PickSpec = { type: "location", control: "any", trait: "Ship" };
const CORSAIR_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Corsair", staging: true };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const MY_QUESTING_CHARACTER: PickSpec = { type: "character", control: "you", committed: true };
// "The active location is a Ship" (checked as the line is read: a constant live, a Forced or a Shadow as it resolves).
const SHIP_ACTIVE: Cond = { kind: "matches", card: "activeLocation", pick: SHIP_LOCATION };
const NO_SHIP_ACTIVE: Cond = { kind: "not", condition: SHIP_ACTIVE };
// X: the resources on The Corsair Fleet (145071:A:1; the Corsair side is the only one dealt).
const FLEET: PickSpec = { type: "objective", control: "any", names: ["The Corsair Fleet"] };
const X = { resourcesOn: FLEET } as const;
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });

// "Shuffle the encounter discard pile into the encounter deck and discard cards from the top until a Corsair enemy is discarded. Add the discarded enemy to the staging area." (the Galley and the Dromon: with no Corsair enemy
// left the discard finds none and nothing is added, the card picked before it is not moved.)
const DISCARD_UNTIL_CORSAIR: Instruction[] = [
  { verb: "ShuffleEncounterDiscard" },
  { verb: "DiscardUntil", type: "enemy", trait: "Corsair" },
  { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Corsair" }, inPlay: false } },
];

// "Exhaust a character you control" as the Forced effect of an engaged enemy: the engaged player chooses a ready one.
const EXHAUST_ONE: Instruction[] = [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 145030 Great Corsair Ship (unique, in the staging pile). X, its Threat, is the resources on The Corsair Fleet, read live. The players cannot travel here unless 3 or more Ship locations are in the victory display. Travel: each player,
    // the first player first, searches the encounter deck and discard pile for a Corsair enemy and adds it to the staging area; the first player's search must take Corsair Captain while one is there (SearchMove require binds once).
    { id: "145030:constant:1", cardCode: GREAT_SHIP, lines: ["145030:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: X, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "145030:constant:2",
      cardCode: GREAT_SHIP,
      lines: ["145030:A:2"],
      timing: "constant",
      condition: { kind: "count", pick: { type: "location", control: "any", from: "victory", trait: "Ship" }, max: 2 },
      instructions: [{ verb: "Restrict", what: "travel" }],
    },
    { id: "145030:travel:1", cardCode: GREAT_SHIP, lines: ["145030:A:3"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "SearchMove", trait: "Corsair", type: "enemy", to: "staging", require: CORSAIR_CAPTAIN }])] },

    // 145031 Umbar War Galley. While it is the active location each Corsair enemy in play gets -10 engagement cost (an enemy that arrives later too). Travel: the discard pile is shuffled in and the cards discarded until a Corsair enemy is discarded.
    {
      id: "145031:constant:1",
      cardCode: "145031",
      lines: ["145031:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", holders: CORSAIR_ENEMY }],
    },
    { id: "145031:travel:1", cardCode: "145031", lines: ["145031:A:2"], timing: "travel", instructions: DISCARD_UNTIL_CORSAIR },

    // 145032 Corsair Dromon. While it is the active location each Corsair enemy in play gains Archery 1 (cumulative with the enemy's own, mec113.archery).
    {
      id: "145032:constant:1",
      cardCode: "145032",
      lines: ["145032:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "archery", amount: 1, until: "whileSourceInPlay", holders: CORSAIR_ENEMY }],
    },
    { id: "145032:travel:1", cardCode: "145032", lines: ["145032:A:2"], timing: "travel", instructions: DISCARD_UNTIL_CORSAIR },

    // 145033 Port of Pelargir. While it is in the staging area no more than 1 damage can be healed from each character each round, by every effect together (the stat healCap, families/dreamchaser/heal-cap.ts). Shadow: if this attack
    // damages a character (the defender, or the hero an undefended attack landed on), that character cannot ready until the end of the round.
    {
      id: "145033:constant:1",
      cardCode: "145033",
      lines: ["145033:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "healCap", amount: 1, until: "whileSourceInPlay", target: "table" }],
    },
    {
      id: "145033:shadow:1",
      cardCode: "145033",
      lines: ["145033:A:2"],
      timing: "shadow",
      instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "other", when: { kind: "dealt" } }] }],
    },

    // 145034 Pelargir Quays. Forced: at the end of the round, in the staging area or as the active location, place a damage token here. Then (rr.then), with 4 or more, assign 4 damage among characters in play, any player's, the first player
    // deciding how (rr.first-player), and discard it. The count is read before the discard.
    {
      id: "145034:forced:1",
      cardCode: "145034",
      lines: ["145034:A:1"],
      timing: "forced",
      trigger: "endOfRound",
      instructions: [
        { verb: "PlaceDamage", amount: 1, card: "self" },
        { verb: "AssignDamage", amount: 4, pick: { type: "character", control: "any", who: "firstPlayer" }, when: { kind: "less", left: 3, right: { stat: "damage", of: "self" } } },
        { verb: "Discard", target: { kind: "self" }, when: { kind: "less", left: 3, right: { stat: "damage", of: "self" } } },
      ],
    },

    // 145035 Corsair Captain. Cannot be optionally engaged. With a Ship as the active location it gets -30 engagement cost and gains "Forced: When Corsair Captain engages you, it makes an immediate attack": the gained Forced is heard only
    // while a Ship is active as it engages.
    copyLine("110077:A:3", "145035:A:1"),
    {
      id: "145035:constant:2",
      cardCode: CORSAIR_CAPTAIN,
      lines: ["145035:A:2"],
      timing: "constant",
      condition: SHIP_ACTIVE,
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -30, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "145035:forced:1", cardCode: CORSAIR_CAPTAIN, lines: ["145035:A:2"], timing: "forced", trigger: "engaged", subject: "self", condition: SHIP_ACTIVE, instructions: [{ verb: "ImmediateAttack" }] },

    // 145036 Corsair of Umbar. +2 Attack and +2 Defense while a Ship is the active location. Its Shadow (+1 Attack, +2 with a Ship active) is the template's.
    {
      id: "145036:constant:1",
      cardCode: "145036",
      lines: ["145036:A:1"],
      timing: "constant",
      condition: SHIP_ACTIVE,
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", target: "self" }],
    },

    // 145037 Umbar Pirate Crew (Cannot have attachments is the template's). Forced: when it engages you, exhaust a character you control. Shadow: with a Ship as the active location, return the attacker to the staging area after this attack.
    { id: "145037:forced:1", cardCode: "145037", lines: ["145037:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: EXHAUST_ONE },
    { id: "145037:shadow:1", cardCode: "145037", lines: ["145037:A:3"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }], when: SHIP_ACTIVE }] },

    // 145038 Haradrim Pirate. Forced: when it engages you, deal 1 damage to a character you control (2 with a Ship as the active location). Shadow: the defending character gets -1 Defense for each damage on it, for this attack.
    {
      id: "145038:forced:1",
      cardCode: "145038",
      lines: ["145038:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "Pick", pick: MY_CHARACTER }, { verb: "DamageCard", amount: 1, target: "picked", when: NO_SHIP_ACTIVE }, { verb: "DamageCard", amount: 2, target: "picked", when: SHIP_ACTIVE }],
    },
    {
      id: "145038:shadow:1",
      cardCode: "145038",
      lines: ["145038:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "defense", amount: { stat: "damage", of: "defender", negative: true }, until: "endOfAttack", target: "defender" }],
    },

    // 145039 Fell Folk of Umbar (Peril; the revealing player chooses alone). Either return each Corsair enemy engaged with them to the staging area, or discard from the top of the encounter deck until a Corsair enemy is discarded and put it into
    // play engaged with them. An option that cannot be done is not offered (rr.effects): the first needs a Corsair enemy engaged with them, the second one in the deck or the discard pile.
    {
      id: "145039:whenRevealed:1",
      cardCode: "145039",
      lines: ["145039:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "return", requires: { kind: "hasEngaged", trait: "Corsair" }, instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "actor", trait: "Corsair", pick: "all" } }] },
            {
              id: "discard",
              requires: { kind: "searchable", trait: "Corsair" },
              instructions: [
                { verb: "DiscardUntil", type: "enemy", trait: "Corsair" },
                { verb: "MoveEncounterCard", card: "picked", to: "engaged", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Corsair" }, inPlay: false } },
              ],
            },
          ],
        },
      ],
    },

    // 145040 Black Sails (Doomed 1 is a keyword). Each Ship location in the staging area gets +1 Threat until the end of the phase, one that arrives later this phase too (rr.lasting-effects); then, with no non-unique Ship location in the staging area
    // (Great Corsair Ship is unique), the revealing player searches the encounter deck and discard pile for a Ship location and adds it to the staging area. The encounter deck is shuffled either way.
    {
      id: "145040:whenRevealed:1",
      cardCode: "145040",
      lines: ["145040:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: { ...SHIP_LOCATION, stagingOnly: true } },
        { verb: "SearchMove", trait: "Ship", type: "location", to: "staging", when: { kind: "not", condition: { kind: "canPick", pick: { ...SHIP_LOCATION, nonUnique: true, stagingOnly: true } } } },
        { verb: "ShuffleEncounterDeck" },
      ],
    },

    // 145041 Raiding the Coasts. Each player, the first player first, chooses either to add 3 to the total Threat in the staging area until the end of the phase (each who chooses it adds 3) or to discard the highest cost attachment they control,
    // wherever it is attached (printed cost, none counting as 0, the player breaking a tie: the filter highestCost). With no attachment the second option is not offered. Shadow: +1 Attack; if this attack destroys a character, the defending
    // player discards an attachment they control.
    {
      id: "145041:whenRevealed:1",
      cardCode: "145041",
      lines: ["145041:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "threat", instructions: [{ verb: "RaiseStagingThreat", amount: 3, until: "endOfPhase" }] },
              {
                id: "discard",
                requires: { kind: "canPick", pick: { type: "attachment", control: "you" } },
                instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", highestCost: true } }, { verb: "Discard", target: { kind: "picked" } }],
              },
            ],
          },
        ]),
      ],
    },
    {
      id: "145041:shadow:1",
      cardCode: "145041",
      lines: ["145041:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
        { verb: "AfterAttack", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" }, when: { kind: "x", min: 1 } }, { verb: "Discard", target: { kind: "picked" }, when: { kind: "x", min: 1 } }] },
      ],
    },

    // 145042 Driven to the Brink (Peril; the revealing player chooses alone). Either end the quest phase at once without resolving the quest, or assign X damage among the questing characters they control, X the resources on The Corsair Fleet
    // (not offered with no questing character they control, or with X 0).
    {
      id: "145042:whenRevealed:1",
      cardCode: "145042",
      lines: ["145042:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "end", instructions: [{ verb: "EndQuestPhase" }] },
            {
              id: "damage",
              requires: { kind: "all", conditions: [{ kind: "canPick", pick: MY_QUESTING_CHARACTER }, { kind: "less", left: 0, right: X }] },
              instructions: [{ verb: "AssignDamage", amount: X, pick: MY_QUESTING_CHARACTER }],
            },
          ],
        },
      ],
    },
    copyLine("19158:A:2", "145042:A:3"),

    // 145068 Army of the Dead (the objective ally). Immune to player card effects, and the first player controls it (as Aragorn passes with the token). Setup, in the campaign: put into play when it is in the campaign pool, under the first player.
    // If it leaves play it is removed from the game, not discarded.
    copyLine("144076:A:1", "145068:A:1"),
    { id: "145068:campaignSetup:1", cardCode: ARMY, lines: ["145068:A:2"], timing: "campaignSetup", instructions: [{ verb: "PutObjectiveAllyIntoPlay", code: ARMY }] },
    { id: "145068:triggered:1", cardCode: ARMY, lines: ["145068:A:3"], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "removed" }] },

    // 145069 Attack on Pelargir (the only stage). Setup: Great Corsair Ship and The Corsair Fleet are placed by the staging pile; each player, the first player first, searches the encounter deck (not its discard pile) for a Ship location and
    // adds it to the staging area, then the deck is shuffled. Each Ship location in the staging area, one that arrives later too, is immune to player card effects. The stage is not defeated while Great Corsair Ship is in play (progress goes on
    // past 20, faq.progress-without-advancing); when it has left play the stage is defeated, and the players win (rr.winning-the-game: advancing past the last stage is the win).
    {
      id: "145069:setup:1",
      cardCode: "145069",
      lines: ["145069:A:1"],
      timing: "setup",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", trait: "Ship", to: "staging", deckOnly: true }]), { verb: "ShuffleEncounterDeck" }],
    },
    {
      id: "145069:constant:1",
      cardCode: "145069",
      lines: ["145069:B:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { ...SHIP_LOCATION, stagingOnly: true } }],
    },
    { id: "145069:constant:2", cardCode: "145069", lines: ["145069:B:2"], timing: "constant", condition: { kind: "inPlay", code: GREAT_SHIP, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 145071 The Corsair Fleet (an objective in the staging pile; only the Corsair side is dealt). Forced: at the beginning of the staging step place 1 resource here; then (rr.then) each player, the first player first, chooses either to reveal an
    // encounter card (alone, in a staging of its own, mec113.saga-staging-rules) or to assign X damage among the characters they control, X the resources here once the one is placed. A player with no character to hurt has only the reveal.
    {
      id: "145071:forced:1",
      cardCode: "145071",
      lines: ["145071:A:1"],
      timing: "forced",
      trigger: "stagingStepBegins",
      instructions: [
        { verb: "PlaceResourceTokens", amount: 1, on: "self" },
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
              { id: "damage", requires: { kind: "canPick", pick: MY_CHARACTER }, instructions: [{ verb: "AssignDamage", amount: X, pick: MY_CHARACTER }] },
            ],
          },
        ]),
      ],
    },
  ],
  { pool: [...TEMPLE, ...THE_PASSAGE_OF_THE_MARSHES, ...THE_FATE_OF_WILDERLAND, ...REVCORE] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
