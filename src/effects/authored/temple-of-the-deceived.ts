import type { Condition, Effect, PickSpec } from "../../catalog/boundary.ts";

import { flippedActive, lostIsland } from "./the-fate-of-numenor.ts";

// Records for Temple of the Deceived (Dream-chaser part 6, campaign card 11197): the quest card, the fifteen double-sided locations of the Island Map (Jagged Cliffs, Winding Caverns, Jungle Path, the Temple
// of the Deceived side of Temple Halls and The Grotto's Entrance; Flooded Ruins, Drowned Graves and Cursed Temple are The Fate of Númenor's), Temple Guardian and Gate Key with their Campaign Expansion reprints, the
// Temple of the Deceived and Ruins of Númenor and Drowned Dead encounter cards no template or earlier record reads, and the campaign card. Starla and Recurring Nightmare, which the campaign card places, are in
// pool/DCCE.ts. Every line is read from the scan ledger (data/printed/dream-chaser.json); the keywords (Surge, Doomed, Uncharted, Immune to player card effects) are read by the engine.
// Rules: dcce.island-map, dcce.exploration, dcce.uncharted, dcce.setup-temple-of-the-deceived, dcce.campaign-setup-temple-of-the-deceived, dcce.campaign-mode, dcce.gaining-xp, dcce.scalable-upgradable,
// dcce.encounter-cards, rr.travel, rr.active-location, rr.guarded, rr.action, rr.search (data/rules/entries.json).
const ACTIVE = { kind: "sourceIn", zone: "activeLocation" } as const;
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const COMMITTED: PickSpec = { type: "character", control: "you", committed: true };
const ANY_CHARACTER: PickSpec = { type: "character", control: "any" };
// The active location is a Ruins location.
const ACTIVE_RUINS: Condition = { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", trait: "Ruins" } };
const CURSED_TEMPLE_ACTIVE: Condition = { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", names: ["Cursed Temple"] } };
const TEMPLE_FACEDOWN: PickSpec = { type: "location", control: "any", island: "temple" };
const SECRET: PickSpec = { type: "card", control: "any", island: "secret" };
const LOST_ISLAND_NEXT: PickSpec = { type: "location", control: "any", island: "adjacent" };
// The players control the Gate Key once it is claimed: a Gate Key lying in the staging area (guardless, unclaimed) is nobody's.
const GATE_KEY_CONTROLLED: PickSpec = { type: "objective", control: "any", controlled: true, names: ["Gate Key"] };
const HERO_HOLDS_KEY: Condition = { kind: "matches", card: "host", pick: { type: "hero", control: "any" } };

// "Immune to player card effects" on the Temple of the Deceived side (a keyword line the engine reads on the printed side; the side B of a location is only read through a record).
const templeImmune = (code: string): Effect => ({ id: `${code}:constant:2`, cardCode: code, lines: [`${code}:B:2`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay" }] });

// The Temple of the Deceived side of Temple Halls and The Grotto's Entrance: Uncharted and immune (keywords), "Travel: Exhaust the Gate Key to travel here", and the flip once it is the active location. `ids`:
// the number of the travel and forced records on the card.
const templeSide = (code: string): Effect[] => [
  templeImmune(code),
  { id: `${code}:travel:1`, cardCode: code, lines: [`${code}:B:3`], timing: "travel", instructions: [{ verb: "Exhaust", target: { kind: "byName", name: "Gate Key" } }] },
  { id: `${code}:forced:2`, cardCode: code, lines: [`${code}:B:4`], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "FlipUncharted" }] },
];

// "Put Temple Guardian into play from the victory display, engaged with the player with the highest threat" (a Forced effect of the Temple locations once flipped over while active).
const guardianReturns: Effect["instructions"] = [{ verb: "EngageFromVictory", name: "Temple Guardian" }];

// Gate Key (12071, and its reprint 110078): "If unattached, return Gate Key to the staging area and it gains: Action: Exhaust a hero to claim Gate Key and attach it to that hero" (the claimed flag AttachGuarded
// sets does the return, families/objectives/claimed.ts), and the Action that looks at the facedown side of a Temple location for 3 resources from the hero it is attached to (side B of the reprint: for
// nothing, and at a secret as well).
const gateKey = (code: string, side: "A" | "B", lines: { claim: number; look: number }): Effect[] => {
  const claim: Effect = {
    id: `${code}:action:${side === "A" ? 1 : 3}`,
    cardCode: code,
    lines: [`${code}:${side}:${lines.claim}`],
    timing: "action",
    condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "canPick", pick: READY_HERO }] },
    instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }],
  };
  const holds: Condition = { kind: "all", conditions: [HERO_HOLDS_KEY, { kind: "canPick", pick: TEMPLE_FACEDOWN }] };
  const look: Effect =
    side === "A"
      ? {
          id: `${code}:action:2`,
          cardCode: code,
          lines: [`${code}:A:${lines.look}`],
          timing: "action",
          cost: [{ kind: "exhaustSelf" }, { kind: "exhaustHost" }, { kind: "resources", amount: 3, from: "host" }],
          condition: holds,
          instructions: [{ verb: "Pick", pick: TEMPLE_FACEDOWN }, { verb: "LookAtFacedown", target: "picked" }],
        }
      : {
          id: `${code}:action:4`,
          cardCode: code,
          lines: [`${code}:B:${lines.look}`],
          timing: "action",
          cost: [{ kind: "exhaustSelf" }, { kind: "exhaustHost" }],
          condition: HERO_HOLDS_KEY,
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "temple", requires: { kind: "canPick", pick: TEMPLE_FACEDOWN }, instructions: [{ verb: "Pick", pick: TEMPLE_FACEDOWN }, { verb: "LookAtFacedown", target: "picked" }] },
                { id: "secret", requires: { kind: "canPick", pick: SECRET }, instructions: [{ verb: "Pick", pick: SECRET }, { verb: "LookAtSecret" }] },
              ],
            },
          ],
        };
  return [claim, look];
};

