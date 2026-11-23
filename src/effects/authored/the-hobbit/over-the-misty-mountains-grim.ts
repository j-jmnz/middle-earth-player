import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THE_LONG_DARK } from "../dwarrowdelf/the-long-dark.ts";
import { AUTHORED_EFFECTS as FLIGHT_TO_THE_FORD } from "../flight-to-the-ford.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Over the Misty Mountains Grim (The Hobbit, Over Hill and Under Hill, part 2; no campaign card). The Misty Mountain Goblins set is shared with Dungeons Deep and Caverns Dim (set-misty-mountain-goblins.ts) and
// Western Lands with We Must Away, Ere Break of Day (set-western-lands.ts); this file holds the quest, Over the Misty Mountains Grim and The Great Goblin. Readings: docs/scenarios/the-hobbit.md (Over the Misty Mountains Grim).
// Rules: hob.setup-over-the-misty-mountains-grim, hob.active-and-inactive-encounter-decks, hob.bilbo-baggins-ohauh, hob.baggins-sphere-ohauh, rr.victory, rr.search, rr.reveal, rr.active-location, rr.forced, rr.delayed-effects (data/rules/entries.json).
const GREAT_GOBLIN = "131063";
const STONE_GIANT = "131064";
const BILBO: PickSpec = { type: "hero", control: "any", names: ["Bilbo Baggins"] };
const TREASURE_IN_DECK: PickSpec = { type: "card", control: "you", from: "deck", cardType: "treasure" };
const GOBLIN_ENEMIES: PickSpec = { type: "enemy", control: "any", trait: "Goblin", staging: true };
const STONE_GIANT_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, names: ["Stone-Giant"] };
/** "If The Great Goblin is in the victory display". */
const GREAT_GOBLIN_WON: Condition = { kind: "inVictory", code: GREAT_GOBLIN, is: true };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 131026 A Short Rest. The deck piles come from the scenario's data (the second deck is set aside, inactive); the Setup shuffles the first. B: each player may search his deck for a treasure, then the stage advances.
    { id: "131026:setup:1", cardCode: "131026", lines: ["131026:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
    {
      id: "131026:whenRevealed:1",
      cardCode: "131026",
      lines: ["131026:B:1"],
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
                { id: "search", requires: { kind: "canPick", pick: TREASURE_IN_DECK }, instructions: [{ verb: "Pick", pick: TREASURE_IN_DECK }, { verb: "MovePicked", to: "hand" }] },
                { id: "decline", instructions: [] },
              ],
            },
            { verb: "ShuffleDeck" },
          ],
        },
        { verb: "AdvanceStage" },
      ],
    },

    // 131027 The Mountain Pass. B: a Stone-giant found in the encounter deck goes to the staging area, the deck is shuffled, and each player reveals 1 card.
    {
      id: "131027:whenRevealed:1",
      cardCode: "131027",
      lines: ["131027:B:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "SearchMove", code: STONE_GIANT, type: "enemy", to: "staging", deckOnly: true }, { verb: "ShuffleEncounterDeck" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }],
    },

    // 131028 Down, Down to Goblin Town. A: the cards in play go to the discard pile, the first deck and its discard pile are set aside inactive, the second deck (Misty Mountain Goblins, The Great Goblin) is shuffled in, The Great Goblin is searched
    // to the staging area and the deck shuffled (the swap of From Sea to Land, families/sea/swap.ts). B:1 as 148002:B:2. B:2: the first player may spend X Baggins resources from Bilbo's pool to reveal X fewer cards (reading: the first player is Bilbo's controller).
    {
      id: "131028:whenRevealed:1",
      cardCode: "131028",
      lines: ["131028:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "DiscardAllInPlay", pick: { type: "enemy", control: "any", staging: true } },
        { verb: "DiscardAllInPlay", pick: { type: "location", control: "any", staging: true } },
        { verb: "SetAsideEncounterDeck" },
        { verb: "ShuffleSetAsideSet", set: "Misty Mountain Goblins" },
        { verb: "ShuffleSetAsideSet", set: "The Great Goblin" },
        { verb: "SearchMove", code: GREAT_GOBLIN, type: "enemy", to: "staging", deckOnly: true },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    { id: "131028:constant:1", cardCode: "131028", lines: ["131028:B:1"], timing: "constant", condition: { kind: "inVictory", code: GREAT_GOBLIN, is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },
    {
      id: "131028:whenRevealed:2",
      cardCode: "131028",
      lines: ["131028:B:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ChooseX", min: 0, max: [{ stat: "resources", ofNamed: "Bilbo Baggins" }] },
        { verb: "Pick", pick: BILBO, when: { kind: "canPick", pick: BILBO } },
        { verb: "DiscardResources", amount: { x: true }, target: "picked", when: { kind: "canPick", pick: BILBO } },
        { verb: "RevealEncounter", times: { players: true, times: 3 }, lessX: true },
      ],
    },
    copyLine("04087:B:3", "131028:B:3"),

    // 131062 Goblin Bent-Swords. Surge while The Great Goblin is in the victory display; the Shadow is +1 Attack, +2 with him there.
    { id: "131062:constant:1", cardCode: "131062", lines: ["131062:A:1"], timing: "constant", condition: GREAT_GOBLIN_WON, instructions: [{ verb: "ModifyStat", stat: "gainsSurge", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "131062:shadow:1",
      cardCode: "131062",
      lines: ["131062:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: GREAT_GOBLIN_WON } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: GREAT_GOBLIN_WON },
      ],
    },

    // 131063 The Great Goblin. After he attacks, X cards (the players in the game) are discarded from the encounter deck and each Goblin enemy among them goes to the staging area (the others stay in the discard pile).
    {
      id: "131063:forced:1",
      cardCode: "131063",
      lines: ["131063:A:1"],
      timing: "forced",
      trigger: "attackResolved",
      subject: "self",
      instructions: [{ verb: "DiscardEncounterTop", count: { players: true } }, { verb: "StageDiscarded", type: "enemy", trait: "Goblin" }],
    },

    // 131064 Stone-Giant. Each copy in the staging area gives Galloping Boulders surge; after it engages a player, that player chooses and discards an ally he controls.
    {
      id: "131064:constant:1",
      cardCode: STONE_GIANT,
      lines: ["131064:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "gainsSurge", amount: 1, until: "whileSourceInPlay", holders: { type: "treachery", control: "any", names: ["Galloping Boulders"] } }],
    },
    { id: "131064:forced:1", cardCode: STONE_GIANT, lines: ["131064:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" } }, { verb: "DiscardPicked" }] },

    // 131066 Front Porch. While active, players cannot attack Goblin enemies. Action: the first player spends 2 Baggins resources to blank its printed text box until the end of the round.
    { id: "131066:constant:1", cardCode: "131066", lines: ["131066:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "cannotBeAttacked", amount: 1, until: "whileSourceInPlay", holders: GOBLIN_ENEMIES }] },
    {
      id: "131066:action:1",
      cardCode: "131066",
      lines: ["131066:A:2"],
      timing: "action",
      cost: { kind: "resources", amount: 2, sphere: "baggins" },
      condition: { kind: "firstPlayer" },
      instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", target: "self" }],
    },

    // 131067 Great Cavern Room. While active it gains the Forced effect: after a player engages a Goblin enemy, he deals 1 damage to a character he controls. The players must travel to it with The Great Goblin in the victory display.
    {
      id: "131067:forced:1",
      cardCode: "131067",
      lines: ["131067:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: { type: "enemy", control: "any", trait: "Goblin" },
      condition: ACTIVE,
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DamageCard", amount: 1, target: "picked" }],
    },
    {
      id: "131067:constant:1",
      cardCode: "131067",
      lines: ["131067:A:2"],
      timing: "constant",
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, GREAT_GOBLIN_WON] },
      instructions: [{ verb: "Restrict", what: "travelOnly" }],
    },

    // 131068 Overhanging Rock. While active it gains the Action: spend 1 Baggins resource, look at the top 2 cards of your deck, add 1 to your hand and discard the other (as 132018:A:2).
    {
      id: "131068:action:1",
      cardCode: "131068",
      lines: ["131068:A:1"],
      timing: "action",
      cost: { kind: "resources", amount: 1, sphere: "baggins" },
      condition: ACTIVE,
      instructions: [
        { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 2 } },
        { verb: "MovePicked", to: "hand" },
        { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 1 } },
        { verb: "DiscardPicked" },
      ],
    },

    // 131069 The High Pass. X (its Threat) is the number of players; at the end of the round X progress tokens come off the current quest.
    copyLine("141058:A:2", "131069:A:1"),
    { id: "131069:forced:1", cardCode: "131069", lines: ["131069:A:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "RemoveProgressFromQuest", amount: { players: true } }] },

    // 131071 Chaos in the Cavern. Engaged enemies return to the staging area, then each Goblin enemy gets +1 Threat until the end of the phase; the Shadow returns the attacker after its attack.
    {
      id: "131071:whenRevealed:1",
      cardCode: "131071",
      lines: ["131071:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Each", pick: { type: "enemy", control: "any", engaged: "you" }, instructions: [{ verb: "ReturnToStaging", target: { kind: "picked" } }] }] },
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: GOBLIN_ENEMIES },
      ],
    },
    { id: "131071:shadow:1", cardCode: "131071", lines: ["131071:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },

    // 131072 Galloping Boulders. The first player chooses a questing character: it takes 3 damage and leaves the quest. The Shadow puts the card on top of the encounter deck.
    {
      id: "131072:whenRevealed:1",
      cardCode: "131072",
      lines: ["131072:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "any", committed: true, who: "firstPlayer" } }, { verb: "DamageCard", amount: 3, target: "picked" }, { verb: "RemoveFromQuest" }],
    },
    { id: "131072:shadow:1", cardCode: "131072", lines: ["131072:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "deckTop" }] },

    // 131073 Guffawing of Giants. The first player chooses a Stone-giant in the staging area; at the end of the quest phase it engages the player with the highest threat (the first player breaks a tie). With none in the staging
    // area, one found in the encounter deck is added to the staging area (it is not chosen, so it does not engage; reading), and the deck is shuffled.
    {
      id: "131073:whenRevealed:1",
      cardCode: "131073",
      lines: ["131073:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { ...STONE_GIANT_IN_STAGING, who: "firstPlayer" }, when: { kind: "canPick", pick: STONE_GIANT_IN_STAGING } },
        {
          verb: "Delay",
          until: "endOfPhase",
          subject: "picked",
          instructions: [{ verb: "Pick", pick: { type: "player", control: "any", highestThreat: true, who: "firstPlayer" } }, { verb: "SwitchActor", to: "picked" }, { verb: "Engage", target: "previous" }],
        },
        { verb: "SearchMove", code: STONE_GIANT, type: "enemy", to: "staging", deckOnly: true, when: { kind: "not", condition: { kind: "canPick", pick: STONE_GIANT_IN_STAGING } } },
        { verb: "ShuffleEncounterDeck", when: { kind: "not", condition: { kind: "canPick", pick: STONE_GIANT_IN_STAGING } } },
      ],
    },
  ],
  { pool: [...THE_LONG_DARK, ...FLIGHT_TO_THE_FORD] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
