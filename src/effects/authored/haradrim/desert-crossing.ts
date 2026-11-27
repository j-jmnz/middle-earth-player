import type { Effect } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as ATTACK_ON_DOL_GULDUR } from "../standalone-scenarios/attack-on-dol-guldur.ts";
import { AUTHORED_EFFECTS as ESCAPE_FROM_KHAZAD_DUM } from "../standalone-scenarios/escape-from-khazad-dum.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Desert Crossing (haradrim cycle part 2, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. See docs/scenarios/haradrim/desert-crossing.md, Readings, for each reading. The heat tracker is the haradrim family's (src/rules/families/haradrim/heat.ts): `temperature` tracks the value,
// `temperatureChanged` is queued by each change, and the loss at 60 on each stage answers it.
// Rules: hrd.heat-tracker, hrd.setup-desert-crossing, hrd.side-quests, hrd.side-quests-in-play, hrd.guarded-x, rr.forced, rr.travel, rr.cannot, rr.first-player, rr.engaged, rr.search, rr.shadow-effects, rr.in-play-and-out-of-play, rr.modifiers, rr.blank, rr.active-location, rr.explored, rr.lasting-effects, rr.constant-ability, rr.response (data/rules/entries.json).
type Cond = NonNullable<Effect["condition"]>;
type Instruction = Effect["instructions"][number];