// Temple Guardian: Threat X (side A), Immune to player card effects (a keyword), cannot be optionally engaged, and -50 engagement cost while Cursed Temple is the active location.
const guardian = (code: string, side: "A" | "B", lines: { threat: number; optional: number; cheap: number }): Effect[] => {
  const n = side === "A" ? 0 : 3;
  return [
    {
      id: `${code}:constant:${n + 1}`,
      cardCode: code,
      lines: [`${code}:${side}:${lines.threat}`],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay" },
        ...(side === "B" ? ([{ verb: "ModifyStat", stat: "defense", amount: { players: true }, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "archery", amount: { players: true }, until: "whileSourceInPlay" }] as const) : []),
      ],
    },
    { id: `${code}:constant:${n + 2}`, cardCode: code, lines: [`${code}:${side}:${lines.optional}`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay" }] },
    { id: `${code}:constant:${n + 3}`, cardCode: code, lines: [`${code}:${side}:${lines.cheap}`], timing: "constant", condition: CURSED_TEMPLE_ACTIVE, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -50, until: "whileSourceInPlay" }] },
  ];
};

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 12067 Searching the Island. Setup: the Island Map is prepared, the top-left and bottom-left locations are flipped without their Forced effects and the first player chooses one as the starting active location,
  // Captain Sahír and Na'asiyah (objective ally sides) come into play (the first and the last player control them), Gate Key is attached to Temple Guardian, guarded, and the encounter deck is shuffled. Side B:
  // Exploration (the table holds it; the engine reads it where a location is explored, the players travel and the locations stand in the staging area), and each progress that would be placed on the stage
  // may be placed on a location in the staging area instead.
  {
    id: "12067:setup:1",
    cardCode: "12067",
    lines: ["12067:A:1"],
    timing: "setup",
    instructions: [
      { verb: "PrepareIslandMap", temple: ["12068", "12069"] },
      { verb: "RevealIslandCorners" },
      { verb: "Pick", pick: { type: "location", control: "any", island: "start", who: "firstPlayer" } },
      { verb: "SetIslandActive" },
      { verb: "PutSetAsideInPlay", name: "Captain Sahír" },
      { verb: "PutSetAsideInPlay", name: "Na'asiyah" },
      { verb: "AttachGuarded", name: "Gate Key", to: "Temple Guardian" },
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  { id: "12067:constant:1", cardCode: "12067", lines: ["12067:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "exploration", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "12067:constant:2", cardCode: "12067", lines: ["12067:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressToStaging", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "12067:triggered:1", cardCode: "12067", lines: ["12067:B:2"], timing: "triggered", trigger: "progressReplaced", instructions: [{ verb: "PlaceProgressInStaging" }] },

  // 12068 The Grotto's Entrance. Forced: once flipped over while active, Temple Guardian comes back from the victory display, engaged with the player with the highest threat. The players win when the 8th progress is
  // placed on it. The Temple of the Deceived side is Uncharted and immune, can be traveled to only by exhausting the Gate Key, and is flipped once it is the active location.
  flippedActive("12068", "12068:A:1", 1, guardianReturns),
  {
    id: "12068:triggered:1",
    cardCode: "12068",
    lines: ["12068:A:2"],
    timing: "triggered",
    trigger: "progressPlaced",
    subject: "self",
    condition: { kind: "matches", card: "self", pick: { type: "location", control: "any", minProgress: 8 } },
    instructions: [{ verb: "WinGame" }],
  },
  ...templeSide("12068"),

  // 12069 Temple Halls. While active every character gets -1 Attack and -1 Defense. Forced: as The Grotto's Entrance. The Temple of the Deceived side is the same on both locations.
  {
    id: "12069:constant:1",
    cardCode: "12069",
    lines: ["12069:A:1"],
    timing: "constant",
    condition: ACTIVE,
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: -1, until: "whileSourceInPlay", holders: ANY_CHARACTER },
      { verb: "ModifyStat", stat: "defense", amount: -1, until: "whileSourceInPlay", holders: ANY_CHARACTER },
    ],
  },
  flippedActive("12069", "12069:A:2", 1, guardianReturns),
  ...templeSide("12069"),

  // 12070 Temple Guardian (Immune to player card effects is a keyword), and the Campaign Expansion's 110077, whose side B is Campaign Mode only (dcce.campaign-mode): Archery X, Threat X and Defense X.
  ...guardian("12070", "A", { threat: 1, optional: 3, cheap: 4 }),
  ...guardian("110077", "A", { threat: 1, optional: 3, cheap: 4 }),
  ...guardian("110077", "B", { threat: 2, optional: 4, cheap: 5 }),

  // 12071 Gate Key, and the reprint 110078 on both sides.
  ...gateKey("12071", "A", { claim: 1, look: 2 }),
  ...gateKey("110078", "A", { claim: 1, look: 2 }),
  ...gateKey("110078", "B", { claim: 2, look: 3 }),

  // 12072 Jagged Cliffs. While active the location to its right is not in the staging area. Forced: once flipped over while active, look at the facedown side of each adjacent copy of Lost Island.
  { id: "12072:constant:1", cardCode: "12072", lines: ["12072:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "islandBlock", amount: 1, until: "whileSourceInPlay" }] },
  flippedActive("12072", "12072:A:2", 1, [{ verb: "Each", pick: LOST_ISLAND_NEXT, instructions: [{ verb: "LookAtFacedown", target: "picked" }] }]),
  ...lostIsland("12072", { constant: 2, forced: 2 }),

  // 12073 Winding Caverns. While active each enemy gets +10 engagement cost, and the players may travel up to 3 locations away.
  { id: "12073:constant:1", cardCode: "12073", lines: ["12073:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: 10, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }] },
  { id: "12073:constant:2", cardCode: "12073", lines: ["12073:A:2"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "islandReach", amount: 3, until: "whileSourceInPlay" }] },
  ...lostIsland("12073", { constant: 3, forced: 1 }),

  // 12074 Jungle Path. While active the locations above and below it are not in the staging area. Forced: once flipped over while active, each player exhausts a character with at least 2 Attack.
  { id: "12074:constant:1", cardCode: "12074", lines: ["12074:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "islandBlock", amount: 2, until: "whileSourceInPlay" }] },
  flippedActive("12074", "12074:A:2", 1, [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { ...READY_CHARACTER, minAttack: 2 } }, { verb: "Exhaust", target: { kind: "picked" } }] }]),
  ...lostIsland("12074", { constant: 2, forced: 2 }),

  // 12075 Faithless Desecrator. While engaged with a player it contributes its Threat to the staging area. Shadow: the attacking enemy gets +1 Attack, +2 instead if the active location is a Ruins location.
  { id: "12075:constant:1", cardCode: "12075", lines: ["12075:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "engagedThreat", amount: 1, until: "whileSourceInPlay" }] },
  {
    id: "12075:shadow:1",
    cardCode: "12075",
    lines: ["12075:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: ACTIVE_RUINS },
    ],
  },

  // 12076 Island Watcher. It cannot be optionally engaged. In the staging area it gains: Forced: at the beginning of the encounter phase, if the active location is a Ruins location it engages the player with the
  // highest threat, and is dealt 2 shadow cards.
  { id: "12076:constant:1", cardCode: "12076", lines: ["12076:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay" }] },
  {
    id: "12076:forced:1",
    cardCode: "12076",
    lines: ["12076:A:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Encounter" }, { kind: "sourceIn", zone: "staging" }, ACTIVE_RUINS] },
    instructions: [{ verb: "PickHighestThreat" }, { verb: "SwitchActor", to: "picked" }, { verb: "Engage", target: "self" }, { verb: "DealShadow", additional: true }, { verb: "DealShadow", additional: true }],
  },

  // 12077 Profane Dead. Forced: when the players travel to the right it makes an immediate attack against the player it is engaged with. Shadow: the attacking enemy gets +3 Attack if the players control the Gate Key.
  {
    id: "12077:forced:1",
    cardCode: "12077",
    lines: ["12077:A:1"],
    timing: "forced",
    trigger: "traveled",
    subject: { type: "location", control: "any" },
    condition: { kind: "all", conditions: [{ kind: "island", movedRight: true }, { kind: "sourceIn", zone: "engaged" }] },
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "ImmediateAttack", when: { kind: "engagedWithActor" } }] }],
  },
  {
    id: "12077:shadow:1",
    cardCode: "12077",
    lines: ["12077:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: { kind: "count", pick: GATE_KEY_CONTROLLED, min: 1 } }],
  },

  // 12078 Deeper into the Ruins. When Revealed: until the end of the phase the total Threat of the locations to the left of the active location, in its row, is added to the staging area's; with none, it gains Doomed 1.
  {
    id: "12078:whenRevealed:1",
    cardCode: "12078",
    lines: ["12078:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "RaiseStagingThreat", amount: { islandLeft: true }, until: "endOfPhase", when: { kind: "less", left: 0, right: { islandLeft: true } } },
      { verb: "Doomed", amount: 1, when: { kind: "less", left: { islandLeft: true }, right: 1 } },
    ],
  },

  // 12079 Furious Rainstorm. When Revealed: each player chooses to raise their threat by the number of their characters committed to the quest, or to deal 1 damage to each of them. Shadow: if the attack destroys
  // a character, the defending player raises their threat by the attacking enemy's Threat.
  {
    id: "12079:whenRevealed:1",
    cardCode: "12079",
    lines: ["12079:A:1"],
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
              { id: "threat", requires: { kind: "canPick", pick: COMMITTED }, instructions: [{ verb: "RaiseThreat", amount: { count: COMMITTED } }] },
              { id: "damage", requires: { kind: "canPick", pick: COMMITTED }, instructions: [{ verb: "DamageEach", amount: 1, pick: COMMITTED }] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "12079:shadow:1",
    cardCode: "12079",
    lines: ["12079:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "AfterAttack",
        instructions: [
          {
            verb: "RaiseThreat",
            amount: { stat: "threat", of: "self" },
            when: { kind: "x", min: 1 },
          },
        ],
      },
    ],
  },

  // 12080 Dwindling Supplies. When Revealed: each player randomly discards cards from their hand until they hold no more than 3; if none had to, it gains Doomed 2. Shadow: the defending character gets -2 Defense for this attack.
  {
    id: "12080:whenRevealed:1",
    cardCode: "12080",
    lines: ["12080:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Doomed", amount: 2, when: { kind: "handSize", max: 3 } },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardRandomFromHand", amount: { hand: true, plus: -3 } }] },
    ],
  },
  { id: "12080:shadow:1", cardCode: "12080", lines: ["12080:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfAttack", target: "defender" }] },

  // 12081 Sunken Ruins (Surge is a keyword). When Revealed: each Uncharted location in the staging area gets +1 Threat until the end of the phase; with a Ruins location active, each hero and objective ally in play loses 1 resource.
  {
    id: "12081:whenRevealed:1",
    cardCode: "12081",
    lines: ["12081:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: { type: "location", control: "any", uncharted: true, stagingOnly: true } },
      { verb: "Each", pick: { type: "ally", control: "any", objective: true, hasResources: true }, instructions: [{ verb: "DiscardResources", amount: 1, target: "picked" }], when: ACTIVE_RUINS },
      { verb: "Each", pick: { type: "hero", control: "any", hasResources: true }, instructions: [{ verb: "DiscardResources", amount: 1, target: "picked" }], when: ACTIVE_RUINS },
    ],
  },

  // 11197 Temple of the Deceived (campaign card). Setup (Campaign Mode): Spyglass, Black Key (boon), Starla and both Recurring Nightmares are set aside, Revenant is shuffled into the encounter deck, Temple Guardian shows its
  // Campaign Mode only side, Black Key (boon) is attached to Captain Sahír, Starla and the Recurring Nightmares are shuffled and lie facedown under the Temple locations as secrets, each character in play may take 1
  // damage to lower its controller's threat by 1, and one player may raise their threat by 4 to attach Spyglass to a hero (all once the quest card's Setup has made the map and put Captain Sahír into play,
  // ScenarioDefinition.afterSetup). The card stays in the game because Revenant places resources on it. Action (Travel): flip over the secret at the active location. Resolution: Starla joins the pool if a
  // player controls her; each Recurring Nightmare that is no secret joins the pool for a player the first player chooses; the XP list.
  {
    id: "11197:campaignSetup:1",
    cardCode: "11197",
    lines: ["11197:A:2"],
    timing: "campaignSetup",
    instructions: [
      { verb: "KeepCampaignCard" },
      { verb: "SetAside", code: "11180" },
      { verb: "SetAside", code: "11183" },
      { verb: "SetAside", code: "11198" },
      { verb: "SetAside", code: "11199" },
      { verb: "SetAside", code: "11199" },
      { verb: "ShuffleIntoEncounterDeck", code: "11181" },
      { verb: "FlipSetAside", name: "Temple Guardian" },
      { verb: "AttachSetAsideTo", code: "11183", to: "Captain Sahír" },
      { verb: "PlaceSecrets", codes: ["11198", "11199", "11199"] },
      { verb: "TradeDamageForThreat", damage: 1, threat: 1 },
      { verb: "RaiseThreatToAttach", code: "11180", amount: 4 },
    ],
  },
  {
    id: "11197:action:1",
    cardCode: "11197",
    lines: ["11197:A:3"],
    timing: "action",
    anyPlayer: true,
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Travel" }, { kind: "canPick", pick: { type: "card", control: "any", island: "here" } }] },
    instructions: [{ verb: "FlipSecret" }],
  },
  { id: "11197:resolution:1", cardCode: "11197", lines: ["11197:B:1"], timing: "resolution", instructions: [{ verb: "Earn", codes: ["11198"], when: { kind: "count", pick: { type: "ally", control: "any", names: ["Starla"] }, min: 1 } }] },
  {
    id: "11197:resolution:2",
    cardCode: "11197",
    lines: ["11197:B:1"],
    timing: "resolution",
    instructions: [
      { verb: "ChooseCards", codes: ["11199"], who: "firstPlayer", to: "player", when: { kind: "island", revealed: { code: "11199", min: 1 } } },
      { verb: "ChooseCards", codes: ["11199"], who: "firstPlayer", to: "player", when: { kind: "island", revealed: { code: "11199", min: 2 } } },
    ],
  },
  { id: "11197:resolution:3", cardCode: "11197", lines: ["11197:B:2", "11197:B:3"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "survivingPlayer" } }] },
  { id: "11197:resolution:4", cardCode: "11197", lines: ["11197:B:4"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "tokens", code: "11197" }, max: 3 }] },
  { id: "11197:resolution:5", cardCode: "11197", lines: ["11197:B:5"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "islandFaceup", code: "12069" } }] },
  { id: "11197:resolution:6", cardCode: "11197", lines: ["11197:B:6"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "island", flippedAtMost: 4 } }] },
  { id: "11197:resolution:7", cardCode: "11197", lines: ["11197:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "any", conditions: [{ kind: "inVictory", code: "12070", is: true }, { kind: "inVictory", code: "110077", is: true }] } }] },
  { id: "11197:resolution:8", cardCode: "11197", lines: ["11197:B:8"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "survivorsThreat", max: 40 } }] },
  {
    id: "11197:resolution:9",
    cardCode: "11197",
    lines: ["11197:B:9"],
    timing: "resolution",
    instructions: [{ verb: "GainXp", amount: -1, when: { kind: "count", pick: { type: "card", control: "any", from: "victory", names: ["Ominous Fate"] }, min: 1 } }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
