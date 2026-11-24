import type { Amount, Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for Encounter at Amon Dîn (Against the Shadow part 6, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json). The villager tokens are the `resources` of a card (ats.villagers: they do not count as resources): Villagers X is a Forced record on each location that
// places X when it enters play (as a revealed card, as the active location at Setup or by a search) and on the quest stage 1B that places 5 when it is revealed. The verbs, the trigger and the flags are the pelargir family's (families/pelargir/villagers.ts, fewest.ts). The end of the game is records too: stage 2B holds its win and
// sets `gameEnding` when it is defeated, and the constants of Rescued Villagers and Dead Villagers end the game once Ghulat is not in play ("While Ghulat is in play, the game cannot end", rr.cannot). Lord Alcaron leaving play sets `endingLost`: the players lose once Ghulat is not in play (a settle sweep of the family, families/pelargir/ending.ts). The Ravaging Orcs
// (05062 to 05064) keep their records of The Siege of Cair Andros (src/effects/authored/against-the-shadow/the-siege-of-cair-andros.ts). The readings are in docs/scenarios/against-the-shadow/encounter-at-amon-din.md (Readings).
// Rules: ats.setup-encounter-at-amon-din, ats.setup-amon-din-objectives, ats.villagers, ats.villagers-example, ats.villager-tokens-discarded, ats.ally-objectives, rr.winning-the-game, rr.replacement-effects, rr.cannot, rr.response, rr.forced, rr.explored, rr.step-6-4-3, rr.surge (data/rules/entries.json).
const RESCUED = "06068";
const DEAD = "06069";
const GHULAT = "06071";
// The two counts the objectives compare, read live: the villager tokens on Rescued Villagers and the damage tokens on Dead Villagers (also Ghulat's X, Burnt Homestead and Panicked!).
const RESCUED_TOKENS: Amount = { stat: "resources", ofNamed: "Rescued Villagers" };
const DEAD_TOKENS: Amount = { stat: "damage", ofNamed: "Dead Villagers" };
// More villager tokens on Rescued Villagers than damage tokens on Dead Villagers (a tie is not that: the pack insert asks for "more", R1).
const MORE_RESCUED = { kind: "less", left: DEAD_TOKENS, right: RESCUED_TOKENS } as const satisfies Condition;
// No more villager tokens on Rescued Villagers than damage tokens on Dead Villagers (the tokens are fewer or equal: a tie loses). `all` holds atoms only, so "not more" is "less than one more damage token".
const NOT_MORE_RESCUED = { kind: "less", left: RESCUED_TOKENS, right: { ...DEAD_TOKENS, plus: 1 } } as const satisfies Condition;
const GHULAT_GONE: Condition = { kind: "inPlay", code: GHULAT, is: false };
const ENDING = { kind: "flag", stat: "gameEnding", holder: "table" } as const satisfies Condition;
const ALCARON_STAYS = { kind: "flag", stat: "endingLost", holder: "table", is: false } as const satisfies Condition;
// "If no villager token is discarded by this effect": the effect's X is the number the verb discarded or moved.
const NONE_DISCARDED: Condition = { kind: "not", condition: { kind: "x", min: 1 } };
const DESTROYED_A_CHARACTER: Condition = { kind: "x", min: 1 };
const UNDEFENDED = { kind: "undefended" } as const satisfies Condition;
const ANY_LOCATION: PickSpec = { type: "location", control: "any" };
const STAGING_LOCATION: PickSpec = { type: "location", control: "any", stagingOnly: true };
const A_TREACHERY: PickSpec = { type: "treachery", control: "any" };
const HAND_CARDS: PickSpec = { type: "card", control: "you", from: "hand" };
const A_LOCATION_LEFT_PLAY = { trigger: "leftPlay", subject: ANY_LOCATION, condition: { kind: "subjectExplored" } } as const satisfies Partial<Effect>;
// "After Marauding Orc attacks and destroys a character": the character's destruction by the attack names the attacking enemy as the other card.
const DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } } } as const satisfies Partial<Effect>;
type Step = Effect["instructions"][number];
const PLACE_DEAD: Step = { verb: "PlaceDamageOn", code: DEAD, amount: 1 };
const FROM_RESCUED = { code: RESCUED } as const;
// "If this attack destroys a character, discard 1 villager token from Rescued Villagers" (after the damage, so the attack's X counts the characters it destroyed).
const SHADOW_DISCARD: Effect["instructions"] = [{ verb: "AfterAttack", instructions: [{ verb: "DiscardVillagerTokens", from: FROM_RESCUED, amount: 1, when: DESTROYED_A_CHARACTER }] }];

