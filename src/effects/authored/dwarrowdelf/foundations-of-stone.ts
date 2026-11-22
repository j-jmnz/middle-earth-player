import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as ROAD_TO_RIVENDELL } from "./road-to-rivendell.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Foundations of Stone (Dwarrowdelf part 8, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json). The Surge, Doomed, Restricted and Victory lines are keywords. The "Place the Foundations of Stone encounter set aside" sentence of the Setup is the
// `encounterDeck2` pile's SetAside instructions (data/scenarios), as Journey in the Dark's. The Twists and Turns, Deeps of Moria and Goblins of the Deep cards and Cave Torch have their records elsewhere. The Nightmare deck's records are in ../nightmare/foundations-of-stone.ts. The readings are in
// docs/scenarios/dwarrowdelf.md (Foundations of Stone).
// Rules: dwd.setup-foundations-of-stone, dwd.setup-foundations-of-stone-cave-torch, dwd.cave-torch, dwd.creating-a-staging-area, dwd.joining-another-player, mec109.multiple-staging-areas, mec108.create-staging-area, mec108.joining-another-player, rr.first-player, rr.forced, rr.reveal,
// rr.staging-area, rr.attachment-cards, rr.objective-cards, rr.explored, rr.active-location, rr.hit-points, rr.discard-pile-and-victory-display, rr.removed-from-game, rr.ranged, rr.shadow-effects, rr.winning-the-game, rr.travel (data/rules/entries.json).
const TORCH = "03041";
// The four stage 4 cards: each player draws one at random (04113:B:1).
const STAGE_FOURS = ["04114", "04115", "04116", "04117"];
const STAGE_FIVE = "04118";

const A_NAMELESS_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Nameless", staging: true, atStage: true };
const ATTACKER_IS_NAMELESS: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Nameless" } };
const IN_ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const ITEMS_AND_ARMOUR: PickSpec = { type: "card", control: "any", traits: ["Item", "Armor", "Weapon", "Light"] };

/** "X is the printed cost of all attached cards on this card. If there are no cards attached, X is `ifNone`": the Nameless enemy's Attack and hit points (04125:A:2, 04126:A:2). */
const nameless = (code: string, line: string, ifNone: number): Effect => ({
  id: `${code}:constant:1`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  instructions: [
    { verb: "ModifyStat", stat: "attack", amount: { namelessCost: ifNone }, until: "whileSourceInPlay", target: "self" },
    { verb: "ModifyStat", stat: "hitPoints", amount: { namelessCost: ifNone }, until: "whileSourceInPlay", target: "self" },
  ],
});

