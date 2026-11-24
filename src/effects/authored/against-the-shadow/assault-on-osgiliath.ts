import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for Assault on Osgiliath (Against the Shadow part 7, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json). The first player takes control of an explored Osgiliath location: it lies in his play area, ready, with its text working
// (TakeControlOfLocation, the pelargir family's families/pelargir/location-control.ts); a loss of control is LoseControlOfLocation, and the table sees every other way a location leaves his area (a sweep) and announces `controlLost`. "A location he controls" is the pick `controlled` on a
// location (src/rules/interpret/pick.ts); an undefended attack is announced as `attackUndefended` (families/pelargir/undefended.ts). The readings are in docs/scenarios/against-the-shadow/assault-on-osgiliath.md (Readings). The Southrons and Mordor Elite cards (05052 to 05061) keep their
// records of Into Ithilien and The Siege of Cair Andros.
// Rules: ats.setup-assault-on-osgiliath, ats.controlling-locations, ats.losing-control-of-locations, ats.unique-cards, rr.explored, rr.in-play-and-out-of-play, rr.travel, rr.active-location, rr.winning-the-game, rr.response, rr.forced, rr.surge, rr.step-6-4-1, rr.step-6-4-3 (data/rules/entries.json).
const OSGILIATH: PickSpec = { type: "location", control: "any", trait: "Osgiliath" };
// The unique locations of the Osgiliath set: the Setup's "1 unique location" is one of these (the others are not unique).
const UNIQUE_LOCATIONS = ["06096", "06097", "06098", "06099"] as const;
// The locations the acting player controls (the first player is the only one who ever takes control, 06091:B:2), and every location a player controls.
const MINE: PickSpec = { type: "location", control: "you", controlled: true };
const ANY_CONTROLLED: PickSpec = { type: "location", control: "any", controlled: true };
const HIGHEST_OF_MINE: PickSpec = { ...MINE, highestThreat: true };
// "If the players control all Osgiliath locations in play": none is in the staging area or active.
const NONE_UNCONTROLLED: Condition = { kind: "count", pick: OSGILIATH, max: 0 };
const ALWAYS: Condition = { kind: "count", pick: { type: "hero", control: "any" }, min: 0 };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const ONE_ACTIVE: Condition = { kind: "count", pick: { type: "location", control: "any", active: true }, min: 1 };
const NO_ACTIVE: Condition = { kind: "not", condition: ONE_ACTIVE };
// "The player who controls this card": the acting player (the player the event happened to) holds it in his play area.
const I_CONTROL_THIS: Condition = { kind: "count", pick: { ...MINE, isSource: true }, min: 1 };
// Another Osgiliath location lies in the staging area (The Old Bridge, 06099:A:2): the card itself is not another.
const ANOTHER_STAGED: Condition = { kind: "count", pick: { ...OSGILIATH, stagingOnly: true, other: true }, min: 1 };
const NO_OTHER_STAGED: Condition = { kind: "count", pick: { ...OSGILIATH, stagingOnly: true, other: true }, max: 0 };
// The location the discard stopped at is the picked card (06105:A:1); with none found nothing is offered.
const FOUND_ONE: Condition = { kind: "matches", card: "picked", pick: { type: "location", control: "any" } };
const A_LOCATION_LEFT_PLAY = { trigger: "leftPlay", subject: OSGILIATH, condition: { kind: "subjectExplored" } } as const satisfies Partial<Effect>;
// "After X attacks and destroys a character": the character's destruction by the attack names the attacking enemy as the other card.
const DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } } } as const satisfies Partial<Effect>;
// "If this attack destroys a character, that character's controller must return a location he controls with the highest Threat to the staging area" (a shadow effect: read once the attack has dealt its damage; the acting player is the defending player).
const SHADOW_RETURN: Effect["instructions"] = [
  { verb: "AfterAttack", instructions: [{ verb: "Pick", pick: HIGHEST_OF_MINE, when: { kind: "x", min: 1 } }, { verb: "LoseControlOfLocation", card: "picked", when: { kind: "x", min: 1 } }] },
];
// "Forced: After the player who controls this location lets an attack go undefended, return it to the staging area."
const RETURN_WHEN_UNDEFENDED = (code: string, line: string) =>
  ({ id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "attackUndefended", condition: I_CONTROL_THIS, instructions: [{ verb: "LoseControlOfLocation", card: "self" }] }) as const satisfies Effect;
