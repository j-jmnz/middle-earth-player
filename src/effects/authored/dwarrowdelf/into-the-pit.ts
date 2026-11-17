import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as CAVES } from "../the-caves-of-nibin-dum.ts";
import { AUTHORED_EFFECTS as JOURNEY_IN_THE_DARK } from "../journey-in-the-dark.ts";
import { RECORDS as TDOM } from "../pool/TDoM.ts";
import { ALWAYS } from "../conditions.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Into the Pit (Dwarrowdelf part 1, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json). Six cards print the text of The Caves of Nibin-Dûm's and copy its records
// (Branching Paths 03036, Lightless Passage 03037, Cave Torch 03041, Crumbling Ruin 03049, Watchful Eyes 03062, Goblin Tunnels 03063); the Cave Torch's Action holds its own code, so it is written again. The Nightmare deck's records
// are in ../nightmare/into-the-pit.ts. East-gate is the active location and First Hall and Bridge of Khazad-dûm are set aside by the scenario data (dwd.setup-into-the-pit-set-aside); the Goblin Patrol stage's three lines
// are a Forced effect (the enemies it discards), a flag the quest stage reads at each settle (advance with no enemy in play) and the search of its When Revealed.
// Rules: rr.cancel, rr.replacement-effects, rr.search, rr.first-player, rr.travel, rr.immune, rr.optional-engagement, rr.engagement-check, rr.active-location, rr.explored, dwd.immune-to-card-effects, dwd.last-player,
// dwd.cave-torch-the-long-dark, dwd.encounter-card-actions, dwd.revealing-enemies, faq.lasting-effects (data/rules/entries.json); the readings are in docs/brief.md (Into the Pit).
const TORCH = "03041";
const BRIDGE = "03018";
const FIRST_HALL = "03017";
const PATROL_LEADER = "03014";
const DARK_LOCATION: PickSpec = { type: "location", control: "any", trait: "Dark" };
const ACTIVE_LOCATION_PROGRESS: PickSpec = { type: "location", control: "any", active: true, progress: true, affectable: true };
const UNDEFENDED: Condition = { kind: "undefended" };
const NOT_UNDEFENDED: Condition = { kind: "not", condition: UNDEFENDED };
const ACTIVE_IS_DARK: Condition = { kind: "matches", card: "activeLocation", pick: DARK_LOCATION };
// Burning Low's cards: the enemies and locations in the staging area when it resolves ("currently"), a Dark location read as it is then (a trait a card gives counts).
const STAGED_ENEMY: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const STAGED_LOCATION: PickSpec = { type: "location", control: "any", stagingOnly: true };
const NO_TORCH: Condition = { kind: "not", condition: { kind: "x", min: 1 } };
const ACTIVE_NOT_DARK: Condition = { kind: "not", condition: ACTIVE_IS_DARK };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 03014 Patrol Leader. A:1: the damage just dealt to it is offered to its own Forced effect before it can destroy it (`damageDealt` is heard by enemies that print such a line, rules/families/encounter/patrol.ts): the top card of the encounter deck is discarded, and when it is an enemy
    // that damage is canceled. An empty deck discards nothing and cancels nothing. A:2 (Shadow): the damage dealt to the attacker is canceled for the whole attack, nothing else.
    {
      id: "03014:forced:1",
      cardCode: "03014",
      lines: ["03014:A:1"],
      timing: "forced",
      trigger: "damageDealt",
      subject: "self",
      instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "CancelDamage", all: true, when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" } } }],
    },
    { id: "03014:shadow:1", cardCode: "03014", lines: ["03014:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfAttack", target: "attacker" }] },

    // 03015 Signs of Conflict (Shadow): the defending player raises his threat by 2.
    { id: "03015:shadow:1", cardCode: "03015", lines: ["03015:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] },

    // 03016 East-gate. Immune to card effects (dwd.immune-to-card-effects): no card effect picks or changes it, only questing places progress on it. No optional engagement and no engagement check while it is in play. After it is explored First Hall comes from the set-aside cards.
    { id: "03016:constant:1", cardCode: "03016", lines: ["03016:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToCardEffects", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "03016:constant:2",
      cardCode: "03016",
      lines: ["03016:A:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", target: "table" },
      ],
    },
    { id: "03016:forced:1", cardCode: "03016", lines: ["03016:A:3"], timing: "forced", trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" }, instructions: [{ verb: "AddSetAsideToStaging", code: FIRST_HALL }] },

    // 03017 First Hall: each player raises his threat by 3 to travel here; after it is explored Bridge of Khazad-dûm comes from the set-aside cards.
    { id: "03017:travel:1", cardCode: "03017", lines: ["03017:A:1"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eachSeat" }] },
    { id: "03017:forced:1", cardCode: "03017", lines: ["03017:A:2"], timing: "forced", trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" }, instructions: [{ verb: "AddSetAsideToStaging", code: BRIDGE }] },

    // 03018 Bridge of Khazad-dûm: while it is the active location no player plays a card from his hand (a card put into play is not played).
    { id: "03018:constant:1", cardCode: "03018", lines: ["03018:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "cannotPlayCards", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },

    // 03019 Stairs of Náin: the first player exhausts a character to travel here; the Shadow has the defending player choose and exhaust one.
    { id: "03019:travel:1", cardCode: "03019", lines: ["03019:A:1"], timing: "travel", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready", who: "firstPlayer" } }, { verb: "Exhaust", target: { kind: "picked" } }] },
    { id: "03019:shadow:1", cardCode: "03019", lines: ["03019:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] },

    // 03035 Goblin Follower: it engages the last player when revealed (the player to the first player's right, dwd.last-player); the Shadow's +2 Attack is for an attack on him.
    { id: "03035:whenRevealed:1", cardCode: "03035", lines: ["03035:A:1"], timing: "whenRevealed", instructions: [{ verb: "EngageLastPlayer" }] },
    {
      id: "03035:shadow:1",
      cardCode: "03035",
      lines: ["03035:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "lastPlayer" } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "lastPlayer" } },
      ],
    },

    // 03036 Branching Paths and 03037 Lightless Passage print The Caves of Nibin-Dûm's 41034 and 41033 lines.
    copyLine("41034:A:1", "03036:A:1"),
    copyLine("41034:A:2", "03036:A:2"),
    copyLine("41033:A:2", "03037:A:2"),

    // 03038 Zigil Mineshaft: any player may take this Action while it is in play (dwd.encounter-card-actions); every player raises his threat by 1 each time, and the progress goes on the card.
    { id: "03038:action:1", cardCode: "03038", lines: ["03038:A:1"], timing: "action", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }, { verb: "PlaceProgressOn", amount: 1, target: "self" }] },

    // 03039 Many Roads: the locations in the encounter discard pile go back into the deck.
    { id: "03039:whenRevealed:1", cardCode: "03039", lines: ["03039:A:2"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard", type: "location" }] },

    // 03040 Burning Low. A player who controls a ready Cave Torch may exhaust it, and the whole effect is canceled; else every enemy and location in the staging area when it resolves gets +1 Threat until the end of the phase, +3 for a Dark
    // location (the cards are fixed when it resolves, faq.lasting-effects).
    {
      id: "03040:whenRevealed:1",
      cardCode: "03040",
      lines: ["03040:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "SetX", value: 0 },
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "exhaust", requires: { kind: "all", conditions: [{ kind: "controls", code: TORCH }, { kind: "exhausted", code: TORCH, is: false }] }, instructions: [{ verb: "Exhaust", target: { kind: "byCode", code: TORCH } }, { verb: "AddToX", amount: 1 }] },
                { id: "keep", instructions: [] },
              ],
            },
          ],
        },
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: STAGED_ENEMY, when: NO_TORCH },
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: STAGED_LOCATION, when: NO_TORCH },
        { verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfPhase", holders: { ...STAGED_LOCATION, trait: "Dark" }, when: NO_TORCH },
      ],
    },

    // 03041 Cave Torch (Into the Pit's printing): the Setup of Entering the Mines attaches it. The Action holds the card's own code, so it is written for 03041; the Forced effect is the Caves' text.
    {
      id: "03041:action:1",
      cardCode: TORCH,
      lines: ["03041:A:2"],
      timing: "action",
      condition: { kind: "all", conditions: [{ kind: "exhausted", code: TORCH, is: false }, { kind: "canPick", pick: DARK_LOCATION }] },
      instructions: [{ verb: "Exhaust" }, { verb: "ChooseX", max: [3] }, { verb: "Pick", pick: DARK_LOCATION }, { verb: "PlaceProgressOn", amount: { x: true }, target: "picked" }],
    },
    copyLine("41029:A:3", "03041:A:3"),

    // 03048 Cave In: every progress token comes off the current quest card and the active location; it gains surge when there was none to remove (East-gate's tokens do not count: it is immune to card effects).
    {
      id: "03048:whenRevealed:1",
      cardCode: "03048",
      lines: ["03048:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "GainSurge", when: { kind: "all", conditions: [{ kind: "currentQuestProgress", is: "none" }, { kind: "count", pick: ACTIVE_LOCATION_PROGRESS, max: 0 }] } },
        { verb: "RemoveAllQuestProgress" },
        { verb: "RemoveAllProgress", target: "activeLocation" },
      ],
    },

    // 03049 Crumbling Ruin prints The Caves of Nibin-Dûm's 41038 line.
    copyLine("41038:A:1", "03049:A:1"),

    // 03050 Dark and Dreadful: 1 damage to each exhausted character, 2 when the active location is a Dark location. Shadow: 1 damage to the defending character, or +2 Attack when undefended.
    {
      id: "03050:whenRevealed:1",
      cardCode: "03050",
      lines: ["03050:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", state: "exhausted" }, when: ACTIVE_NOT_DARK },
        { verb: "DamageEach", amount: 2, pick: { type: "character", control: "any", state: "exhausted" }, when: ACTIVE_IS_DARK },
      ],
    },
    {
      id: "03050:shadow:1",
      cardCode: "03050",
      lines: ["03050:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "DamageCard", amount: 1, target: "defender", when: NOT_UNDEFENDED },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: UNDEFENDED },
      ],
    },

    // 03051 Sudden Pitfall: the first player discards a questing character he controls, and nothing cancels it. Shadow: the defending character is discarded from play (nothing when undefended).
    {
      id: "03051:whenRevealed:1",
      cardCode: "03051",
      lines: ["03051:A:1"],
      timing: "whenRevealed",
      uncancelable: ALWAYS,
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", committed: true, who: "firstPlayer" } }, { verb: "Discard", target: { kind: "picked" } }],
    },
    {
      id: "03051:shadow:1",
      cardCode: "03051",
      lines: ["03051:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", defending: true }, when: NOT_UNDEFENDED }, { verb: "Discard", target: { kind: "picked" }, when: NOT_UNDEFENDED }],
    },

    // 03052 Dreadful Gap: X, its quest points, is every character in play.
    { id: "03052:constant:1", cardCode: "03052", lines: ["03052:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { count: { type: "character", control: "any" } }, until: "whileSourceInPlay", target: "self" }] },

    // 03053 Fouled Well: each player in order may discard 1 random card from his hand; it gains surge when any player did not (a player with no card included).
    {
      id: "03053:whenRevealed:1",
      cardCode: "03053",
      lines: ["03053:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "SetX", value: 0 },
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "discard", requires: { kind: "canPick", pick: { type: "card", control: "you", from: "hand" } }, instructions: [{ verb: "DiscardRandomFromHand", amount: 1 }, { verb: "AddToX", amount: 1 }] },
                { id: "keep", instructions: [] },
              ],
            },
          ],
        },
        { verb: "GainSurge", when: { kind: "less", left: { x: true }, right: { players: true } } },
      ],
    },

    // 03060 Goblin Scout: a player whose threat is 25 or higher cannot optionally engage it (an engagement check still engages him).
    { id: "03060:constant:1", cardCode: "03060", lines: ["03060:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "optionalEngageThreat", amount: 25, until: "whileSourceInPlay", target: "self" }] },

    // 03061 Goblin Swordsman: +2 Attack when its attack is undefended; the Shadow adds it to the staging area.
    { id: "03061:constant:1", cardCode: "03061", lines: ["03061:A:1"], timing: "constant", condition: UNDEFENDED, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "self" }] },
    copyLine("41041:A:2", "03061:A:2"),

    // 03062 Watchful Eyes and 03063 Goblin Tunnels print The Caves of Nibin-Dûm's 41040 and 41032 lines.
    copyLine("41040:A:1", "03062:A:1"),
    copyLine("41032:A:1", "03063:A:1"),

    // 03064 Entering the Mines. Setup: East-gate is the active location, First Hall and Bridge of Khazad-dûm are set aside and Cave Torch is out of the encounter deck by the scenario data; the Setup attaches the Torch to a hero of any player the first player
    // chooses (it is removed from the game if it would leave play, dwd.cave-torch-the-long-dark) and shuffles the encounter deck. Each player reveals a card; the stage cannot be advanced until Bridge of Khazad-dûm is in the victory display.
    {
      id: "03064:setup:1",
      cardCode: "03064",
      lines: ["03064:A:1"],
      timing: "setup",
      instructions: [{ verb: "SetAside", code: TORCH }, { verb: "Pick", pick: { type: "hero", control: "any", attachable: TORCH, who: "firstPlayer" } }, { verb: "AttachSetAside", code: TORCH, removeWhenLeaving: true }, { verb: "ShuffleEncounterDeck" }],
    },
    { id: "03064:whenRevealed:1", cardCode: "03064", lines: ["03064:B:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }] },
    { id: "03064:constant:1", cardCode: "03064", lines: ["03064:B:2"], timing: "constant", condition: { kind: "inVictory", code: BRIDGE, is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 03065 Goblin Patrol. B:1: each player in order searches the deck and discard pile for an enemy, one of the choices being Patrol Leader, if able (the first player names the player whose search takes it). B:2: an enemy revealed from the encounter deck that
    // would stay in the staging area is discarded instead (after its reveal resolved: an enemy that engaged a player through its When Revealed is not in the staging area). B:3: with no enemy in play the stage advances at once (the settle sweep reads the flag), and 11 progress also advances it.
    {
      id: "03065:whenRevealed:1",
      cardCode: "03065",
      lines: ["03065:B:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } },
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "enemy", to: "staging", require: PATROL_LEADER, requireFor: "picked" }] },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    {
      id: "03065:forced:1",
      cardCode: "03065",
      lines: ["03065:B:2"],
      timing: "forced",
      trigger: "revealed",
      byEncounterDeck: true,
      subject: { type: "enemy", control: "any" },
      instructions: [{ verb: "MoveEncounterCard", card: "subject", to: "discard", when: { kind: "matches", card: "subject", inStaging: true, pick: { type: "enemy", control: "any" } } }],
    },
    { id: "03065:constant:1", cardCode: "03065", lines: ["03065:B:3"], timing: "constant", condition: { kind: "enemyInPlay", is: false }, instructions: [{ verb: "ModifyStat", stat: "advanceNow", amount: 1, until: "whileSourceInPlay", target: "self" }] },

    // 03066 A Way Up: the heroes collect no resources in the resource phase; defeating this stage wins the game.
    { id: "03066:constant:1", cardCode: "03066", lines: ["03066:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noCollection", amount: 1, until: "whileSourceInPlay", target: "heroes" }] },
    copyLine("142042:B:3", "03066:B:2"),
  ],
  { pool: [...CAVES, ...TDOM, ...JOURNEY_IN_THE_DARK] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