// "Villagers X" (ats.villagers): the card places X villager tokens on itself when it enters play. A card revealed into the staging area enters play there (`encounterEnteredPlay`), a card a search puts into play does not announce it (`searchedIntoPlay`); the active location of the Setup is put in play by the
// scenario's piles and gets its tokens from the Setup record of stage 1.
const VILLAGERS = (code: string, line: string, amount: number): Effect[] => [
  { id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "PlaceResourceTokens", amount, on: "self" }] },
  { id: `${code}:forced:2`, cardCode: code, lines: [line], timing: "forced", trigger: "searchedIntoPlay", subject: "self", instructions: [{ verb: "PlaceResourceTokens", amount, on: "self" }] },
];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 06066 Savagery of the Orcs (stage 1). A:1: Ghulat is set aside by the piles, Lord Alcaron is put into play and given to the first player (06070:A:1), Burning Farmhouse is the active location with its Villagers 4, the two objectives are in the staging area, then the deck is shuffled and 1 card
    // is revealed for each player. B:1: the quest card holds 5 villager tokens from its reveal. B:2: the progress is replaced (no progress, tokens move to Rescued Villagers; the surplus is lost). B:3: no token left on the quest card advances it (a settle sweep of the family).
    {
      id: "06066:setup:1",
      cardCode: "06066",
      lines: ["06066:A:1"],
      timing: "setup",
      instructions: [
        { verb: "TakeControlOfSetAside", code: "06070" },
        { verb: "PlaceResourceTokens", amount: 4, on: "activeLocation" },
        { verb: "ShuffleEncounterDeck" },
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] },
      ],
    },
    { id: "06066:whenRevealed:1", cardCode: "06066", lines: ["06066:B:1"], timing: "whenRevealed", instructions: [{ verb: "PlaceResourceTokens", amount: 5, on: "self" }] },
    { id: "06066:constant:1", cardCode: "06066", lines: ["06066:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressToVillagers", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "06066:triggered:1", cardCode: "06066", lines: ["06066:B:2"], timing: "triggered", trigger: "progressReplaced", instructions: [{ verb: "MoveVillagerTokens", from: "self", to: FROM_RESCUED, amount: { x: true } }] },
    { id: "06066:constant:2", cardCode: "06066", lines: ["06066:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "advancesWithoutVillagers", amount: 1, until: "whileSourceInPlay", target: "self" }] },

    // 06067 Protect the Villagers (stage 2, the last). A:1: Ghulat joins the staging area (the template). B:1: an undefended attack is aimed at Rescued Villagers and its damage becomes discarded tokens. B:2: the stage holds its win; its defeat sets `gameEnding`, and the two objectives end the game once Ghulat is not in play.
    { id: "06067:constant:1", cardCode: "06067", lines: ["06067:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "undefendedToVillagers", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "06067:constant:2", cardCode: "06067", lines: ["06067:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "holdsWin", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "06067:forced:1", cardCode: "06067", lines: ["06067:B:2"], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "ModifyStat", stat: "gameEnding", amount: 1, until: "endOfGame", target: "table" }] },

    // 06068 Rescued Villagers. A:1: a location that leaves play as an explored location moves its villager tokens here. A:2: at the end of the game more tokens here than damage tokens on Dead Villagers is a win.
    { id: "06068:forced:1", cardCode: "06068", lines: ["06068:A:1"], timing: "forced", ...A_LOCATION_LEFT_PLAY, instructions: [{ verb: "MoveVillagerTokens", from: "subject", to: "self", all: true }] },
    { id: "06068:constant:1", cardCode: "06068", lines: ["06068:A:2"], timing: "constant", condition: { kind: "all", conditions: [ENDING, MORE_RESCUED, GHULAT_GONE, ALCARON_STAYS] }, instructions: [{ verb: "WinGame" }] },

    // 06069 Dead Villagers. A:1: each villager token discarded from a location, an objective or the quest stage puts a damage token here (a Forced effect, so it comes before Alcaron's Response). A:2: at the end of the game, with no more tokens on Rescued Villagers than damage tokens here, the players have lost (a tie loses).
    { id: "06069:forced:1", cardCode: "06069", lines: ["06069:A:1"], timing: "forced", trigger: "villagerDiscarded", instructions: [PLACE_DEAD] },
    { id: "06069:constant:1", cardCode: "06069", lines: ["06069:A:2"], timing: "constant", condition: { kind: "all", conditions: [ENDING, NOT_MORE_RESCUED, GHULAT_GONE] }, instructions: [{ verb: "LoseGame", reason: "Dead Villagers: not more villager tokens were rescued than died" }] },

    // 06070 Lord Alcaron. A:1: the first player gains control at Setup (06066:A:1: put into play in the first player's play area). A:2: a Response after a villager token is discarded: exhaust him to place the token on a location (the damage token is on Dead Villagers already). A:3: if he leaves play the players lose, once Ghulat is not in play.
    { id: "06070:constant:1", cardCode: "06070", lines: ["06070:A:1"], timing: "constant", instructions: [] },
    {
      id: "06070:response:1",
      cardCode: "06070",
      lines: ["06070:A:2"],
      timing: "response",
      trigger: "villagerDiscarded",
      cost: { kind: "exhaustSelf" },
      condition: { kind: "canPick", pick: ANY_LOCATION },
      instructions: [{ verb: "Pick", pick: ANY_LOCATION }, { verb: "PlaceResourceTokens", amount: 1, on: "picked" }],
    },
    {
      id: "06070:forced:1",
      cardCode: "06070",
      lines: ["06070:A:3"],
      timing: "forced",
      trigger: "leftPlay",
      subject: "self",
      instructions: [{ verb: "ModifyStat", stat: "endingLost", amount: 1, until: "endOfGame", target: "table" }],
    },

    // 06071 Ghulat. A:1: his Attack is the damage tokens on Dead Villagers, read live. A:2: when he attacks a damage token goes on Dead Villagers (no villager token is discarded). A:3: the game cannot end while he is in play: the conditions of the two objectives read it, the sweep of Alcaron's loss reads it too.
    { id: "06071:constant:1", cardCode: "06071", lines: ["06071:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: DEAD_TOKENS, until: "whileSourceInPlay", target: "self" }] },
    { id: "06071:forced:1", cardCode: "06071", lines: ["06071:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [PLACE_DEAD] },
    { id: "06071:constant:2", cardCode: "06071", lines: ["06071:A:3"], timing: "constant", instructions: [] },

    // 06072 Marauding Orc. A:1: after it attacks and destroys a character a damage token goes on Dead Villagers. A:2 (Shadow): if the attack destroys a character, 1 villager token is discarded from Rescued Villagers.
    { id: "06072:forced:1", cardCode: "06072", lines: ["06072:A:1"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [PLACE_DEAD] },
    { id: "06072:shadow:1", cardCode: "06072", lines: ["06072:A:2"], timing: "shadow", instructions: SHADOW_DISCARD },

    // 06073 Orc Ravager. A:1: 1 villager token is discarded from the active location; with none discarded it gains surge. A:2 (Shadow): +1 Attack, +2 instead when the attack is undefended.
    {
      id: "06073:whenRevealed:1",
      cardCode: "06073",
      lines: ["06073:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "DiscardVillagerTokens", from: "activeLocation", amount: 1 }, { verb: "GainSurge", when: NONE_DISCARDED }],
    },
    {
      id: "06073:shadow:1",
      cardCode: "06073",
      lines: ["06073:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: UNDEFENDED } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: UNDEFENDED },
      ],
    },

    // 06074 Craven Eagle. A:1: the character with the fewest hit points left is discarded unless its controller discards 3 cards at random from his hand (he must hold 3).
    {
      id: "06074:whenRevealed:1",
      cardCode: "06074",
      lines: ["06074:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "PickFewestHitPointsLeft" },
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "prevent", requires: { kind: "less", left: 2, right: { count: HAND_CARDS } }, instructions: [{ verb: "DiscardRandomFromHand", amount: 3 }] },
            { id: "allow", instructions: [{ verb: "Discard", target: { kind: "picked" } }] },
          ],
        },
      ],
    },

    // 06075 Burning Farmhouse (Villagers 4). A:2: at the end of the round 1 villager token is discarded from it, in the staging area or active.
    ...VILLAGERS("06075", "06075:A:1", 4),
    { id: "06075:forced:3", cardCode: "06075", lines: ["06075:A:2"], timing: "forced", trigger: "endOfRound", subject: "self", instructions: [{ verb: "DiscardVillagerTokens", from: "self", amount: 1 }] },

    // 06076 Gondorian Hamlet (Villagers 3). A:2: while it is in the staging area, after a treachery is revealed from the encounter deck 1 villager token is discarded from it.
    ...VILLAGERS("06076", "06076:A:1", 3),
    {
      id: "06076:forced:3",
      cardCode: "06076",
      lines: ["06076:A:2"],
      timing: "forced",
      trigger: "revealed",
      subject: A_TREACHERY,
      byEncounterDeck: true,
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "DiscardVillagerTokens", from: "self", amount: 1 }],
    },

    // 06077 Secluded Farmhouse (Villagers 2). A:2: its Travel record is the template's.
    ...VILLAGERS("06077", "06077:A:1", 2),

    // 06078 Burnt Homestead. A:2: each player raises threat by the damage tokens on Dead Villagers. A:3 (Shadow): the defending player does, once for each damage token.
    { id: "06078:whenRevealed:1", cardCode: "06078", lines: ["06078:A:2"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RaiseThreat", amount: DEAD_TOKENS }] }] },
    { id: "06078:shadow:1", cardCode: "06078", lines: ["06078:A:3"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: DEAD_TOKENS }] },

    // 06079 Trapped Inside (Doomed 2). A:2: 1 villager token for each player is discarded from the active location; with none discarded it gains surge. A:3 (Shadow): the same as 06072:A:2.
    {
      id: "06079:whenRevealed:1",
      cardCode: "06079",
      lines: ["06079:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "DiscardVillagerTokens", from: "activeLocation", amount: { players: true } }, { verb: "GainSurge", when: NONE_DISCARDED }],
    },
    copyLine("06072:A:2", "06079:A:3"),

    // 06080 Panicked!. A:1: each player in turn takes a villager token from Rescued Villagers and places it on a location in the staging area, if able; none placed: it gains surge. A:2 (Shadow): +1 Attack for each damage token on Dead Villagers.
    {
      id: "06080:whenRevealed:1",
      cardCode: "06080",
      lines: ["06080:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [{ verb: "Pick", pick: STAGING_LOCATION, when: { kind: "less", left: 0, right: RESCUED_TOKENS } }, { verb: "MoveVillagerTokens", from: FROM_RESCUED, to: "picked", amount: 1 }],
        },
        { verb: "GainSurge", when: NONE_DISCARDED },
      ],
    },
    { id: "06080:shadow:1", cardCode: "06080", lines: ["06080:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: DEAD_TOKENS, until: "endOfAttack", target: "attacker" }] },
  ],
  { pool: [] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