const TENS = { temperature: "tens" } as const;
const FOUND_LOCATION: Cond = { kind: "matches", card: "picked", pick: { type: "location", control: "any" }, inPlay: false };
const FOUND_CREATURE: Cond = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Creature" }, inPlay: false };
const IN_STAGING: Cond = { kind: "sourceIn", zone: "staging" };
// "Each player assigns X damage among characters he controls, where X is the tens digit of the temperature" (16029:A:1, 16069:B:1).
const EACH_PLAYER_ASSIGNS_TENS: Instruction = { verb: "AssignDamage", amount: TENS, pick: { type: "character", control: "you" }, who: "eachSeat" };
// "If the temperature is 60 or higher, the players lose the game": the stage's loss answers every change of the temperature, as soon as it is 60.
export const LOSE_AT_60 = { verb: "LoseGame", reason: "The temperature reached 60", when: { kind: "temperature", min: 60 } } as const satisfies Instruction;
const EXHAUST_A_CHARACTER: Instruction = { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 16068 The Desert of Harad. Setup: each player adds one Burnt Sands from the encounter deck to the staging area (the scenario's staging pile, perPlayer 1, in data/scenarios/desert-crossing.json, places them), the heat tracker is set to 10.
    {
      id: "16068:setup:1",
      cardCode: "16068",
      lines: ["16068:A:1"],
      timing: "setup",
      instructions: [{ verb: "SetTemperature", value: 10 }],
    },
    // 16068:B:1: after an ally of any player enters play, its controller chooses: exhaust it, or deal 1 damage to it (10078:A:1's form).
    {
      id: "16068:forced:1",
      cardCode: "16068",
      lines: ["16068:B:1"],
      timing: "forced",
      trigger: "enteredPlay",
      subject: { type: "ally", control: "any" },
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "exhaust", requires: { kind: "matches", card: "subject", pick: { type: "ally", control: "any", state: "ready" } }, instructions: [{ verb: "Exhaust", target: { kind: "ref", ref: "subject" } }] },
            { id: "damage", instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }] },
          ],
        },
      ],
    },
    // 16068:B:2, 16070:B:2: at the end of the round the temperature rises by 4.
    { id: "16068:forced:2", cardCode: "16068", lines: ["16068:B:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "RaiseTemperature", amount: 4 }] },
    // 16068:B:3, 16069:B:2: the players lose as soon as the temperature is 60 or higher.
    { id: "16068:forced:3", cardCode: "16068", lines: ["16068:B:3"], timing: "forced", trigger: "temperatureChanged", instructions: [LOSE_AT_60] },

    // 16069 Under the Merciless Sun. When Revealed: +2 temperature, the discard pile is shuffled into the deck, and one encounter card per player is revealed, one after the other.
    {
      id: "16069:whenRevealed:1",
      cardCode: "16069",
      lines: ["16069:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "RaiseTemperature", amount: 2 }, { verb: "ShuffleEncounterDiscard" }, { verb: "Repeat", times: { players: true }, instructions: [{ verb: "RevealEncounter" }] }],
    },
    // 16069:B:1: +4 at the end of the round first, then each player assigns X damage, X read after the rise.
    { id: "16069:forced:1", cardCode: "16069", lines: ["16069:B:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "RaiseTemperature", amount: 4 }, EACH_PLAYER_ASSIGNS_TENS] },
    copyLine("16068:B:3", "16069:B:2"),

    // 16070 Beasts of Legend. When Revealed: +2 temperature; each player in turn finds a Were-worm in the deck, the discard pile or the victory display and adds it to the staging area; the deck is shuffled.
    {
      id: "16070:whenRevealed:1",
      cardCode: "16070",
      lines: ["16070:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "RaiseTemperature", amount: 2 }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", code: "16028", to: "staging", victory: true }] }, { verb: "ShuffleEncounterDeck" }],
    },
    // 16070:B:1: in the quest phase the total Threat in the staging area is X higher, X the tens digit, read live (the table's moreStagingThreat, as Helm's Deep's objective).
    {
      id: "16070:constant:1",
      cardCode: "16070",
      lines: ["16070:B:1"],
      timing: "constant",
      condition: { kind: "phase", is: "Quest" },
      instructions: [{ verb: "ModifyStat", stat: "moreStagingThreat", amount: TENS, until: "whileSourceInPlay", target: "table" }],
    },
    copyLine("16068:B:2", "16070:B:2"),
    // 16070:B:3: the stage cannot be defeated while a Were-worm is in play; defeating it wins the game; the loss at 60.
    { id: "16070:constant:2", cardCode: "16070", lines: ["16070:B:3"], timing: "constant", condition: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, names: ["Were-worm"] } }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "16070:questResolution:1", cardCode: "16070", lines: ["16070:B:3"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },
    { id: "16070:forced:2", cardCode: "16070", lines: ["16070:B:3"], timing: "forced", trigger: "temperatureChanged", instructions: [LOSE_AT_60] },

    // 16022 Mirage. When Revealed: the active location is discarded, the discard pile (it included) is shuffled into the deck, cards are discarded until a location is, and that location becomes the active location (no travel).
    {
      id: "16022:whenRevealed:1",
      cardCode: "16022",
      lines: ["16022:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Discard", target: { kind: "activeLocation" } },
        { verb: "ShuffleEncounterDiscard" },
        { verb: "DiscardUntil", type: "location" },
        { verb: "MoveEncounterCard", card: "picked", to: "activeLocation", when: FOUND_LOCATION },
      ],
    },

    // 16023 Seek Shade (side quest). Forced at the end of the round: X progress comes off the main quest. Response when defeated: the temperature falls by 10 (never below 0).
    { id: "16023:forced:1", cardCode: "16023", lines: ["16023:A:2"], timing: "forced", trigger: "endOfRound", condition: IN_STAGING, instructions: [{ verb: "RemoveProgressFromQuest", amount: TENS }] },
    { id: "16023:response:1", cardCode: "16023", lines: ["16023:A:3"], timing: "response", trigger: "questDefeated", subject: "self", instructions: [{ verb: "LowerTemperature", amount: 10 }] },

    // 16024 Carrion Bird. -1 engagement cost for each damaged character in play (any player's); after it engages you, you discard a damaged character you control.
    {
      id: "16024:constant:1",
      cardCode: "16024",
      lines: ["16024:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: { count: { type: "character", control: "any", damaged: true }, negative: true }, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "16024:forced:1",
      cardCode: "16024",
      lines: ["16024:A:2"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", damaged: true } }, { verb: "Discard", target: { kind: "picked" } }],
    },

    // 16025 Burnt Sands. +2 Threat while the temperature is 40 or higher (in the staging area); after it becomes the active location the temperature rises by 2.
    {
      id: "16025:constant:1",
      cardCode: "16025",
      lines: ["16025:A:1"],
      timing: "constant",
      condition: { kind: "all", conditions: [IN_STAGING, { kind: "temperature", min: 40 }] },
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "16025:forced:1", cardCode: "16025", lines: ["16025:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "RaiseTemperature", amount: 2 }] },

    // 16026 Scorched Hamada. Threat X (printed X, held as no value in the data); after it becomes the active location X damage is assigned among characters in play; Shadow: raise your threat by X.
    { id: "16026:constant:1", cardCode: "16026", lines: ["16026:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: TENS, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "16026:forced:1",
      cardCode: "16026",
      lines: ["16026:A:2"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [{ verb: "AssignDamage", amount: TENS, pick: { type: "character", control: "any" } }],
    },
    { id: "16026:shadow:1", cardCode: "16026", lines: ["16026:A:3"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: TENS }] },

    // 16027 Parched Wadi. In the staging area each Creature enemy in play gets +1 Threat and +1 Attack; after it becomes the active location a Creature enemy is found in the deck (the discard pile shuffled in) and added to the staging area.
    {
      id: "16027:constant:1",
      cardCode: "16027",
      lines: ["16027:A:1"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, trait: "Creature" } },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, trait: "Creature" } },
      ],
    },
    {
      id: "16027:forced:1",
      cardCode: "16027",
      lines: ["16027:A:2"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "enemy", trait: "Creature" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: FOUND_CREATURE }],
    },

    // 16028 Were-worm. Threat, Attack and Defense X (printed X, held as no value in the data); after it engages you it makes an immediate attack; Shadow: +1 Attack, +2 instead at 40 or higher.
    {
      id: "16028:constant:1",
      cardCode: "16028",
      lines: ["16028:A:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: TENS, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "attack", amount: TENS, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "defense", amount: TENS, until: "whileSourceInPlay", target: "self" },
      ],
    },
    { id: "16028:forced:1", cardCode: "16028", lines: ["16028:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "ImmediateAttack", shadow: false }] },
    {
      id: "16028:shadow:1",
      cardCode: "16028",
      lines: ["16028:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "temperature", min: 40 } },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "temperature", min: 40 } } },
      ],
    },

    // 16029 Unbearable Heat.
    { id: "16029:whenRevealed:1", cardCode: "16029", lines: ["16029:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER_ASSIGNS_TENS] },
    { id: "16029:shadow:1", cardCode: "16029", lines: ["16029:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: TENS, until: "endOfAttack", target: "attacker" }] },

    // 16030 Scorching Sun. When Revealed: +4 temperature (Surge is the keyword). Shadow: the defending player chooses +2 temperature, or the attacking enemy returns to the staging area after this attack.
    { id: "16030:whenRevealed:1", cardCode: "16030", lines: ["16030:A:2"], timing: "whenRevealed", instructions: [{ verb: "RaiseTemperature", amount: 4 }] },
    {
      id: "16030:shadow:1",
      cardCode: "16030",
      lines: ["16030:A:3"],
      timing: "shadow",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "temperature", instructions: [{ verb: "RaiseTemperature", amount: 2 }] },
            { id: "return", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
          ],
        },
      ],
    },

    // 16048 Find Water (side quest). While in the staging area, a player card effect cannot ready a character (51112:A:2's form); when defeated each player readies a hero (an encounter card effect, so its own line does not stop it).
    {
      id: "16048:constant:1",
      cardCode: "16048",
      lines: ["16048:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }],
    },
    {
      id: "16048:response:1",
      cardCode: "16048",
      lines: ["16048:A:2"],
      timing: "response",
      trigger: "questDefeated",
      subject: "self",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", state: "exhausted" } }, { verb: "Ready", target: "picked" }] }],
    },

    // 16049 Towering Dunes. No progress on the other staging locations (Abandoned Mine's line of The Ruins of Belegost, with this card's name excepted); after it becomes the active location the top card of the encounter deck is revealed.
    { id: "16049:constant:1", cardCode: "16049", lines: ["16049:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, exceptNames: ["Towering Dunes"] } }] },
    { id: "16049:forced:1", cardCode: "16049", lines: ["16049:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "RevealEncounter" }] },

    // 16050 Desert Oasis. While the active location it gains the Response: when it is explored, up to 4 damage is healed from among characters in play (the actor chooses each one, 09029:A:1's trigger); after it becomes the active location each player exhausts a character.
    {
      id: "16050:response:1",
      cardCode: "16050",
      lines: ["16050:A:1"],
      timing: "response",
      trigger: "activeExplored",
      subject: "self",
      instructions: [{ verb: "HealAmong", amount: 4, exact: true, pick: { type: "character", control: "any" } }],
    },
    { id: "16050:forced:1", cardCode: "16050", lines: ["16050:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [EXHAUST_A_CHARACTER] },

    // 16051 Sandstorm. Each player chooses: discard his hand, or assign X damage (X his hand); Shadow: discard the highest cost attachment, or assign X damage (X his attachments).
    {
      id: "16051:whenRevealed:1",
      cardCode: "16051",
      lines: ["16051:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "discard", instructions: [{ verb: "DiscardHand" }] },
                { id: "damage", instructions: [{ verb: "AssignDamage", amount: { hand: true }, pick: { type: "character", control: "you" } }] },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "16051:shadow:1",
      cardCode: "16051",
      lines: ["16051:A:2"],
      timing: "shadow",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "discard", requires: { kind: "canPick", pick: { type: "attachment", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", highestCost: true } }, { verb: "Discard", target: { kind: "picked" } }] },
            { id: "damage", instructions: [{ verb: "AssignDamage", amount: { count: { type: "attachment", control: "you" } }, pick: { type: "character", control: "you" } }] },
          ],
        },
      ],
    },

    // 16052 Heat Exhaustion. Each player exhausts a ready character he controls and deals 1 damage to that character (none ready: no damage).
    {
      id: "16052:whenRevealed:1",
      cardCode: "16052",
      lines: ["16052:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            { verb: "Pick", pick: { type: "character", control: "you", state: "ready" } },
            { verb: "Exhaust", target: { kind: "picked" } },
            { verb: "DamageCard", amount: 1, target: "picked", when: { kind: "matches", card: "picked", pick: { type: "character", control: "you", state: "exhausted" } } },
          ],
        },
      ],
    },
    copyLine("50917:A:3", "16052:A:2"),

    // 16053 Craft Remedy (side quest). Each damaged character's printed text box is blank, read live; when defeated 1 damage is healed from each character in play.
    {
      id: "16053:constant:1",
      cardCode: "16053",
      lines: ["16053:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any", damaged: true } }],
    },
    {
      id: "16053:response:1",
      cardCode: "16053",
      lines: ["16053:A:2"],
      timing: "response",
      trigger: "questDefeated",
      subject: "self",
      instructions: [{ verb: "Each", pick: { type: "character", control: "any" }, instructions: [{ verb: "Heal", amount: 1, target: "picked" }] }],
    },

    // 16054 Sand Viper. Nobody declares a defender against it (Rock Adder's line); after the players travel it engages the first player (the form of 900702:A:1, which a Nightmare card prints).
    copyLine("51324:A:1", "16054:A:1"),
    { id: "16054:forced:1", cardCode: "16054", lines: ["16054:A:2"], timing: "forced", trigger: "traveled", subject: { type: "location", control: "any" }, instructions: [{ verb: "EngageFirstPlayer", moves: true }] },

    // 16055 Giant Scorpion. After it damages a character that character cannot ready until the end of the round; Shadow: the defending character cannot ready, once this attack dealt damage (145033:A:2's form).
    {
      id: "16055:forced:1",
      cardCode: "16055",
      lines: ["16055:A:1"],
      timing: "forced",
      trigger: "damagedByAttack",
      subject: { type: "character", control: "any" },
      condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", isSource: true } },
      instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "subject" }],
    },
    {
      id: "16055:shadow:1",
      cardCode: "16055",
      lines: ["16055:A:2"],
      timing: "shadow",
      // An undefended attack has no defending character (docs/scenarios/haradrim/desert-crossing.md, Encounter cards): the hero it damages is not "the defending character".
      instructions: [{ verb: "AfterAttack", when: { kind: "not", condition: { kind: "undefended" } }, instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "other", when: { kind: "dealt" } }] }],
    },
  ],
  { pool: [...ATTACK_ON_DOL_GULDUR, ...ESCAPE_FROM_KHAZAD_DUM] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
