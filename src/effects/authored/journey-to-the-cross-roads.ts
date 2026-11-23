import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as CAVES } from "./the-caves-of-nibin-dum.ts";
import { AUTHORED_EFFECTS as FATE_OF_WILDERLAND } from "./the-fate-of-wilderland.ts";
import { AUTHORED_EFFECTS as LOST_IN_MIRKWOOD } from "./lost-in-mirkwood.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for Journey to the Cross-roads (the-two-towers part 5, campaign card 144069, whose records are in the-two-towers.ts): the Harad deck lying under The Cross-roads (the wilderland pile `harad`), the enemies facedown
// under The Black Gate (the harad family), the locations' lines and the Men of Harad. Every line is read from the scan ledger (data/printed/the-two-towers.json); a line a template already writes (pnpm data:build) or another card
// prints word for word needs no record here. See docs/scenarios/the-two-towers/journey-to-the-cross-roads.md, Journey to the Cross-roads, for each reading.
// Rules: mec112.setup-journey-to-the-cross-roads, mec112.multiplayer-the-one-ring, mec109.archery, rr.forced, rr.travel, rr.cannot, rr.first-player, rr.effects, rr.engaged, rr.reveal, rr.search, rr.lasting-effects, rr.step-6-4-2, rr.victory (data/rules/entries.json).
const BLACK_GATE = "144027";
const CROSS_ROADS = "144030";
const HENNETH_ANNUN = "Henneth Annûn";
const HARAD_ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", trait: "Harad", engaged: "you" };
const HARAD_IN_STAGING: PickSpec = { type: "enemy", control: "any", trait: "Harad", stagingOnly: true };
const ANY_HERO: PickSpec = { type: "hero", control: "any" };
const ANY_PLAYER: PickSpec = { type: "player", control: "any" };
type Cond = NonNullable<Effect["condition"]>;
// "While Henneth Annûn is the active location ... ignore the Forced effects on stage 1B and The Black Gate" (144031:A:1): the two Forced records of those cards hold only while it is not.
const HENNETH_NOT_ACTIVE: Cond = { kind: "count", pick: { type: "location", control: "any", active: true, names: [HENNETH_ANNUN] }, max: 0 };
const PLACE_UNDER_GATE = (target: "picked" | "self"): Extract<Instruction, { verb: "PlaceFacedownUnder" }> => ({ verb: "PlaceFacedownUnder", code: BLACK_GATE, target });
// "Each Harad enemy ... until the end of the round" reaches the enemies that arrive later in the round too (rr.lasting-effects).
const HARAD_ENEMIES = { target: "enemies", trait: "Harad" } as const;