/** Stage 4's Forced effect (04114:B:2 to 04117:B:2): the stage is complete at its Nth progress token and does not advance by the ordinary rule; at the beginning of the travel phase the player joins another player, or every player goes on to stage 5 together. */
const stageFour = (code: string, points: number, reveals: Instruction[]): Effect[] => [
  { id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:B:1`], timing: "whenRevealed", instructions: reveals },
  {
    id: `${code}:forced:1`,
    cardCode: code,
    lines: [`${code}:B:2`],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Travel" }, { kind: "less", left: points - 1, right: { stat: "progress", of: "self" } }] },
    instructions: [{ verb: "JoinAnotherPlayer", advanceTo: STAGE_FIVE, holdsStage: true }],
  },
];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 04111 The Dripping Walls. Setup: the first player attaches Cave Torch to a hero of any player (removed from the game if it would leave play, dwd.cave-torch); the encounter deck is shuffled. B:1: one card per player (a copy of Approaching Rivendell's).
    {
      id: "04111:setup:1",
      cardCode: "04111",
      lines: ["04111:A:1"],
      timing: "setup",
      instructions: [{ verb: "SetAside", code: TORCH }, { verb: "Pick", pick: { type: "hero", control: "any", attachable: TORCH, who: "firstPlayer" } }, { verb: "AttachSetAside", code: TORCH, removeWhenLeaving: true }, { verb: "ShuffleEncounterDeck" }],
    },
    copyLine("04040:B:1", "04111:B:1"),

    // 04112 The Water's Edge. B:1: each player who committed characters to the quest discards the top 2 cards of his deck (as the staging step begins, once the commitment is made).
    {
      id: "04112:forced:1",
      cardCode: "04112",
      lines: ["04112:B:1"],
      timing: "forced",
      trigger: "stagingStepBegins",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: 2, when: { kind: "canPick", pick: { type: "character", control: "you", committed: true } } }] }],
    },

    // 04113 Washed Away!. B:1: every Item, Armor, Weapon and Light card in play and every encounter card in play (the staging area, the active location, engaged enemies, encounter attachments, objectives) is discarded; the enemy and treachery cards of the encounter discard pile and the set-aside
    // Foundations of Stone set are the new encounter deck and every other encounter card leaves the game; then, starting with the first player, each player draws a random stage 4 card (revealed for him), the other stage 4 cards leave the game and the shared stage is done.
    {
      id: "04113:whenRevealed:1",
      cardCode: "04113",
      lines: ["04113:B:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "DiscardAllInPlay", pick: ITEMS_AND_ARMOUR },
        { verb: "DiscardAllInPlay", pick: { type: "enemy", control: "any", staging: true } },
        { verb: "DiscardAllInPlay", pick: { type: "location", control: "any" } },
        { verb: "DiscardAllInPlay", pick: { type: "attachment", control: "any", playerCard: false } },
        { verb: "DiscardAllInPlay", pick: { type: "objective", control: "any", stagingOnly: true } },
        { verb: "ReplaceEncounterDeck", set: "Foundations of Stone", keep: ["enemy", "treachery"] },
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "StartRandomSeparateStage", codes: STAGE_FOURS }] },
        { verb: "RemoveUnusedStages", codes: STAGE_FOURS },
        { verb: "DiscardSharedStage" },
      ],
    },

    // 04114 to 04117 Below the Mines (stage 4). B:1: the player's own staging area was created as the stage was drawn; he reveals 2 (4) cards into it, or discards his resources or his hand first. B:2: complete at the Nth progress token, then he joins another player at the beginning of the
    // travel phase, or every player goes on to stage 5 together.
    ...stageFour("04114", 11, [{ verb: "RevealEncounter", times: 2 }]),
    ...stageFour("04115", 17, [{ verb: "Each", pick: { type: "hero", control: "you" }, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] }]),
    ...stageFour("04116", 7, [{ verb: "DiscardHand" }, { verb: "RevealEncounter", times: 2 }]),
    ...stageFour("04117", 5, [{ verb: "RevealEncounter", times: 4 }]),

    // 04118 Out of the Depths (stage 5). B:1: one card per player. B:2: a player cannot commit more allies than the heroes he commits. B:3: defeating it wins the game.
    copyLine("04040:B:1", "04118:B:1"),
    { id: "04118:constant:1", cardCode: "04118", lines: ["04118:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "commitAlliesLimitByHeroes", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    copyLine("04040:B:3", "04118:B:3"),

    // 04119 Durin's Axe, 04120 Durin's Helm. A:2: the attached hero gets +3 Attack (+1 Defense), and a Dwarf also +1 Willpower (+2 hit points). A:3 Action: any player exhausts a hero to claim the objective (in the staging area) and it attaches to that hero.
    { id: "04119:constant:1", cardCode: "04119", lines: ["04119:A:2"], timing: "constant", condition: { kind: "matches", card: "host", pick: { type: "hero", control: "any" } }, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "whileSourceInPlay", target: "host" }] },
    { id: "04119:constant:2", cardCode: "04119", lines: ["04119:A:2"], timing: "constant", condition: { kind: "matches", card: "host", pick: { type: "hero", control: "any", trait: "Dwarf" } }, instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", target: "host" }] },
    {
      id: "04119:action:1",
      cardCode: "04119",
      lines: ["04119:A:3"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "freeOfEncounters" }, { kind: "canPick", pick: { type: "hero", control: "you", state: "ready", canExhaust: true } }] },
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", state: "ready", canExhaust: true } }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }],
    },
    { id: "04120:constant:1", cardCode: "04120", lines: ["04120:A:2"], timing: "constant", condition: { kind: "matches", card: "host", pick: { type: "hero", control: "any" } }, instructions: [{ verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" }] },
    { id: "04120:constant:2", cardCode: "04120", lines: ["04120:A:2"], timing: "constant", condition: { kind: "matches", card: "host", pick: { type: "hero", control: "any", trait: "Dwarf" } }, instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: 2, until: "whileSourceInPlay", target: "host" }] },
    copyLine("04119:A:3", "04120:A:3"),

    // 04121 Drowned Treasury. A:1: at the end of the quest phase, while it is the active location, each player discards a character he controls, a hero included. A:2: once explored, each player in turn may draw 2 cards or claim an objective in the staging area (a hero he chooses takes it, no exhausting).
    {
      id: "04121:forced:1",
      cardCode: "04121",
      lines: ["04121:A:1"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, IN_ACTIVE] },
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] }],
    },
    {
      id: "04121:response:1",
      cardCode: "04121",
      lines: ["04121:A:2"],
      timing: "response",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "draw", instructions: [{ verb: "Draw", amount: 2 }] },
                {
                  id: "claim",
                  requires: { kind: "canPick", pick: { type: "objective", control: "any", stagingOnly: true, hasGuard: false } },
                  instructions: [{ verb: "Pick", pick: { type: "objective", control: "any", stagingOnly: true, hasGuard: false } }, { verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "ClaimObjective", card: "previous" }],
                },
                { id: "neither", instructions: [] },
              ],
            },
          ],
        },
      ],
    },

    // 04122 Mithril Lode. A:2: while it is the active location it has a Refresh Action any player may use, once each round in all: exhaust a character you control to place X progress on the current quest card, bypassing the active location, X the exhausted character's Willpower.
    {
      id: "04122:action:1",
      cardCode: "04122",
      lines: ["04122:A:2"],
      timing: "action",
      anyPlayer: true,
      limit: "oncePerRound",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, IN_ACTIVE, { kind: "canPick", pick: { type: "character", control: "you", state: "ready" } }] },
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "AddStageProgress", amount: { stat: "willpower", of: "picked" } }],
    },

    // 04123 Deep Deep Dark (Surge, Doomed 1). A:2: each Nameless enemy in play at the staging area gets the top card of the first player's deck. A:3 (Shadow) and 04124 Lost and Alone's A:2: when the attacking enemy is Nameless the defending player discards his hand.
    { id: "04123:whenRevealed:1", cardCode: "04123", lines: ["04123:A:2"], timing: "whenRevealed", instructions: [{ verb: "Each", pick: A_NAMELESS_ENEMY, instructions: [{ verb: "AttachDeckTop", deck: "firstPlayer", to: "picked" }] }] },
    { id: "04123:shadow:1", cardCode: "04123", lines: ["04123:A:3"], timing: "shadow", instructions: [{ verb: "DiscardHand", when: ATTACKER_IS_NAMELESS }] },

    // 04124 Lost and Alone. A:1: each player at the staging area chooses a hero he controls and shuffles it into his deck; it is put into play when he draws it.
    { id: "04124:whenRevealed:1", cardCode: "04124", lines: ["04124:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "ShuffleHeroIntoDeck" }] }] },
    copyLine("04123:A:3", "04124:A:2"),

    // 04125 Nameless Thing, 04126 Elder Nameless Thing. A:1: after it engages a player it gets the top 2 (3) cards of that player's deck. A:2: X, its Attack and hit points, is the printed cost of the attached cards (3, 4 with none).
    { id: "04125:forced:1", cardCode: "04125", lines: ["04125:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "AttachDeckTop", count: 2 }] },
    nameless("04125", "04125:A:2", 3),
    { id: "04126:forced:1", cardCode: "04126", lines: ["04126:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "AttachDeckTop", count: 3 }] },
    nameless("04126", "04126:A:2", 4),

    // 04127 Moria Bats. A:1: only characters with ranged can attack or defend against it. A:2: while engaged it gets +1 Attack for each other enemy engaged with that player.
    { id: "04127:constant:1", cardCode: "04127", lines: ["04127:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "onlyRangedCombat", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "04127:constant:2",
      cardCode: "04127",
      lines: ["04127:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "engaged" },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: { type: "enemy", control: "any", engaged: "you", other: true } }, until: "whileSourceInPlay", target: "self" }],
    },
  ],
  { pool: ROAD_TO_RIVENDELL },
);

export const AUTHORED_REPLACES: readonly string[] = [];