const NO_TRAVEL = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "Restrict", what: "travel" }] });
const SHADOW_BONUS: Instruction = { verb: "ModifyStat", stat: "attack", amount: { count: MINE }, until: "endOfAttack", target: "attacker" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 06091 Retake the City (the only stage). A:1: each player in turn, the first player first, chooses 1 enemy from the encounter deck and 1 unique location (one nobody took: a copy in the staging area is no longer in the deck) and adds them to the staging area without revealing them; the deck is shuffled
    // after. B:1: no player card effect places progress on a location in the staging area. B:2: an Osgiliath location explored, from the staging area, as the active location or in the first player's area, is taken by the first player. B:3: at the end of the round with no Osgiliath location in the staging area or
    // active, the players win.
    {
      id: "06091:setup:1",
      cardCode: "06091",
      lines: ["06091:A:1"],
      timing: "setup",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            { verb: "SearchMove", type: "enemy", to: "staging", deckOnly: true, remember: true },
            // A Haradrim Elite chosen here makes its attack as it is added to the staging area (05053:A:1): the search announces only an ambush enemy, so the record announces the card.
            { verb: "AnnounceAddedToStaging" },
            { verb: "Choose", who: "actor", options: UNIQUE_LOCATIONS.map((code) => ({ id: code, requires: { kind: "searchable", code, type: "location", deckOnly: true }, instructions: [{ verb: "SearchMove", code, to: "staging", deckOnly: true }] })) },
          ],
        },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    { id: "06091:constant:1", cardCode: "06091", lines: ["06091:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noProgressInStagingByPlayer", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "06091:forced:1", cardCode: "06091", lines: ["06091:B:2"], timing: "forced", ...A_LOCATION_LEFT_PLAY, instructions: [{ verb: "TakeControlOfLocation" }] },
    { id: "06091:forced:2", cardCode: "06091", lines: ["06091:B:3"], timing: "forced", trigger: "endOfRound", condition: NONE_UNCONTROLLED, instructions: [{ verb: "WinGame" }] },

    // 06092 Uruk Lieutenant. A:1: the topmost Orc enemy of the encounter discard pile is added to the staging area, not revealed. A:2 (Shadow): the defending player discards an attachment he controls, all of them when undefended.
    { id: "06092:whenRevealed:1", cardCode: "06092", lines: ["06092:A:1"], timing: "whenRevealed", instructions: [{ verb: "ReturnFromDiscard", trait: "Orc", count: 1, to: "staging" }] },
    {
      id: "06092:shadow:1",
      cardCode: "06092",
      lines: ["06092:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "Pick", pick: { type: "attachment", control: "you" }, when: { kind: "not", condition: { kind: "undefended" } } },
        { verb: "DiscardPicked", when: { kind: "not", condition: { kind: "undefended" } } },
        { verb: "Each", pick: { type: "attachment", control: "you" }, instructions: [{ verb: "DiscardPicked" }], when: { kind: "undefended" } },
      ],
    },

    // 06093 Uruk Soldier. A:1: after it attacks and destroys a character, that character's controller returns a location he controls (his choice) to the staging area, if able. A:2 (Shadow): the defending player raises his threat by 1 for each location he controls.
    { id: "06093:forced:1", cardCode: "06093", lines: ["06093:A:1"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "Pick", pick: MINE }, { verb: "LoseControlOfLocation", card: "picked" }] },
    { id: "06093:shadow:1", cardCode: "06093", lines: ["06093:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { count: MINE } }] },

    // 06094 Southron Phalanx. A:1: while engaged it gets +1 Attack for each location the engaged player controls. A:2 (Shadow): the attacker gets +1 Attack for each location the defending player controls.
    { id: "06094:constant:1", cardCode: "06094", lines: ["06094:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: MINE }, until: "whileSourceInPlay", target: "self" }] },
    { id: "06094:shadow:1", cardCode: "06094", lines: ["06094:A:2"], timing: "shadow", instructions: [SHADOW_BONUS] },

    // 06095 Southron Commander. A:1: it makes an immediate attack from the staging area against each player who controls at least 1 location, in player order.
    {
      id: "06095:whenRevealed:1",
      cardCode: "06095",
      lines: ["06095:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "AttackFromStaging", target: "self", when: { kind: "count", pick: MINE, min: 1 } }] }],
    },

    // 06096 West Gate. A:1: Action (any player), with no active location: search the encounter deck and discard pile for an Osgiliath location, reveal it and add it to the staging area; then West Gate becomes the active location (from the staging area or, when the first player controls it, from his area:
    // control is lost); shuffle the encounter deck. A:2: Forced, after the player who controls it lets an attack go undefended, it returns to the staging area.
    {
      id: "06096:action:1",
      cardCode: "06096",
      lines: ["06096:A:1"],
      timing: "action",
      anyPlayer: true,
      condition: NO_ACTIVE,
      instructions: [{ verb: "SearchReveal", type: "location", trait: "Osgiliath", who: "actor" }, { verb: "MakeActive", target: "self" }, { verb: "ShuffleEncounterDeck" }],
    },
    RETURN_WHEN_UNDEFENDED("06096", "06096:A:2"),

    // 06097 The King's Library. A:1: Travel, the cost is revealing the top card of the encounter deck and adding it to the staging area (06097:travel:1, the template). A:2: as West Gate.
    RETURN_WHEN_UNDEFENDED("06097", "06097:A:2"),

    // 06098 Ancient Harbor. A:1: the players cannot travel here. A:2: Combat Action (any player): exhaust a hero to place 1 progress on it, wherever it is. A:3: as West Gate.
    NO_TRAVEL("06098", "06098:A:1"),
    {
      id: "06098:action:1",
      cardCode: "06098",
      lines: ["06098:A:2"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "canPick", pick: READY_HERO }] },
      instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "PlaceProgressOn", amount: 1, target: "self" }],
    },
    RETURN_WHEN_UNDEFENDED("06098", "06098:A:3"),

    // 06099 The Old Bridge. A:1: the players cannot travel here. A:2: Planning Action (any player): spend 2 resources, or 1 when another Osgiliath location is in the staging area, to place 1 progress on it. A:3: as West Gate.
    NO_TRAVEL("06099", "06099:A:1"),
    {
      id: "06099:action:1",
      cardCode: "06099",
      lines: ["06099:A:2"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Planning" }, NO_OTHER_STAGED] },
      cost: { kind: "resources", amount: 2 },
      instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "self" }],
    },
    {
      id: "06099:action:2",
      cardCode: "06099",
      lines: ["06099:A:2"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Planning" }, ANOTHER_STAGED] },
      cost: { kind: "resources", amount: 1 },
      instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "self" }],
    },
    RETURN_WHEN_UNDEFENDED("06099", "06099:A:3"),

    // 06100 West Quarter. A:1: while it is the active location the current quest gains siege. A:2 (Shadow): if the attack destroys a character, its controller returns the location he controls with the highest Threat (his choice among those tied).
    { id: "06100:constant:1", cardCode: "06100", lines: ["06100:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "siege", amount: 1, until: "whileSourceActive", target: "currentQuest" }] },
    { id: "06100:shadow:1", cardCode: "06100", lines: ["06100:A:2"], timing: "shadow", instructions: SHADOW_RETURN },

    // 06101 East Quarter. A:1: while it is the active location the current quest gains battle. West Quarter and East Quarter are never active together: the second active slot is Ruined Tower's alone (the pelargir family's travel hook), so the quest never has both keywords (Readings, 06100:A:1). A:2 (Shadow): as West Quarter.
    { id: "06101:constant:1", cardCode: "06101", lines: ["06101:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "battle", amount: 1, until: "whileSourceActive", target: "currentQuest" }] },
    copyLine("06100:A:2", "06101:A:2"),

    // 06102 Ruined Square (surge is a keyword). A:2: Response after any enemy is destroyed: it takes 1 progress, wherever it is. A:3: Forced, when any character leaves play while a player controls it, it returns to the staging area.
    { id: "06102:response:1", cardCode: "06102", lines: ["06102:A:2"], timing: "response", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any" }, anyPlayer: true, instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "self" }] },
    {
      id: "06102:forced:1",
      cardCode: "06102",
      lines: ["06102:A:3"],
      timing: "forced",
      trigger: "leftPlay",
      subject: { type: "character", control: "any" },
      condition: { kind: "count", pick: { ...ANY_CONTROLLED, isSource: true }, min: 1 },
      instructions: [{ verb: "LoseControlOfLocation", card: "self" }],
    },

    // 06103 Ruined Tower. A:1: Travel, with 1 active location, exhaust a character: the Tower becomes the second active location (the pelargir family's travel hook, as Fisherman's Dock). A:2: Forced, after the player who controls it loses control of another location, it returns to the staging area.
    {
      id: "06103:travel:1",
      cardCode: "06103",
      lines: ["06103:A:1"],
      timing: "travel",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" }, when: ONE_ACTIVE }, { verb: "Exhaust", target: { kind: "picked" }, when: ONE_ACTIVE }],
    },
    {
      id: "06103:forced:1",
      cardCode: "06103",
      lines: ["06103:A:2"],
      timing: "forced",
      trigger: "controlLost",
      subject: { type: "location", control: "any", other: true },
      condition: I_CONTROL_THIS,
      instructions: [{ verb: "LoseControlOfLocation", card: "self" }],
    },

    // 06104 Pinned Down. A:1: the archery total grows by the number of locations the players control, counted as it resolves (a number that lasts to the end of the round); with fewer than 4 it gains surge. A:2 (Shadow): as West Quarter.
    {
      id: "06104:whenRevealed:1",
      cardCode: "06104",
      lines: ["06104:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ModifyStat", stat: "archeryBonus", amount: { count: ANY_CONTROLLED }, until: "endOfRound", target: "actorSeat" }, { verb: "GainSurge", when: { kind: "count", pick: ANY_CONTROLLED, max: 3 } }],
    },
    copyLine("06100:A:2", "06104:A:2"),

    // 06105 Street Fighting. A:1: cards from the top of the encounter deck are discarded until an Osgiliath location is discarded (the discard pile is shuffled back in when the deck runs out); the first player may exhaust a hero to take control of it, otherwise it is added to the staging area. It cannot be canceled.
    {
      id: "06105:whenRevealed:1",
      cardCode: "06105",
      lines: ["06105:A:1"],
      timing: "whenRevealed",
      uncancelable: ALWAYS,
      instructions: [
        { verb: "DiscardUntil", type: "location", trait: "Osgiliath", reshuffle: true },
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "take", requires: { kind: "all", conditions: [FOUND_ONE, { kind: "canPick", pick: { ...READY_HERO, who: "firstPlayer" } }] }, instructions: [{ verb: "Pick", pick: { ...READY_HERO, who: "firstPlayer" } }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "TakeControlOfLocation", card: "previous" }] },
            { id: "stage", requires: FOUND_ONE, instructions: [{ verb: "MoveEncounterCard", card: "picked", to: "staging" }] },
          ],
        },
      ],
    },

    // 06106 Counter-attack (surge is a keyword). A:2: each player, the first player first, either returns the location he controls with the highest Threat or raises his threat by the total Threat of the locations he controls.
    {
      id: "06106:whenRevealed:1",
      cardCode: "06106",
      lines: ["06106:A:2"],
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
                { id: "return", requires: { kind: "canPick", pick: MINE }, instructions: [{ verb: "Pick", pick: HIGHEST_OF_MINE }, { verb: "LoseControlOfLocation", card: "picked" }] },
                { id: "raise", instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", totalOf: MINE } }] },
              ],
            },
          ],
        },
      ],
    },
  ],
  { pool: [] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