// "(choose 2): heal up to 2 damage from a hero, add 2 resources to a hero's pool, choose a player to draw 2 cards, or reduce a player's threat by 2": two different options (an option nothing can change cannot be chosen, rr.effects).
const CONEYS_CHOICE: Instruction = {
  verb: "Choose",
  who: "actor",
  different: true,
  options: [
    { id: "heal", requires: { kind: "canPick", pick: { ...ANY_HERO, damaged: true } }, instructions: [{ verb: "Pick", pick: { ...ANY_HERO, damaged: true } }, { verb: "Heal", amount: 2, target: "picked" }] },
    { id: "resources", requires: { kind: "canPick", pick: ANY_HERO }, instructions: [{ verb: "Pick", pick: ANY_HERO }, { verb: "AddResources", amount: 2, to: "picked" }] },
    { id: "draw", instructions: [{ verb: "Pick", pick: ANY_PLAYER }, { verb: "Draw", amount: 2, who: "picked" }] },
    { id: "threat", instructions: [{ verb: "Pick", pick: ANY_PLAYER }, { verb: "LowerThreat", amount: 2, who: "picked" }] },
  ],
};

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 144014 Brace of Coneys: the Ring-bearer is a hero the player controls (mec112.multiplayer-the-one-ring).
    { id: "144014:constant:1", cardCode: "144014", lines: ["144014:A:1"], timing: "constant", instructions: [{ verb: "PlayOnlyIf", condition: { kind: "count", pick: { type: "hero", control: "you", trait: "Ring-bearer" }, min: 1 } }] },
    { id: "144014:action:1", cardCode: "144014", lines: ["144014:A:2"], timing: "action", condition: { kind: "phase", is: "Planning" }, instructions: [{ verb: "AddSourceToVictory" }, CONEYS_CHOICE, { ...CONEYS_CHOICE }] },

    // 144027 The Black Gate. A card placed under it is out of play (the zone `under`). The Forced effect is ignored while Henneth Annûn is the active location; the loss line is not.
    {
      id: "144027:forced:1", cardCode: BLACK_GATE, lines: ["144027:A:1"], timing: "forced", trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Planning" }, HENNETH_NOT_ACTIVE] },
      instructions: [{ verb: "Each", pick: HARAD_IN_STAGING, instructions: [PLACE_UNDER_GATE("picked")] }],
    },
    // X is 3 more than the number of players, so the loss holds whenever the cards under it reach that number, a seat's elimination included (as 143022:constant:2). gateTally reads the number from here.
    {
      id: "144027:constant:1", cardCode: BLACK_GATE, lines: ["144027:A:2"], timing: "constant",
      condition: { kind: "facedownUnder", code: BLACK_GATE, min: 3, players: true }, instructions: [{ verb: "LoseGame", reason: "The Black Gate has taken too many Harad enemies" }],
    },

    // 144028 Man of Harad (Surge and Archery 1 are keywords).
    { id: "144028:forced:1", cardCode: "144028", lines: ["144028:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "DiscardRandomFromHand" }] },
    { id: "144028:shadow:1", cardCode: "144028", lines: ["144028:A:3"], timing: "shadow", instructions: [{ verb: "DiscardRandomFromHand" }] },

    // 144029 Captain of Harad: every Harad enemy for the round, the Harad deck's included.
    {
      id: "144029:forced:1", cardCode: "144029", lines: ["144029:A:1"], timing: "forced", trigger: "engaged", subject: "self",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", ...HARAD_ENEMIES }, { verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "endOfRound", ...HARAD_ENEMIES }],
    },
    { id: "144029:shadow:1", cardCode: "144029", lines: ["144029:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: { kind: "x", min: 1 } }] }] },

    // 144030 The Cross-roads: Threat 9 less one for each card left in the Harad deck; travel only with the deck empty and 20 progress on stage 1B.
    { id: "144030:constant:1", cardCode: CROSS_ROADS, lines: ["144030:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { pile: "harad", negative: true }, until: "whileSourceInPlay", target: "self" }] },
    // No travel while a facedown card is left under it, nor before 20 progress is on stage 1B: each is its own bar.
    { id: "144030:constant:2", cardCode: CROSS_ROADS, lines: ["144030:A:2"], timing: "constant", condition: { kind: "pileHas", pile: "harad", min: 1 }, instructions: [{ verb: "Restrict", what: "travel" }] },
    { id: "144030:constant:3", cardCode: CROSS_ROADS, lines: ["144030:A:2"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 20 } }, instructions: [{ verb: "Restrict", what: "travel" }] },

    // 144031 Henneth Annûn: no encounter or combat phase while active (the two ignored Forced effects are in 144027:forced:1 and 144068:forced:1).
    {
      id: "144031:constant:1", cardCode: "144031", lines: ["144031:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "skipEncounter", amount: 1, until: "whileSourceInPlay", target: "table" }, { verb: "ModifyStat", stat: "skipCombat", amount: 1, until: "whileSourceInPlay", target: "table" }],
    },
    { id: "144031:forced:1", cardCode: "144031", lines: ["144031:A:2"], timing: "forced", trigger: "becameActive", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }] },

    // 144032 Southward Road: the cost is the top card of the Harad deck, revealed into the staging area (no card left, no travel).
    { id: "144032:constant:1", cardCode: "144032", lines: ["144032:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "extraOptionalEngage", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
    { id: "144032:travel:1", cardCode: "144032", lines: ["144032:A:2"], timing: "travel", instructions: [{ verb: "AddFromPile", pile: "harad", to: "staging", reveal: true }] },

    // 144033 Foothills of Ephel Dúath: the first player engages an enemy in the staging area as the cost (any enemy).
    { id: "144033:constant:1", cardCode: "144033", lines: ["144033:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "threat", amount: -1, until: "whileSourceInPlay", ...HARAD_ENEMIES }] },
    { id: "144033:travel:1", cardCode: "144033", lines: ["144033:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, who: "firstPlayer" } }, { verb: "Engage", target: "picked" }] },

    // 144034 Ithilien Woods and 144035 Hills of Ithilien: the gained Forced effects hear every engagement of a Harad enemy.
    {
      id: "144034:forced:1", cardCode: "144034", lines: ["144034:A:1"], timing: "forced", trigger: "engaged", subject: { type: "enemy", control: "any", trait: "Harad" }, condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "exhausted" } }, { verb: "Ready", target: "picked" }],
    },
    { id: "144034:travel:1", cardCode: "144034", lines: ["144034:A:2"], timing: "travel", instructions: [{ verb: "RevealEncounter", who: "firstPlayer" }] },
    {
      id: "144035:forced:1", cardCode: "144035", lines: ["144035:A:1"], timing: "forced", trigger: "engaged", subject: { type: "enemy", control: "any", trait: "Harad" }, condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }],
    },
    copyLine("19167:A:2", "144035:A:2"),

    // 144036 The Dark Lord's Summons (Peril is a keyword): an option nothing can fulfil cannot be chosen (rr.effects); ties on the lowest Attack go to the revealing player.
    {
      id: "144036:whenRevealed:1", cardCode: "144036", lines: ["144036:A:2"], timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose", who: "actor",
          options: [
            { id: "place", requires: { kind: "canPick", pick: HARAD_ENGAGED_WITH_YOU }, instructions: [{ verb: "Pick", pick: { ...HARAD_ENGAGED_WITH_YOU, lowestAttack: true } }, PLACE_UNDER_GATE("picked")] },
            { id: "reveal", requires: { kind: "pileHas", pile: "harad", min: 1 }, instructions: [{ verb: "AddFromPile", pile: "harad", to: "engaged", reveal: true }] },
          ],
        },
      ],
    },

    // 144037 Marching Up the Road: the search is of the encounter deck alone and shuffles nothing (the card prints no shuffle); no Harad enemy there, no option.
    {
      id: "144037:whenRevealed:1", cardCode: "144037", lines: ["144037:A:1"], timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer", order: "firstFirst",
          instructions: [
            {
              verb: "Choose", who: "actor",
              options: [
                { id: "return", requires: { kind: "hasEngaged" }, instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "actor", pick: "choose" } }] },
                { id: "search", requires: { kind: "searchable", trait: "Harad", deckOnly: true }, instructions: [{ verb: "SearchMove", trait: "Harad", type: "enemy", to: "engaged", deckOnly: true }] },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "144037:shadow:1", cardCode: "144037", lines: ["144037:A:2"], timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ ...PLACE_UNDER_GATE("self"), when: { kind: "x", min: 1 } }] }],
    },

    // 144038 Fierce Southrons (Peril is a keyword): the first option is offered only while a Harad enemy is in the staging area (agent recommendation, docs/brief.md); the second while any enemy is.
    {
      id: "144038:whenRevealed:1", cardCode: "144038", lines: ["144038:A:2"], timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose", who: "actor",
          options: [
            { id: "place", requires: { kind: "canPick", pick: HARAD_IN_STAGING }, instructions: [{ verb: "Pick", pick: { ...HARAD_IN_STAGING, lowestThreat: true } }, PLACE_UNDER_GATE("picked"), { verb: "RevealEncounter" }] },
            {
              id: "attack", requires: { kind: "canPick", pick: { type: "enemy", control: "any", stagingOnly: true } },
              instructions: [{ verb: "Each", pick: { type: "enemy", control: "any", stagingOnly: true }, instructions: [{ verb: "AttackFromStaging" }] }],
            },
          ],
        },
      ],
    },

    // 144039 Arrows Thick in the Air: Archery 2 gained adds to the printed Archery of each Harad enemy, later arrivals included. The defending player chooses the Shadow option.
    { id: "144039:whenRevealed:1", cardCode: "144039", lines: ["144039:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "archery", amount: 2, until: "endOfRound", ...HARAD_ENEMIES }] },
    {
      id: "144039:shadow:1", cardCode: "144039", lines: ["144039:A:2"], timing: "shadow",
      instructions: [
        {
          verb: "Choose", who: "actor",
          options: [
            { id: "place", instructions: [{ verb: "PlaceFacedownUnder", code: BLACK_GATE, target: "self", afterAttack: true }] },
            { id: "attack", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },
          ],
        },
      ],
    },

    // 144056 Oliphaunt (the Shadow is a template).
    { id: "144056:constant:1", cardCode: "144056", lines: ["144056:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "damageCap", amount: 3, until: "whileSourceInPlay", target: "self" }] },
    { id: "144056:forced:1", cardCode: "144056", lines: ["144056:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Each", pick: { type: "ally", control: "you" }, instructions: [{ verb: "Exhaust", target: { kind: "picked" } }] }] },

    // 144057 Haradrim Soldier.
    copyLine("18035:A:1", "144057:A:1"),
    // The additional attack its Shadow grants is dealt a new shadow card, the old ones discarded first (faq.additional-attacks).
    { id: "144057:shadow:1", cardCode: "144057", lines: ["144057:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },

    // 144058 Haradrim Archer: Threat X and Archery X, X the number of players (the card prints Threat X).
    { id: "144058:constant:1", cardCode: "144058", lines: ["144058:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "archery", amount: { players: true }, until: "whileSourceInPlay" }] },
    { id: "144058:forced:1", cardCode: "144058", lines: ["144058:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "AssignDamage", amount: { players: true }, pick: { type: "character", control: "you" } }] },
    copyLine("41039:A:2", "144058:A:3"),

    // 144068 Ambush the Men of Harad. Stage 1A's Setup: The Black Gate and The Cross-roads are placed and the Men of Harad lie under the Cross-roads by the data; each player but the first searches for a different non-unique location.
    {
      id: "144068:setup:1", cardCode: "144068", lines: ["144068:A:1"], timing: "setup",
      instructions: [
        { verb: "ShufflePile", pile: "harad" },
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "location", nonUnique: true, to: "staging", different: true, when: { kind: "not", condition: { kind: "firstPlayer" } } }] },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    {
      id: "144068:forced:1", cardCode: "144068", lines: ["144068:B:1"], timing: "forced", trigger: "beginningOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, HENNETH_NOT_ACTIVE] },
      instructions: [{ verb: "AddFromPile", pile: "harad", to: "staging", reveal: true }],
    },
    { id: "144068:constant:1", cardCode: "144068", lines: ["144068:B:2"], timing: "constant", condition: { kind: "inPlay", code: CROSS_ROADS, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "144068:forced:2", cardCode: "144068", lines: ["144068:B:2"], timing: "forced", trigger: "locationExplored", subject: { type: "location", control: "any", names: ["The Cross-roads"] }, instructions: [{ verb: "WinGame" }] },
  ],
  { pool: [...FATE_OF_WILDERLAND, ...LOST_IN_MIRKWOOD, ...CAVES] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
